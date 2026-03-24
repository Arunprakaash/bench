from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.access import get_user_workspace_ids, ownership_filter
from app.api.auth import get_current_user
from app.models.user import User
from app.models.test_run import RunStatus, TestRun
from app.schemas.failure import FailureInboxItem

router = APIRouter()


def _first_failure_summary(run: TestRun) -> dict:
    for tr in run.turn_results:
        is_fail = tr.passed is False or (tr.error_message is not None)
        if not is_fail:
            continue

        reasoning = None
        if tr.judge_verdicts:
            for v in tr.judge_verdicts:
                if not v.get("passed", True):
                    reasoning = v.get("reasoning")
                    break

        return {
            "first_failed_turn_index": tr.turn_index,
            "first_failed_user_input": tr.user_input,
            "first_failed_reasoning": reasoning,
            "first_failed_error": tr.error_message,
        }

    if run.error_message:
        return {"first_failed_error": run.error_message}

    return {}


@router.get("", response_model=list[FailureInboxItem])
async def list_failures(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    suite_id: UUID | None = None,
    scenario_id: UUID | None = None,
    agent_id: UUID | None = None,
    workspace_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    wids = await get_user_workspace_ids(current_user.id, db)
    query = (
        select(TestRun, User.display_name, User.email)
        .outerjoin(User, User.id == TestRun.owner_user_id)
        .options(selectinload(TestRun.scenario), selectinload(TestRun.turn_results))
        .where(ownership_filter(TestRun, current_user.id, wids))
        .where(TestRun.status.in_([RunStatus.FAILED, RunStatus.ERROR]))
        .order_by(TestRun.created_at.desc())
        .limit(limit)
    )
    if workspace_id:
        query = query.where(TestRun.workspace_id == workspace_id)
    if suite_id:
        query = query.where(TestRun.suite_id == suite_id)
    if scenario_id:
        query = query.where(TestRun.scenario_id == scenario_id)
    if agent_id is not None:
        query = query.where(TestRun.agent_id == agent_id)

    result = await db.execute(query)
    rows = result.all()

    items: list[FailureInboxItem] = []
    for r, display_name, email in rows:
        summary = _first_failure_summary(r)
        items.append(
            FailureInboxItem(
                run_id=r.id,
                scenario_id=r.scenario_id,
                scenario_name=r.scenario.name if r.scenario else None,
                owner_user_id=r.owner_user_id,
                owner_display_name=display_name or email,
                suite_id=r.suite_id,
                agent_id=r.agent_id,
                status=r.status,
                created_at=r.created_at,
                duration_ms=r.duration_ms,
                **summary,
            )
        )
    return items

