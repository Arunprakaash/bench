"""
Public invite-link endpoints.

POST /api/workspaces/{id}/invites  — generate a shareable invite token (owner only)
GET  /api/invites/{token}          — get invite info (public, no auth)
POST /api/invites/{token}/accept   — accept invite (auth required)
"""
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import assert_workspace_member
from app.api.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_invite import WorkspaceInvite
from app.models.workspace_members import WorkspaceMember

router = APIRouter()


class InviteCreateRequest(BaseModel):
    role: str = "member"


class InviteTokenResponse(BaseModel):
    token: str
    role: str
    expires_at: datetime | None
    created_at: datetime


class InviteInfoResponse(BaseModel):
    token: str
    workspace_id: UUID
    workspace_name: str
    role: str
    expires_at: datetime | None


# ── Generate invite link ────────────────────────────────────────────────────

@router.post("/workspaces/{workspace_id}", response_model=InviteTokenResponse)
async def create_invite(
    workspace_id: UUID,
    data: InviteCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    caller = await assert_workspace_member(workspace_id, current_user.id, db)
    if caller.role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owners can generate invite links.")

    workspace = await db.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    role = data.role if data.role in ("owner", "member") else "member"
    token = secrets.token_urlsafe(32)

    invite = WorkspaceInvite(
        workspace_id=workspace_id,
        token=token,
        role=role,
        created_by=current_user.id,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    return InviteTokenResponse(
        token=invite.token,
        role=invite.role,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
    )


# ── Get invite info (public) ────────────────────────────────────────────────

@router.get("/{token}", response_model=InviteInfoResponse)
async def get_invite_info(token: str, db: AsyncSession = Depends(get_db)):
    invite = await _get_valid_invite(token, db)
    workspace = await db.get(Workspace, invite.workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace no longer exists.")

    return InviteInfoResponse(
        token=invite.token,
        workspace_id=invite.workspace_id,
        workspace_name=workspace.name,
        role=invite.role,
        expires_at=invite.expires_at,
    )


# ── Accept invite (auth required) ──────────────────────────────────────────

@router.post("/{token}/accept")
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    invite = await _get_valid_invite(token, db)

    # Already a member?
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == invite.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        return {"workspace_id": str(invite.workspace_id), "already_member": True}

    member = WorkspaceMember(
        workspace_id=invite.workspace_id,
        user_id=current_user.id,
        role=invite.role,
    )
    db.add(member)

    invite.used_at = datetime.now(timezone.utc)
    invite.used_by_user_id = current_user.id
    await db.commit()

    return {"workspace_id": str(invite.workspace_id), "already_member": False}


# ── Helper ──────────────────────────────────────────────────────────────────

async def _get_valid_invite(token: str, db: AsyncSession) -> WorkspaceInvite:
    result = await db.execute(select(WorkspaceInvite).where(WorkspaceInvite.token == token))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite link is invalid or has expired.")
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This invite link has expired.")
    return invite
