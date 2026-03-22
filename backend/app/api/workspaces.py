import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.access import assert_owner, assert_workspace_member
from app.api.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_invite import WorkspaceInvite
from app.models.workspace_members import WorkspaceMember
from app.schemas.workspace import (
    InviteMemberRequest,
    WorkspaceCreate,
    WorkspaceListItem,
    WorkspaceMemberResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)

router = APIRouter()


async def _load_workspace(workspace_id: UUID, db: AsyncSession) -> Workspace:
    result = await db.execute(
        select(Workspace)
        .options(selectinload(Workspace.members).selectinload(WorkspaceMember.user))
        .where(Workspace.id == workspace_id)
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


def _member_role(ws: Workspace, user_id: UUID) -> str:
    for m in ws.members:
        if m.user_id == user_id:
            return m.role
    return "member"


def _to_response(ws: Workspace, current_user_id: UUID) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=ws.id,
        name=ws.name,
        description=ws.description,
        owner_user_id=ws.owner_user_id,
        my_role=_member_role(ws, current_user_id),
        members=[
            WorkspaceMemberResponse(
                user_id=m.user_id,
                email=m.user.email,
                display_name=m.user.display_name,
                role=m.role,
                joined_at=m.created_at,
            )
            for m in ws.members
        ],
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


@router.get("", response_model=list[WorkspaceListItem])
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all workspaces the current user belongs to."""
    result = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(Workspace.created_at.desc())
    )
    rows = result.all()

    items = []
    for ws, role in rows:
        count_result = await db.execute(
            select(WorkspaceMember).where(WorkspaceMember.workspace_id == ws.id)
        )
        member_count = len(count_result.scalars().all())
        items.append(
            WorkspaceListItem(
                id=ws.id,
                name=ws.name,
                description=ws.description,
                my_role=role or "member",
                member_count=member_count,
                created_at=ws.created_at,
                updated_at=ws.updated_at,
            )
        )
    return items


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workspace; the creator becomes its owner."""
    ws = Workspace(
        name=data.name,
        description=data.description,
        owner_user_id=current_user.id,
    )
    db.add(ws)
    await db.flush()

    member = WorkspaceMember(workspace_id=ws.id, user_id=current_user.id, role="owner")
    db.add(member)
    await db.commit()

    ws = await _load_workspace(ws.id, db)
    return _to_response(ws, current_user.id)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ws = await _load_workspace(workspace_id, db)
    await assert_workspace_member(workspace_id, current_user.id, db)
    return _to_response(ws, current_user.id)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID,
    data: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ws = await _load_workspace(workspace_id, db)
    assert_owner(ws, current_user.id, "Only the workspace owner can update it.")
    if data.name is not None:
        ws.name = data.name
    if data.description is not None:
        ws.description = data.description
    await db.commit()
    ws = await _load_workspace(workspace_id, db)
    return _to_response(ws, current_user.id)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ws = await _load_workspace(workspace_id, db)
    assert_owner(ws, current_user.id, "Only the workspace owner can delete it.")
    await db.delete(ws)
    await db.commit()


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
async def list_members(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await assert_workspace_member(workspace_id, current_user.id, db)
    result = await db.execute(
        select(WorkspaceMember, User.email, User.display_name)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.created_at)
    )
    return [
        WorkspaceMemberResponse(
            user_id=m.user_id,
            email=email,
            display_name=display_name,
            role=m.role,
            joined_at=m.created_at,
        )
        for m, email, display_name in result.all()
    ]


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=201)
async def add_member(
    workspace_id: UUID,
    data: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a user by email. Only workspace owners can invite."""
    # Caller must be owner
    caller = await assert_workspace_member(workspace_id, current_user.id, db)
    if caller.role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owners can invite members.")

    # Validate workspace exists
    ws_result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    if not ws_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Find user by email
    user_result = await db.execute(
        select(User).where(User.email == data.email.lower().strip())
    )
    invitee = user_result.scalar_one_or_none()
    if not invitee:
        raise HTTPException(status_code=404, detail=f"No user found with email '{data.email}'.")

    # Prevent duplicate membership
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == invitee.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member of this workspace.")

    role = data.role if data.role in ("owner", "member") else "member"
    member = WorkspaceMember(workspace_id=workspace_id, user_id=invitee.id, role=role)
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return WorkspaceMemberResponse(
        user_id=invitee.id,
        email=invitee.email,
        display_name=invitee.display_name,
        role=member.role,
        joined_at=member.created_at,
    )


@router.delete("/{workspace_id}/members/{user_id}", status_code=204)
async def remove_member(
    workspace_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member. Owners can remove anyone; members can only remove themselves."""
    caller = await assert_workspace_member(workspace_id, current_user.id, db)

    if caller.role != "owner" and user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only workspace owners can remove other members.")

    # Prevent owner from removing themselves if they're the only owner
    if user_id == current_user.id and caller.role == "owner":
        owners_result = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.role == "owner",
            )
        )
        if len(owners_result.scalars().all()) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last owner. Transfer ownership first.")

    target_result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found.")

    await db.delete(target)
    await db.commit()


class WorkspaceInviteRequest(BaseModel):
    email: str
    role: str = "member"


@router.get("/{workspace_id}/invites")
async def list_workspace_invites(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await assert_workspace_member(workspace_id, current_user.id, db)
    from datetime import datetime, timezone
    from app.models.workspace_invite import WorkspaceInvite
    from app.config import settings

    result = await db.execute(
        select(WorkspaceInvite)
        .where(
            WorkspaceInvite.workspace_id == workspace_id,
            WorkspaceInvite.used_at.is_(None),
        )
        .order_by(WorkspaceInvite.created_at.desc())
    )
    invites = result.scalars().all()
    now = datetime.now(timezone.utc)
    return [
        {
            "token": inv.token,
            "role": inv.role,
            "invited_email": inv.invited_email,
            "invite_url": f"{settings.app_base_url}/invite/{inv.token}",
            "created_at": inv.created_at,
            "expires_at": inv.expires_at,
            "expired": bool(inv.expires_at and inv.expires_at < now),
        }
        for inv in invites
    ]


@router.delete("/{workspace_id}/invites/{token}", status_code=204)
async def revoke_workspace_invite(
    workspace_id: UUID,
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.workspace_invite import WorkspaceInvite

    caller = await assert_workspace_member(workspace_id, current_user.id, db)
    if caller.role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owners can revoke invites.")

    result = await db.execute(
        select(WorkspaceInvite).where(
            WorkspaceInvite.workspace_id == workspace_id,
            WorkspaceInvite.token == token,
        )
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")
    await db.delete(invite)
    await db.commit()


@router.post("/{workspace_id}/invites")
async def create_workspace_invite(
    workspace_id: UUID,
    data: WorkspaceInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.email import invite_email, send_email
    from app.config import settings

    caller = await assert_workspace_member(workspace_id, current_user.id, db)
    if caller.role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owners can generate invite links.")

    workspace = await db.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    role = data.role if data.role in ("owner", "member") else "member"
    token = secrets.token_urlsafe(32)
    invite = WorkspaceInvite(workspace_id=workspace_id, token=token, role=role, created_by=current_user.id, invited_email=data.email.strip().lower())
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    invite_url = f"{settings.app_base_url}/invite/{token}"
    inviter_name = current_user.display_name or current_user.email
    subject, html, plain = invite_email(workspace.name, role, invite_url, inviter_name)
    email_sent = await send_email(data.email.strip(), subject, html, plain)

    return {"token": invite.token, "invite_url": invite_url, "email_sent": email_sent}
