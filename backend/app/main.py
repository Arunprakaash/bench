from contextlib import asynccontextmanager
import asyncio

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import agents, auth, automation, chat, dev, failures, invites, runs, scenarios, suites, workspaces
from app.config import settings
from app.database import Base, engine
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler_stop = asyncio.Event()
    scheduler_task: asyncio.Task | None = None

    async def _schedule_loop():
        while not scheduler_stop.is_set():
            try:
                await automation.process_due_schedules()
            except Exception:
                # Keep scheduler alive despite processing errors.
                pass
            try:
                await asyncio.wait_for(scheduler_stop.wait(), timeout=30.0)
            except TimeoutError:
                continue

    async with engine.begin() as conn:
        # Lightweight forward-only migrations (we don't ship Alembic here).
        # Safe to run repeatedly on startup.
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS scenarios
                ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS scenario_revisions (
                  id UUID PRIMARY KEY,
                  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
                  version INTEGER NOT NULL,
                  snapshot JSONB NOT NULL,
                  created_at TIMESTAMPTZ DEFAULT now()
                );
                """
            )
        )
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_scenario_revisions_scenario_id_version'
                  ) THEN
                    ALTER TABLE scenario_revisions
                      ADD CONSTRAINT uq_scenario_revisions_scenario_id_version UNIQUE (scenario_id, version);
                  END IF;
                END$$;
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS agents (
                  id UUID PRIMARY KEY,
                  name VARCHAR(255) UNIQUE NOT NULL,
                  description TEXT,
                  module VARCHAR(500) NOT NULL,
                  agent_class VARCHAR(255) NOT NULL,
                  provider_type VARCHAR(64) NOT NULL DEFAULT 'local_python',
                  connection_config JSONB,
                  capabilities JSONB,
                  auth_config JSONB,
                  default_llm_model VARCHAR(255) DEFAULT 'gpt-4o-mini',
                  default_judge_model VARCHAR(255) DEFAULT 'gpt-4o-mini',
                  default_agent_args JSONB,
                  tags JSONB,
                  created_at TIMESTAMPTZ DEFAULT now(),
                  updated_at TIMESTAMPTZ DEFAULT now()
                );
                """
            )
        )

        # Users/auth (minimal for now; columns can be added safely on startup).
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS users (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  email VARCHAR(255) UNIQUE NOT NULL,
                  display_name VARCHAR(255),
                  avatar_url VARCHAR(500),
                  password_salt VARCHAR(255),
                  password_hash VARCHAR(255),
                  created_at TIMESTAMPTZ DEFAULT now(),
                  updated_at TIMESTAMPTZ DEFAULT now()
                );
                """
            )
        )
        await conn.execute(text("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_salt VARCHAR(255)"))
        await conn.execute(text("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
        await conn.execute(text("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS api_token_hash VARCHAR(255)"))
        await conn.execute(text("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS api_token_prefix VARCHAR(64)"))
        await conn.execute(text("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS api_token_last4 VARCHAR(4)"))
        await conn.execute(text("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS api_token_created_at TIMESTAMPTZ"))
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS agents
                ADD COLUMN IF NOT EXISTS arg_schema JSONB;
                """
            )
        )
        await conn.execute(text("ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS provider_type VARCHAR(64)"))
        await conn.execute(text("ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS connection_config JSONB"))
        await conn.execute(text("ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS capabilities JSONB"))
        await conn.execute(text("ALTER TABLE IF EXISTS agents ADD COLUMN IF NOT EXISTS auth_config JSONB"))
        await conn.execute(text("UPDATE agents SET provider_type = 'local_python' WHERE provider_type IS NULL"))

        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS agents
                ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS scenarios
                ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
                """
            )
        )

        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS scenarios
                ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
                """
            )
        )

        # Backfill agents from existing scenarios and link scenario.agent_id.
        # We create one Agent per distinct (agent_module, agent_class).
        await conn.execute(
            text(
                """
                INSERT INTO agents (id, name, module, agent_class, default_llm_model, default_judge_model)
                SELECT
                  gen_random_uuid(),
                  (agent_module || '.' || agent_class) AS name,
                  agent_module AS module,
                  agent_class AS agent_class,
                  'gpt-4o-mini' AS default_llm_model,
                  'gpt-4o-mini' AS default_judge_model
                FROM (
                  SELECT DISTINCT agent_module, agent_class
                  FROM scenarios
                  WHERE agent_module IS NOT NULL AND agent_class IS NOT NULL
                ) s
                ON CONFLICT (name) DO NOTHING;
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE scenarios sc
                SET agent_id = ag.id
                FROM agents ag
                WHERE sc.agent_id IS NULL
                  AND ag.module = sc.agent_module
                  AND ag.agent_class = sc.agent_class;
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS test_runs
                ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE test_runs tr
                SET agent_id = sc.agent_id
                FROM scenarios sc
                WHERE tr.scenario_id = sc.id AND tr.agent_id IS NULL AND sc.agent_id IS NOT NULL;
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS agent_versions (
                  id UUID PRIMARY KEY,
                  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
                  version INTEGER NOT NULL,
                  module VARCHAR(500) NOT NULL,
                  agent_class VARCHAR(255) NOT NULL,
                  config JSONB NOT NULL DEFAULT '{}',
                  created_at TIMESTAMPTZ DEFAULT now(),
                  UNIQUE(agent_id, version)
                );
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE test_runs
                ADD COLUMN IF NOT EXISTS agent_version_id UUID REFERENCES agent_versions(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS execution_snapshot JSONB;
                """
            )
        )

        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS test_runs
                ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
                """
            )
        )

        await conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS suites
                ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS run_evaluations (
                  id UUID PRIMARY KEY,
                  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
                  metrics JSONB NOT NULL DEFAULT '{}',
                  judge_output JSONB,
                  created_at TIMESTAMPTZ DEFAULT now()
                );
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE turn_results
                ADD COLUMN IF NOT EXISTS structured_events JSONB,
                ADD COLUMN IF NOT EXISTS input_audio_url TEXT,
                ADD COLUMN IF NOT EXISTS output_audio_url TEXT,
                ADD COLUMN IF NOT EXISTS stt_latency_ms FLOAT,
                ADD COLUMN IF NOT EXISTS tts_latency_ms FLOAT,
                ADD COLUMN IF NOT EXISTS interruption BOOLEAN;
                """
            )
        )
        for index_sql in (
            "CREATE INDEX IF NOT EXISTS idx_test_runs_scenario ON test_runs(scenario_id)",
            "CREATE INDEX IF NOT EXISTS idx_test_runs_agent_version ON test_runs(agent_version_id)",
            "CREATE INDEX IF NOT EXISTS idx_test_runs_agent_id ON test_runs(agent_id)",
            "CREATE INDEX IF NOT EXISTS idx_test_runs_owner_user_id ON test_runs(owner_user_id)",
            "CREATE INDEX IF NOT EXISTS idx_turn_results_run ON turn_results(test_run_id)",
            "CREATE INDEX IF NOT EXISTS idx_scenarios_agent ON scenarios(agent_id)",
            "CREATE INDEX IF NOT EXISTS idx_scenarios_owner_user_id ON scenarios(owner_user_id)",
            "CREATE INDEX IF NOT EXISTS idx_agents_owner_user_id ON agents(owner_user_id)",
            "CREATE INDEX IF NOT EXISTS idx_suites_owner_user_id ON suites(owner_user_id)",
        ):
            await conn.execute(text(index_sql))

        # ── Workspaces / teams ──────────────────────────────────────────
        await conn.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL"))
        await conn.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT"))
        await conn.execute(text("ALTER TABLE agents    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL"))
        await conn.execute(text("ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL"))
        await conn.execute(text("ALTER TABLE suites    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL"))
        await conn.execute(text("ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL"))
        for index_sql in (
            "CREATE INDEX IF NOT EXISTS idx_workspaces_owner_user_id        ON workspaces(owner_user_id)",
            "CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id       ON workspace_members(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id  ON workspace_members(workspace_id)",
            "CREATE INDEX IF NOT EXISTS idx_agents_workspace_id             ON agents(workspace_id)",
            "CREATE INDEX IF NOT EXISTS idx_scenarios_workspace_id          ON scenarios(workspace_id)",
            "CREATE INDEX IF NOT EXISTS idx_suites_workspace_id             ON suites(workspace_id)",
            "CREATE INDEX IF NOT EXISTS idx_test_runs_workspace_id          ON test_runs(workspace_id)",
        ):
            await conn.execute(text(index_sql))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS workspace_invites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                token VARCHAR(64) UNIQUE NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'member',
                invited_email VARCHAR(255),
                created_by UUID REFERENCES users(id) ON DELETE SET NULL,
                expires_at TIMESTAMPTZ,
                used_at TIMESTAMPTZ,
                used_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        await conn.execute(text(
            "ALTER TABLE workspace_invites ADD COLUMN IF NOT EXISTS invited_email VARCHAR(255)"
        ))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_id ON workspace_invites(workspace_id)"))

        await conn.run_sync(Base.metadata.create_all)
    scheduler_task = asyncio.create_task(_schedule_loop())
    yield
    scheduler_stop.set()
    if scheduler_task:
        await scheduler_task
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Convenience redirects (people often expect /docs and /openapi.json)
@app.get("/docs", include_in_schema=False)
async def _docs_redirect():
    from fastapi.responses import RedirectResponse

    return RedirectResponse(url="/api/docs")


@app.get("/openapi.json", include_in_schema=False)
async def _openapi_redirect():
    from fastapi.responses import RedirectResponse

    return RedirectResponse(url="/api/openapi.json")

_allow_all = "*" in settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else settings.cors_origins,
    # Browsers forbid wildcard Allow-Origin with credentials.
    allow_credentials=False if _allow_all else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scenarios.router, prefix="/api/scenarios", tags=["scenarios"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(suites.router, prefix="/api/suites", tags=["suites"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(failures.router, prefix="/api/failures", tags=["failures"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(automation.router, prefix="/api/automation", tags=["automation"])
app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"])
app.include_router(invites.router, prefix="/api/invites", tags=["invites"])
app.include_router(dev.router, prefix="/api/dev", tags=["dev"])

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*" if "*" in settings.cors_origins else settings.cors_origins,
)
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
