from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.scenario import ScenarioListResponse


class SuiteCreate(BaseModel):
    name: str
    description: str | None = None
    scenario_ids: list[UUID] = []


class SuiteUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    scenario_ids: list[UUID] | None = None


class SuiteResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    scenarios: list[ScenarioListResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SuiteListResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    scenario_count: int
    scenario_ids: list[UUID] = []
    owner_user_id: UUID | None = None
    owner_display_name: str | None = None
    created_at: datetime
    updated_at: datetime
