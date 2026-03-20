from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.test_run import RunStatus


class FailureInboxItem(BaseModel):
    run_id: UUID
    scenario_id: UUID
    scenario_name: str | None = None
    owner_user_id: UUID | None = None
    owner_display_name: str | None = None
    suite_id: UUID | None = None
    agent_id: UUID | None = None
    status: RunStatus
    created_at: datetime
    duration_ms: float | None = None

    first_failed_turn_index: int | None = None
    first_failed_user_input: str | None = None
    first_failed_reasoning: str | None = None
    first_failed_error: str | None = None

