from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.agent import Agent
from app.models.scenario import Scenario, ScenarioRevision, ScenarioTurn
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioExportResponse,
    ScenarioListResponse,
    ScenarioRevisionListItem,
    ScenarioResponse,
    ScenarioUpdate,
)

router = APIRouter()


def _scenario_snapshot(s: Scenario) -> dict:
    return {
        "name": s.name,
        "description": s.description,
        "agent_module": s.agent_module,
        "agent_class": s.agent_class,
        "llm_model": s.llm_model,
        "judge_model": s.judge_model,
        "agent_args": s.agent_args,
        "chat_history": s.chat_history,
        "mock_tools": s.mock_tools,
        "tags": s.tags,
        "turns": [
            {
                "user_input": t.user_input,
                "expectations": t.expectations,
            }
            for t in s.turns
        ],
    }


def _scenario_snapshot_from_create(data: ScenarioCreate) -> dict:
    return {
        "name": data.name,
        "description": data.description,
        "agent_id": str(data.agent_id) if data.agent_id else None,
        "agent_module": data.agent_module,
        "agent_class": data.agent_class,
        "llm_model": data.llm_model,
        "judge_model": data.judge_model,
        "agent_args": data.agent_args,
        "chat_history": data.chat_history,
        "mock_tools": data.mock_tools,
        "tags": data.tags,
        "turns": [
            {
                "user_input": t.user_input,
                "expectations": [exp.model_dump(exclude_none=True) for exp in t.expectations],
            }
            for t in data.turns
        ],
    }


@router.get("", response_model=list[ScenarioListResponse])
async def list_scenarios(
    current_user: User = Depends(get_current_user),
    tag: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Scenario)
        .options(selectinload(Scenario.turns))
        .where(Scenario.owner_user_id == current_user.id)
        .order_by(Scenario.updated_at.desc())
    )
    if tag:
        query = query.where(Scenario.tags.contains([tag]))
    result = await db.execute(query)
    scenarios = result.scalars().all()
    return [
        ScenarioListResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            agent_id=s.agent_id,
            agent_module=s.agent_module,
            tags=s.tags,
            turn_count=len(s.turns),
            version=s.version,
            owner_user_id=s.owner_user_id,
            owner_display_name=current_user.display_name or current_user.email,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in scenarios
    ]


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(
    scenario_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.turns))
        .where(Scenario.id == scenario_id, Scenario.owner_user_id == current_user.id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.post("", response_model=ScenarioResponse, status_code=201)
async def create_scenario(
    data: ScenarioCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = None
    if data.agent_id:
        agent_res = await db.execute(select(Agent).where(Agent.id == data.agent_id))
        agent = agent_res.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=400, detail="agent_id not found")

    scenario = Scenario(
        name=data.name,
        description=data.description,
        agent_id=data.agent_id,
        owner_user_id=current_user.id,
        agent_module=agent.module if agent else (data.agent_module or "test_agents.interview_agent"),
        agent_class=agent.agent_class if agent else (data.agent_class or "TestableInterviewAgent"),
        llm_model=agent.default_llm_model if agent else (data.llm_model or "gpt-4o-mini"),
        judge_model=agent.default_judge_model if agent else (data.judge_model or "gpt-4o-mini"),
        agent_args=(
            (agent.default_agent_args if agent else None)
            if data.agent_args is None
            else data.agent_args
        ),
        chat_history=data.chat_history,
        mock_tools=data.mock_tools,
        tags=data.tags,
        version=1,
    )
    db.add(scenario)
    await db.flush()

    for i, turn in enumerate(data.turns):
        db.add(
            ScenarioTurn(
                scenario_id=scenario.id,
                turn_index=i,
                user_input=turn.user_input,
                expectations=[exp.model_dump(exclude_none=True) for exp in turn.expectations],
            )
        )

    await db.flush()
    rev = ScenarioRevision(
        scenario_id=scenario.id,
        version=scenario.version,
        snapshot=_scenario_snapshot_from_create(data),
    )
    db.add(rev)

    await db.commit()
    return await get_scenario(scenario.id, current_user, db)


@router.put("/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(
    scenario_id: UUID,
    data: ScenarioUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.turns), selectinload(Scenario.revisions))
        .where(Scenario.id == scenario_id, Scenario.owner_user_id == current_user.id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    update_fields = data.model_dump(exclude_unset=True, exclude={"turns"})
    if "agent_id" in update_fields and update_fields["agent_id"] is None:
        raise HTTPException(status_code=400, detail="agent_id cannot be removed; a scenario must have an agent")
    if "agent_id" in update_fields and update_fields["agent_id"]:
        agent_res = await db.execute(select(Agent).where(Agent.id == update_fields["agent_id"]))
        agent = agent_res.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=400, detail="agent_id not found")
        # Apply agent defaults unless explicitly overridden in update payload
        scenario.agent_id = agent.id
        if data.agent_module is None:
            scenario.agent_module = agent.module
        if data.agent_class is None:
            scenario.agent_class = agent.agent_class
        if data.llm_model is None:
            scenario.llm_model = agent.default_llm_model
        if data.judge_model is None:
            scenario.judge_model = agent.default_judge_model
        if data.agent_args is None:
            scenario.agent_args = agent.default_agent_args
        # Remove fields we handled above
        update_fields.pop("agent_id", None)
        update_fields.pop("agent_module", None)
        update_fields.pop("agent_class", None)
        update_fields.pop("llm_model", None)
        update_fields.pop("judge_model", None)
        update_fields.pop("agent_args", None)

    for field, value in update_fields.items():
        setattr(scenario, field, value)

    if data.turns is not None:
        for turn in scenario.turns:
            await db.delete(turn)
        await db.flush()
        for i, turn in enumerate(data.turns):
            db.add(
                ScenarioTurn(
                    scenario_id=scenario.id,
                    turn_index=i,
                    user_input=turn.user_input,
                    expectations=[exp.model_dump(exclude_none=True) for exp in turn.expectations],
                )
            )

    scenario.version = (scenario.version or 1) + 1
    await db.flush()
    db.add(
        ScenarioRevision(
            scenario_id=scenario.id,
            version=scenario.version,
            snapshot=_scenario_snapshot(scenario),
        )
    )

    await db.commit()
    return await get_scenario(scenario_id, current_user, db)


@router.get("/{scenario_id}/export", response_model=ScenarioExportResponse)
async def export_scenario(
    scenario_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scenario = await get_scenario(scenario_id, current_user, db)
    return ScenarioExportResponse(
        version=scenario.version,
        scenario=ScenarioCreate(
            name=scenario.name,
            description=scenario.description,
            agent_id=scenario.agent_id,
            agent_module=scenario.agent_module,
            agent_class=scenario.agent_class,
            llm_model=scenario.llm_model,
            judge_model=scenario.judge_model,
            agent_args=scenario.agent_args,
            chat_history=scenario.chat_history,
            mock_tools=scenario.mock_tools,
            tags=scenario.tags,
            turns=[
                {"user_input": t.user_input, "expectations": t.expectations}
                for t in scenario.turns
            ],
        ),
    )


@router.get("/{scenario_id}/versions", response_model=list[ScenarioRevisionListItem])
async def list_versions(
    scenario_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Ensure scenario is owned by current user.
    _ = await get_scenario(scenario_id, current_user, db)
    result = await db.execute(
        select(ScenarioRevision)
        .where(ScenarioRevision.scenario_id == scenario_id)
        .order_by(ScenarioRevision.version.desc())
        .limit(50)
    )
    revs = result.scalars().all()
    return [ScenarioRevisionListItem(version=r.version, created_at=r.created_at) for r in revs]


@router.post("/import", response_model=ScenarioResponse, status_code=201)
async def import_scenario(
    data: ScenarioCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Reuse create path, but keep scenario name from payload
    return await create_scenario(data, current_user, db)


@router.delete("/{scenario_id}", status_code=204)
async def delete_scenario(
    scenario_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id, Scenario.owner_user_id == current_user.id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    await db.delete(scenario)
    await db.commit()
