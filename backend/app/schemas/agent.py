from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str
    description: str | None = None
    module: str
    agent_class: str
    provider_type: str = "local_python"
    connection_config: dict | None = None
    capabilities: dict | None = None
    auth_config: dict | None = None
    default_llm_model: str = "gpt-4o-mini"
    default_judge_model: str = "gpt-4o-mini"
    default_agent_args: dict | None = None
    tags: list[str] | None = Field(default=None)


class AgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    module: str | None = None
    agent_class: str | None = None
    provider_type: str | None = None
    connection_config: dict | None = None
    capabilities: dict | None = None
    auth_config: dict | None = None
    default_llm_model: str | None = None
    default_judge_model: str | None = None
    default_agent_args: dict | None = None
    tags: list[str] | None = None


class ArgSchemaField(BaseModel):
    """One field in the agent constructor arg schema for UI form generation."""

    name: str
    type: str  # string, integer, number, boolean, array, object
    required: bool = False
    default: str | int | float | bool | None = None


class AgentResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    module: str
    agent_class: str
    provider_type: str
    connection_config: dict | None
    capabilities: dict | None
    auth_config: dict | None
    default_llm_model: str
    default_judge_model: str
    default_agent_args: dict | None
    arg_schema: list[ArgSchemaField] | None = None
    tags: list[str] | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentListItem(BaseModel):
    id: UUID
    name: str
    description: str | None
    module: str
    agent_class: str
    provider_type: str
    tags: list[str] | None
    owner_user_id: UUID | None = None
    owner_display_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentConnectionTestResponse(BaseModel):
    ok: bool
    provider_type: str
    detail: str | None = None
    sample: str | None = None
