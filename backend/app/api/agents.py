from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.schema import derive_arg_schema
from app.api.auth import get_current_user
from app.database import get_db
from app.models.agent import Agent
from app.models.user import User
from app.schemas.agent import AgentCreate, AgentListItem, AgentResponse, AgentUpdate

router = APIRouter()


@router.get("", response_model=list[AgentListItem])
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Agent).where(Agent.owner_user_id == current_user.id).order_by(Agent.updated_at.desc())
    result = await db.execute(query)
    items = result.scalars().all()
    return [
        AgentListItem(
            id=a.id,
            name=a.name,
            description=a.description,
            module=a.module,
            agent_class=a.agent_class,
            tags=a.tags,
            owner_user_id=a.owner_user_id,
            owner_display_name=current_user.display_name or current_user.email,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in items
    ]


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


def _derive_and_set_arg_schema(agent: Agent) -> None:
    """Compute arg_schema from agent module/class and set on model (not persisted here)."""
    schema = derive_arg_schema(agent.module, agent.agent_class)
    agent.arg_schema = schema


@router.get("/{agent_id}/arg-schema")
async def get_agent_arg_schema(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the agent constructor arg schema for UI form generation (derived from module/class)."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == current_user.id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    schema = agent.arg_schema
    if schema is None:
        schema = derive_arg_schema(agent.module, agent.agent_class)
    return {"arg_schema": schema}


@router.post("", response_model=AgentResponse, status_code=201)
async def create_agent(
    data: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = Agent(
        name=data.name,
        description=data.description,
        module=data.module,
        agent_class=data.agent_class,
        default_llm_model=data.default_llm_model,
        default_judge_model=data.default_judge_model,
        default_agent_args=data.default_agent_args,
        tags=data.tags,
        owner_user_id=current_user.id,
    )
    _derive_and_set_arg_schema(agent)
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    data: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == current_user.id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    if "module" in data.model_dump(exclude_unset=True) or "agent_class" in data.model_dump(exclude_unset=True):
        _derive_and_set_arg_schema(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.owner_user_id == current_user.id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await db.commit()

