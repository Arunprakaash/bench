from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ExpectationBase(BaseModel):
    type: str = Field(
        ..., description="Event type: message, function_call, function_call_output, agent_handoff"
    )
    role: str | None = Field(None, description="Message role (for message type)")
    intent: str | None = Field(None, description="LLM judge intent string")
    function_name: str | None = Field(None, description="Expected function name")
    function_args: dict | None = Field(None, description="Expected function arguments")
    new_agent_type: str | None = Field(None, description="Expected handoff agent type")


class TurnBase(BaseModel):
    user_input: str
    expectations: list[ExpectationBase] = Field(default_factory=list)


class ScenarioCreate(BaseModel):
    name: str
    description: str | None = None
    agent_id: UUID | None = None
    agent_module: str | None = Field(
        default=None, description="Python module path, e.g. 'test_agents.interview_agent'"
    )
    agent_class: str | None = "TestableInterviewAgent"
    llm_model: str | None = "gpt-4o-mini"
    judge_model: str | None = "gpt-4o-mini"
    agent_args: dict | None = Field(None, description="Kwargs passed to agent constructor")
    chat_history: list[dict] | None = None
    mock_tools: dict | None = None
    tags: list[str] | None = None
    turns: list[TurnBase]

    @model_validator(mode="after")
    def _require_agent(self):
        if self.agent_id is None:
            raise ValueError("agent_id is required; a scenario must be linked to an agent")
        return self


class ScenarioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    agent_id: UUID | None = None
    agent_module: str | None = None
    agent_class: str | None = None
    llm_model: str | None = None
    judge_model: str | None = None
    agent_args: dict | None = None
    chat_history: list[dict] | None = None
    mock_tools: dict | None = None
    tags: list[str] | None = None
    turns: list[TurnBase] | None = None


class TurnResponse(TurnBase):
    id: UUID
    turn_index: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ScenarioResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    agent_id: UUID | None
    agent_module: str
    agent_class: str
    llm_model: str
    judge_model: str
    agent_args: dict | None
    chat_history: list[dict] | None
    mock_tools: dict | None
    tags: list[str] | None
    version: int
    turns: list[TurnResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScenarioListResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    agent_id: UUID | None
    agent_module: str
    tags: list[str] | None
    turn_count: int
    version: int
    owner_user_id: UUID | None = None
    owner_display_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ScenarioExportResponse(BaseModel):
    version: int
    scenario: ScenarioCreate


class ScenarioRevisionListItem(BaseModel):
    version: int
    created_at: datetime
