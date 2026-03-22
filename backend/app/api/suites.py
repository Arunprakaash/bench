from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete as sa_delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.access import assert_workspace_member, get_user_workspace_ids, ownership_filter
from app.api.auth import get_current_user
from app.models.scenario import Scenario
from app.models.suite import Suite, suite_scenarios
from app.models.user import User
from app.schemas.suite import SuiteCreate, SuiteListResponse, SuiteResponse, SuiteUpdate

router = APIRouter()


async def _load_suite_response(
    suite_id: UUID,
    current_user: User,
    db: AsyncSession,
) -> SuiteResponse:
    from app.models.scenario import ScenarioTurn

    result = await db.execute(
        select(Suite)
        .options(selectinload(Suite.scenarios).selectinload(Scenario.turns))
        .where(Suite.id == suite_id)
    )
    suite = result.scalar_one_or_none()
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")

    return SuiteResponse(
        id=suite.id,
        name=suite.name,
        description=suite.description,
        scenarios=[
            {
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "agent_id": s.agent_id,
                "agent_module": s.agent_module,
                "tags": s.tags,
                "turn_count": len(s.turns),
                "version": s.version,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
            }
            for s in suite.scenarios
        ],
        created_at=suite.created_at,
        updated_at=suite.updated_at,
    )


@router.get("", response_model=list[SuiteListResponse])
async def list_suites(
    workspace_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wids = await get_user_workspace_ids(current_user.id, db)
    query = (
        select(Suite)
        .options(selectinload(Suite.scenarios))
        .where(ownership_filter(Suite, current_user.id, wids))
        .order_by(Suite.updated_at.desc())
    )
    if workspace_id:
        query = query.where(Suite.workspace_id == workspace_id)
    result = await db.execute(query)
    suites = result.scalars().all()
    return [
        SuiteListResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            scenario_count=len(s.scenarios),
            scenario_ids=[sc.id for sc in s.scenarios],
            owner_user_id=s.owner_user_id,
            owner_display_name=current_user.display_name or current_user.email,
            workspace_id=s.workspace_id,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in suites
    ]


@router.get("/{suite_id}", response_model=SuiteResponse)
async def get_suite(
    suite_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Allow workspace members to fetch a suite they can see.
    wids = await get_user_workspace_ids(current_user.id, db)
    result = await db.execute(
        select(Suite)
        .options(selectinload(Suite.scenarios))
        .where(Suite.id == suite_id, ownership_filter(Suite, current_user.id, wids))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Suite not found")
    return await _load_suite_response(suite_id, current_user, db)


@router.post("", response_model=SuiteResponse, status_code=201)
async def create_suite(
    data: SuiteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.workspace_id:
        await assert_workspace_member(data.workspace_id, current_user.id, db)

    suite = Suite(name=data.name, description=data.description, owner_user_id=current_user.id, workspace_id=data.workspace_id)
    db.add(suite)
    await db.flush()

    if data.scenario_ids:
        from app.models.scenario import Scenario
        wids = await get_user_workspace_ids(current_user.id, db)
        res = await db.execute(
            select(Scenario.id).where(Scenario.id.in_(data.scenario_ids), ownership_filter(Scenario, current_user.id, wids))
        )
        owned_ids = set(res.scalars().all())
        missing = [sid for sid in data.scenario_ids if sid not in owned_ids]
        if missing:
            raise HTTPException(status_code=400, detail="Some scenario_ids are not accessible to you")
        await db.execute(
            insert(suite_scenarios),
            [
                {"suite_id": suite.id, "scenario_id": sid}
                for sid in data.scenario_ids
            ],
        )

    await db.commit()
    return await _load_suite_response(suite.id, current_user, db)


@router.put("/{suite_id}", response_model=SuiteResponse)
async def update_suite(
    suite_id: UUID,
    data: SuiteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wids = await get_user_workspace_ids(current_user.id, db)
    result = await db.execute(
        select(Suite).options(selectinload(Suite.scenarios)).where(Suite.id == suite_id, ownership_filter(Suite, current_user.id, wids))
    )
    suite = result.scalar_one_or_none()
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")

    if data.name is not None:
        suite.name = data.name
    if data.description is not None:
        suite.description = data.description

    if data.scenario_ids is not None:
        from app.models.scenario import Scenario
        if data.scenario_ids:
            wids = await get_user_workspace_ids(current_user.id, db)
            res = await db.execute(
                select(Scenario.id).where(
                    Scenario.id.in_(data.scenario_ids),
                    ownership_filter(Scenario, current_user.id, wids),
                )
            )
            owned_ids = set(res.scalars().all())
            missing = [sid for sid in data.scenario_ids if sid not in owned_ids]
            if missing:
                raise HTTPException(status_code=400, detail="Some scenario_ids are not accessible to you")
        await db.execute(
            sa_delete(suite_scenarios).where(suite_scenarios.c.suite_id == suite_id)
        )
        if data.scenario_ids:
            await db.execute(
                insert(suite_scenarios),
                [
                    {"suite_id": suite_id, "scenario_id": sid}
                    for sid in data.scenario_ids
                ],
            )

    await db.commit()
    return await _load_suite_response(suite_id, current_user, db)


@router.delete("/{suite_id}", status_code=204)
async def delete_suite(
    suite_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Delete is owner-only even for workspace suites.
    result = await db.execute(select(Suite).where(Suite.id == suite_id, Suite.owner_user_id == current_user.id))
    suite = result.scalar_one_or_none()
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")
    await db.delete(suite)
    await db.commit()
