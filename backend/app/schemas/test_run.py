from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.test_run import RunStatus


class RunCreate(BaseModel):
    scenario_id: UUID
    config: dict | None = None


class SuiteRunCreate(BaseModel):
    suite_id: UUID
    config: dict | None = None


class JudgeVerdict(BaseModel):
    expectation_index: int
    passed: bool
    intent: str | None = None
    reasoning: str | None = None


class TurnResultResponse(BaseModel):
    id: UUID
    turn_index: int
    user_input: str
    events: list[dict]
    expectations: list[dict]
    structured_events: dict | None = None
    passed: bool | None
    judge_verdicts: list[JudgeVerdict] | None
    latency_ms: float | None
    error_message: str | None
    input_audio_url: str | None = None
    output_audio_url: str | None = None
    stt_latency_ms: float | None = None
    tts_latency_ms: float | None = None
    interruption: bool | None = None

    model_config = {"from_attributes": True}


class RunEvaluationResponse(BaseModel):
    id: UUID
    test_run_id: UUID
    metrics: dict
    judge_output: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TestRunResponse(BaseModel):
    id: UUID
    scenario_id: UUID
    suite_id: UUID | None
    agent_id: UUID | None = None
    agent_version_id: UUID | None = None
    status: RunStatus
    config: dict | None
    execution_snapshot: dict | None = None
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: float | None
    error_message: str | None
    turn_results: list[TurnResultResponse]
    run_evaluation: RunEvaluationResponse | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TestRunListResponse(BaseModel):
    id: UUID
    scenario_id: UUID
    scenario_name: str | None = None
    owner_user_id: UUID | None = None
    owner_display_name: str | None = None
    suite_id: UUID | None
    agent_id: UUID | None = None
    agent_version_id: UUID | None = None
    status: RunStatus
    duration_ms: float | None
    passed_turns: int = 0
    total_turns: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class RunProgressEvent(BaseModel):
    """WebSocket event sent during test execution."""

    run_id: UUID
    turn_index: int
    status: str
    user_input: str | None = None
    events: list[dict] | None = None
    passed: bool | None = None
    judge_verdicts: list[JudgeVerdict] | None = None
    latency_ms: float | None = None
    error_message: str | None = None
