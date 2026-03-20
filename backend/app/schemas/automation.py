from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.automation import ScheduleTargetType


class ScheduledRunCreate(BaseModel):
    target_type: ScheduleTargetType
    scenario_id: UUID | None = None
    suite_id: UUID | None = None
    interval_minutes: int = Field(default=1440, ge=5, le=10080)
    config: dict | None = None
    is_active: bool = True


class ScheduledRunUpdate(BaseModel):
    interval_minutes: int | None = Field(default=None, ge=5, le=10080)
    config: dict | None = None
    is_active: bool | None = None


class ScheduledRunResponse(BaseModel):
    id: UUID
    target_type: ScheduleTargetType
    scenario_id: UUID | None
    suite_id: UUID | None
    interval_minutes: int
    config: dict | None
    is_active: bool
    last_run_at: datetime | None
    next_run_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class RegressionAlertResponse(BaseModel):
    id: UUID
    scenario_id: UUID | None
    run_id: UUID
    previous_run_id: UUID | None
    title: str
    detail: str | None
    is_acknowledged: bool
    created_at: datetime

    model_config = {"from_attributes": True}

