import asyncio
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth import get_current_user
from app.database import async_session, get_db
from app.models.automation import RegressionAlert, ScheduledRun, ScheduleTargetType
from app.models.scenario import Scenario
from app.models.suite import Suite
from app.models.test_run import RunStatus, TestRun
from app.models.user import User
from app.runner.executor import execute_scenario
from app.schemas.automation import (
    RegressionAlertResponse,
    ScheduledRunCreate,
    ScheduledRunResponse,
    ScheduledRunUpdate,
)

router = APIRouter()


async def _create_regression_alert_if_needed(db: AsyncSession, run: TestRun):
    if run.status not in (RunStatus.FAILED, RunStatus.ERROR):
        return

    prev_result = await db.execute(
        select(TestRun)
        .where(
            TestRun.owner_user_id == run.owner_user_id,
            TestRun.scenario_id == run.scenario_id,
            TestRun.id != run.id,
        )
        .order_by(TestRun.created_at.desc())
        .limit(1)
    )
    prev = prev_result.scalar_one_or_none()
    if not prev or prev.status != RunStatus.PASSED:
        return

    alert = RegressionAlert(
        owner_user_id=run.owner_user_id,
        scenario_id=run.scenario_id,
        run_id=run.id,
        previous_run_id=prev.id,
        title="Regression detected",
        detail=f"Scenario regressed from {prev.status.value} to {run.status.value}.",
        is_acknowledged=False,
    )
    db.add(alert)
    await db.commit()


async def _execute_single_scheduled_run(run_id: UUID):
    async with async_session() as db:
        await execute_scenario(run_id, db)
        result = await db.execute(select(TestRun).where(TestRun.id == run_id))
        run = result.scalar_one_or_none()
        if run:
            await _create_regression_alert_if_needed(db, run)


async def _execute_suite_scheduled_run(run_ids: list[UUID]):
    await asyncio.gather(*[_execute_single_scheduled_run(run_id) for run_id in run_ids], return_exceptions=True)


@router.get("/schedules", response_model=list[ScheduledRunResponse])
async def list_schedules(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScheduledRun)
        .where(ScheduledRun.owner_user_id == current_user.id)
        .order_by(ScheduledRun.created_at.desc())
    )
    return result.scalars().all()


@router.post("/schedules", response_model=ScheduledRunResponse, status_code=201)
async def create_schedule(
    data: ScheduledRunCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.target_type == ScheduleTargetType.SCENARIO and not data.scenario_id:
        raise HTTPException(status_code=400, detail="scenario_id is required for scenario schedules")
    if data.target_type == ScheduleTargetType.SUITE and not data.suite_id:
        raise HTTPException(status_code=400, detail="suite_id is required for suite schedules")

    if data.scenario_id:
        scenario = (
            await db.execute(
                select(Scenario).where(Scenario.id == data.scenario_id, Scenario.owner_user_id == current_user.id)
            )
        ).scalar_one_or_none()
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
    if data.suite_id:
        suite = (await db.execute(select(Suite).where(Suite.id == data.suite_id, Suite.owner_user_id == current_user.id))).scalar_one_or_none()
        if not suite:
            raise HTTPException(status_code=404, detail="Suite not found")

    now = datetime.now(timezone.utc)
    schedule = ScheduledRun(
        owner_user_id=current_user.id,
        target_type=data.target_type,
        scenario_id=data.scenario_id,
        suite_id=data.suite_id,
        interval_minutes=data.interval_minutes,
        config=data.config,
        is_active=data.is_active,
        next_run_at=now + timedelta(minutes=data.interval_minutes),
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.get("/schedules/{schedule_id}", response_model=ScheduledRunResponse)
async def get_schedule(
    schedule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    schedule = (
        await db.execute(
            select(ScheduledRun).where(ScheduledRun.id == schedule_id, ScheduledRun.owner_user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.put("/schedules/{schedule_id}", response_model=ScheduledRunResponse)
async def update_schedule(
    schedule_id: UUID,
    data: ScheduledRunUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    schedule = (
        await db.execute(
            select(ScheduledRun).where(ScheduledRun.id == schedule_id, ScheduledRun.owner_user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if data.interval_minutes is not None:
        schedule.interval_minutes = data.interval_minutes
        schedule.next_run_at = datetime.now(timezone.utc) + timedelta(minutes=data.interval_minutes)
    if data.config is not None:
        schedule.config = data.config
    if data.is_active is not None:
        schedule.is_active = data.is_active

    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete("/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    schedule = (
        await db.execute(select(ScheduledRun).where(ScheduledRun.id == schedule_id, ScheduledRun.owner_user_id == current_user.id))
    ).scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await db.delete(schedule)
    await db.commit()


@router.get("/alerts", response_model=list[RegressionAlertResponse])
async def list_alerts(
    acknowledged: bool | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(RegressionAlert)
        .where(RegressionAlert.owner_user_id == current_user.id)
        .order_by(RegressionAlert.created_at.desc())
        .limit(200)
    )
    if acknowledged is not None:
        query = query.where(RegressionAlert.is_acknowledged == acknowledged)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/alerts/{alert_id}/ack", response_model=RegressionAlertResponse)
async def acknowledge_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = (
        await db.execute(
            select(RegressionAlert).where(RegressionAlert.id == alert_id, RegressionAlert.owner_user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_acknowledged = True
    await db.commit()
    await db.refresh(alert)
    return alert


async def process_due_schedules():
    async with async_session() as db:
        now = datetime.now(timezone.utc)
        due_result = await db.execute(
            select(ScheduledRun)
            .where(
                ScheduledRun.is_active.is_(True),
                ScheduledRun.next_run_at <= now,
            )
            .order_by(ScheduledRun.next_run_at.asc())
            .limit(50)
        )
        due = due_result.scalars().all()
        if not due:
            return

        for schedule in due:
            if schedule.target_type == ScheduleTargetType.SCENARIO and schedule.scenario_id:
                scenario = (
                    await db.execute(
                        select(Scenario).where(
                            Scenario.id == schedule.scenario_id,
                            Scenario.owner_user_id == schedule.owner_user_id,
                        )
                    )
                ).scalar_one_or_none()
                if scenario:
                    run = TestRun(
                        scenario_id=scenario.id,
                        suite_id=None,
                        agent_id=scenario.agent_id,
                        owner_user_id=schedule.owner_user_id,
                        status=RunStatus.PENDING,
                        config=schedule.config,
                    )
                    db.add(run)
                    await db.commit()
                    await db.refresh(run)
                    asyncio.create_task(_execute_single_scheduled_run(run.id))

            if schedule.target_type == ScheduleTargetType.SUITE and schedule.suite_id:
                suite = (
                    await db.execute(
                        select(Suite)
                        .options(selectinload(Suite.scenarios))
                        .where(Suite.id == schedule.suite_id, Suite.owner_user_id == schedule.owner_user_id)
                    )
                ).scalar_one_or_none()
                if suite:
                    run_ids: list[UUID] = []
                    for scenario in suite.scenarios:
                        run = TestRun(
                            scenario_id=scenario.id,
                            suite_id=suite.id,
                            agent_id=scenario.agent_id,
                            owner_user_id=schedule.owner_user_id,
                            status=RunStatus.PENDING,
                            config=schedule.config,
                        )
                        db.add(run)
                        await db.flush()
                        run_ids.append(run.id)
                    await db.commit()
                    asyncio.create_task(_execute_suite_scheduled_run(run_ids))

            schedule.last_run_at = now
            schedule.next_run_at = now + timedelta(minutes=schedule.interval_minutes)
            db.add(schedule)
            await db.commit()

