import asyncio
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import async_session, get_db
from app.api.auth import get_current_user
from app.models.scenario import Scenario
from app.models.suite import Suite
from app.models.test_run import RunStatus, TestRun
from app.models.user import User
from app.runner.executor import execute_scenario
from app.schemas.test_run import RunCreate, SuiteRunCreate, TestRunListResponse, TestRunResponse

router = APIRouter()


@router.get("", response_model=list[TestRunListResponse])
async def list_runs(
    scenario_id: UUID | None = None,
    suite_id: UUID | None = None,
    agent_id: UUID | None = None,
    status: RunStatus | None = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(TestRun, User.display_name, User.email)
        .outerjoin(User, User.id == TestRun.owner_user_id)
        .options(selectinload(TestRun.scenario), selectinload(TestRun.turn_results))
        .where(TestRun.owner_user_id == current_user.id)
        .order_by(TestRun.created_at.desc())
        .limit(limit)
    )
    if scenario_id:
        query = query.where(TestRun.scenario_id == scenario_id)
    if suite_id:
        query = query.where(TestRun.suite_id == suite_id)
    if agent_id is not None:
        query = query.where(TestRun.agent_id == agent_id)
    if status:
        query = query.where(TestRun.status == status)

    result = await db.execute(query)
    rows = result.all()

    return [
        TestRunListResponse(
            id=run.id,
            scenario_id=run.scenario_id,
            scenario_name=run.scenario.name if run.scenario else None,
            owner_user_id=run.owner_user_id,
            owner_display_name=display_name or email,
            suite_id=run.suite_id,
            agent_id=run.agent_id,
            agent_version_id=run.agent_version_id,
            status=run.status,
            duration_ms=run.duration_ms,
            passed_turns=sum(1 for tr in run.turn_results if tr.passed),
            total_turns=len(run.turn_results),
            created_at=run.created_at,
        )
        for run, display_name, email in rows
    ]


@router.get("/{run_id}", response_model=TestRunResponse)
async def get_run(run_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TestRun)
        .options(
            selectinload(TestRun.turn_results),
            selectinload(TestRun.run_evaluation),
        )
        .where(TestRun.id == run_id, TestRun.owner_user_id == current_user.id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return run


@router.post("", response_model=TestRunResponse, status_code=201)
async def create_run(
    data: RunCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.turns))
        .where(Scenario.id == data.scenario_id, Scenario.owner_user_id == current_user.id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    test_run = TestRun(
        scenario_id=scenario.id,
        suite_id=None,
        agent_id=scenario.agent_id,
        owner_user_id=current_user.id,
        status=RunStatus.PENDING,
        config=data.config,
    )
    db.add(test_run)
    await db.commit()
    await db.refresh(test_run)

    # Execute directly so callers can rely on immediate run completion.
    await execute_scenario(test_run.id, db)

    # Call get_run with explicit injected args; don't pass `db` positionally.
    return await get_run(test_run.id, current_user=current_user, db=db)


@router.post("/suite", response_model=list[TestRunListResponse], status_code=201)
async def create_suite_run(
    data: SuiteRunCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Suite)
        .options(selectinload(Suite.scenarios).selectinload(Scenario.turns))
        .where(Suite.id == data.suite_id, Suite.owner_user_id == current_user.id)
    )
    suite = result.scalar_one_or_none()
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")

    run_objs = []
    for scenario in suite.scenarios:
        test_run = TestRun(
            scenario_id=scenario.id,
            suite_id=suite.id,
            agent_id=scenario.agent_id,
            owner_user_id=current_user.id,
            status=RunStatus.PENDING,
            config=data.config,
        )
        db.add(test_run)
        run_objs.append(test_run)

    await db.commit()

    ids = [r.id for r in run_objs]
    background_tasks.add_task(_run_suite_parallel, ids, str(suite.id))

    result = await db.execute(
        select(TestRun, User.display_name, User.email)
        .outerjoin(User, User.id == TestRun.owner_user_id)
        .options(selectinload(TestRun.scenario), selectinload(TestRun.turn_results))
        .where(TestRun.id.in_(ids))
    )
    rows = result.all()

    return [
        TestRunListResponse(
            id=run.id,
            scenario_id=run.scenario_id,
            scenario_name=run.scenario.name if run.scenario else None,
            owner_user_id=run.owner_user_id,
            owner_display_name=display_name or email,
            suite_id=run.suite_id,
            agent_id=run.agent_id,
            agent_version_id=run.agent_version_id,
            status=run.status,
            duration_ms=run.duration_ms,
            passed_turns=sum(1 for tr in run.turn_results if tr.passed),
            total_turns=len(run.turn_results),
            created_at=run.created_at,
        )
        for run, display_name, email in rows
    ]


async def _run_single_scenario(run_id: UUID, suite_id: str):
    """Execute a single scenario with its own DB session and emit progress."""
    import logging

    from app.main import sio

    logger = logging.getLogger(__name__)

    async with async_session() as db:
        await sio.emit("suite:scenario:start", {
            "suite_id": suite_id,
            "run_id": str(run_id),
        })

        try:
            await execute_scenario(run_id, db)
        except Exception as e:
            logger.exception("Run %s failed: %s", run_id, e)
            # Mark run as ERROR in a fresh session (current session may be invalid)
            run = None
            async with async_session() as db2:
                result = await db2.execute(
                    select(TestRun)
                    .options(selectinload(TestRun.turn_results))
                    .where(TestRun.id == run_id)
                )
                run = result.scalar_one_or_none()
                if run:
                    run.status = RunStatus.ERROR
                    run.error_message = f"{type(e).__name__}: {str(e)}"
                    run.completed_at = datetime.now(timezone.utc)
                    if run.started_at:
                        delta = (run.completed_at - run.started_at).total_seconds() * 1000
                        run.duration_ms = delta
                    await db2.commit()
                    await db2.refresh(run)

            # Emit so UI updates; use same shape as success path
            await sio.emit("suite:scenario:done", {
                "suite_id": suite_id,
                "run_id": str(run_id),
                "status": RunStatus.ERROR.value,
                "duration_ms": run.duration_ms if run else None,
                "passed_turns": sum(1 for tr in run.turn_results if tr.passed) if run else 0,
                "total_turns": len(run.turn_results) if run else 0,
            })
            return

        result = await db.execute(
            select(TestRun)
            .options(selectinload(TestRun.turn_results))
            .where(TestRun.id == run_id)
        )
        run = result.scalar_one()

        await sio.emit("suite:scenario:done", {
            "suite_id": suite_id,
            "run_id": str(run_id),
            "status": run.status.value,
            "duration_ms": run.duration_ms,
            "passed_turns": sum(1 for tr in run.turn_results if tr.passed),
            "total_turns": len(run.turn_results),
        })


async def _run_suite_parallel(run_ids: list[UUID], suite_id: str):
    """Execute all scenarios in parallel and emit suite completion."""
    from app.main import sio

    await sio.emit("suite:start", {"suite_id": suite_id, "total": len(run_ids)})

    tasks = [_run_single_scenario(rid, suite_id) for rid in run_ids]
    await asyncio.gather(*tasks, return_exceptions=True)

    await sio.emit("suite:done", {"suite_id": suite_id})


@router.delete("/{run_id}", status_code=204)
async def delete_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TestRun).where(TestRun.id == run_id, TestRun.owner_user_id == current_user.id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    await db.delete(run)
    await db.commit()
