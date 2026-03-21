"""
Test runner engine.

Translates UI-defined scenarios into LiveKit's testing API calls:
  AgentSession → session.run(user_input) → RunResult → expect assertions
"""

import asyncio
import time
import traceback
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agent_version import AgentVersion
from app.models.run_evaluation import RunEvaluation
from app.models.scenario import Scenario
from app.models.test_run import RunStatus, TestRun, TurnResult
from app.runner.connectors import get_connector


def _build_structured_events(turn_events: list[dict]) -> dict:
    """Build structured_events dict (messages, tool_calls) from raw events list."""
    messages = []
    tool_calls = []
    i = 0
    while i < len(turn_events):
        ev = turn_events[i]
        if ev.get("type") == "message":
            messages.append({
                "role": ev.get("role", "assistant"),
                "content": ev.get("content", ""),
            })
        elif ev.get("type") == "function_call":
            tc = {"tool": ev.get("name", ""), "arguments": ev.get("arguments") or {}}
            if i + 1 < len(turn_events) and turn_events[i + 1].get("type") == "function_call_output":
                tc["output"] = turn_events[i + 1].get("output")
                tc["is_error"] = turn_events[i + 1].get("is_error", False)
                i += 1
            tool_calls.append(tc)
        elif ev.get("type") == "function_call_output":
            tool_calls.append({"output": ev.get("output"), "is_error": ev.get("is_error", False)})
        i += 1
    out = {}
    if messages:
        out["messages"] = messages
    if tool_calls:
        out["tool_calls"] = tool_calls
    return out if out else {}


# Per-agent locks so parallel suite runs don't race on AgentVersion (agent_id, version) unique constraint.
_agent_version_locks: dict[UUID, asyncio.Lock] = {}


def _lock_for_agent(agent_id: UUID) -> asyncio.Lock:
    if agent_id not in _agent_version_locks:
        _agent_version_locks[agent_id] = asyncio.Lock()
    return _agent_version_locks[agent_id]


def _build_execution_snapshot(scenario: Scenario, agent_kwargs: dict) -> dict:
    """Build execution_snapshot for replay/debug: resolved agent config and scenario snapshot."""
    provider_type = "local_python"
    if scenario.agent and scenario.agent.provider_type:
        provider_type = scenario.agent.provider_type
    return {
        "resolved_agent": {
            "module": scenario.agent_module,
            "agent_class": scenario.agent_class,
            "agent_args": agent_kwargs,
            "provider_type": provider_type,
            "connection_config": (scenario.agent.connection_config if scenario.agent else None),
        },
        "llm_model": scenario.llm_model,
        "judge_model": scenario.judge_model or scenario.llm_model,
        "scenario_snapshot": {
            "name": scenario.name,
            "version": scenario.version,
            "turns": [
                {"turn_index": t.turn_index, "user_input": t.user_input, "expectations": t.expectations}
                for t in sorted(scenario.turns, key=lambda x: x.turn_index)
            ],
        },
    }


async def execute_scenario(run_id: UUID, db: AsyncSession) -> None:
    """Execute a test scenario using LiveKit's AgentSession testing API."""
    result = await db.execute(
        select(TestRun)
        .options(
            selectinload(TestRun.scenario).selectinload(Scenario.turns),
            selectinload(TestRun.scenario).selectinload(Scenario.agent),
        )
        .where(TestRun.id == run_id)
    )
    test_run = result.scalar_one()
    scenario = test_run.scenario

    test_run.status = RunStatus.RUNNING
    test_run.started_at = datetime.now(timezone.utc)

    # Create immutable agent version and execution snapshot for reproducibility.
    # Serialize per agent so parallel suite runs don't race on (agent_id, version) unique constraint.
    # Hold the lock until after commit so the new version is visible before another run allocates the next.
    agent_kwargs = scenario.agent_args or {}
    test_run.execution_snapshot = _build_execution_snapshot(scenario, agent_kwargs)

    if scenario.agent_id:
        # In-process lock + DB advisory lock so version allocation is serialized across workers.
        async with _lock_for_agent(scenario.agent_id):
            # Advisory lock held until commit; prevents duplicate (agent_id, version) from other workers.
            key = int.from_bytes(scenario.agent_id.bytes[:8], "big", signed=True)
            await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})
            r = await db.execute(
                select(func.coalesce(func.max(AgentVersion.version), 0)).where(
                    AgentVersion.agent_id == scenario.agent_id
                )
            )
            next_version = (r.scalar() or 0) + 1
            av = AgentVersion(
                agent_id=scenario.agent_id,
                version=next_version,
                module=scenario.agent_module,
                agent_class=scenario.agent_class,
                config={
                    "provider_type": scenario.agent.provider_type if scenario.agent else "local_python",
                    "connection_config": scenario.agent.connection_config if scenario.agent else None,
                    "llm_model": scenario.llm_model,
                    "judge_model": scenario.judge_model or scenario.llm_model,
                    "agent_args": scenario.agent_args or {},
                },
            )
            db.add(av)
            await db.flush()
            test_run.agent_version_id = av.id
            await db.commit()
    else:
        await db.commit()

    run_start = time.monotonic()

    try:
        provider_type = scenario.agent.provider_type if scenario.agent and scenario.agent.provider_type else "local_python"
        connector = get_connector(provider_type)

        from livekit.plugins import openai

        async with connector.create_runtime(scenario, agent_kwargs) as runtime:
            judge_llm = None
            if scenario.judge_model:
                judge_llm = openai.responses.LLM(model=scenario.judge_model, use_websocket=False)

            all_passed = True
            passed_turn_count = 0

            for turn in sorted(scenario.turns, key=lambda t: t.turn_index):
                turn_start = time.monotonic()
                turn_passed = True
                turn_events = []
                judge_verdicts = []
                error_msg = None

                try:
                    turn_output = await runtime.run_turn(turn.user_input, scenario.mock_tools)
                    run_result = turn_output.run_result
                    turn_events = turn_output.events

                    for exp_idx, expectation in enumerate(turn.expectations):
                        verdict = await _evaluate_expectation(run_result, expectation, judge_llm, exp_idx)
                        judge_verdicts.append(verdict)
                        if not verdict["passed"]:
                            turn_passed = False

                except Exception as e:
                    turn_passed = False
                    error_msg = f"{type(e).__name__}: {str(e)}"

                turn_latency = (time.monotonic() - turn_start) * 1000

                if not turn_passed:
                    all_passed = False
                else:
                    passed_turn_count += 1

                structured = _build_structured_events(turn_events)
                turn_result = TurnResult(
                    test_run_id=run_id,
                    turn_index=turn.turn_index,
                    user_input=turn.user_input,
                    events=turn_events,
                    expectations=[exp for exp in turn.expectations],
                    structured_events=structured if structured else None,
                    passed=turn_passed,
                    judge_verdicts=judge_verdicts,
                    latency_ms=turn_latency,
                    error_message=error_msg,
                )
                db.add(turn_result)
                await db.flush()

        total_duration = (time.monotonic() - run_start) * 1000
        test_run.status = RunStatus.PASSED if all_passed else RunStatus.FAILED
        test_run.completed_at = datetime.now(timezone.utc)
        test_run.duration_ms = total_duration

        total_turns = len(scenario.turns)
        run_eval = RunEvaluation(
            test_run_id=run_id,
            metrics={
                "task_success": all_passed,
                "passed_turns": passed_turn_count,
                "total_turns": total_turns,
            },
            judge_output=None,
        )
        db.add(run_eval)

        await db.commit()

    except Exception as e:
        total_duration = (time.monotonic() - run_start) * 1000
        test_run.status = RunStatus.ERROR
        test_run.completed_at = datetime.now(timezone.utc)
        test_run.duration_ms = total_duration
        test_run.error_message = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        # Run-level evaluation even on error (task_success false)
        total_turns = len(scenario.turns)
        run_eval = RunEvaluation(
            test_run_id=run_id,
            metrics={"task_success": False, "passed_turns": 0, "total_turns": total_turns},
            judge_output={"error": str(e)},
        )
        db.add(run_eval)
        await db.commit()

def _extract_event_data(event_assert) -> dict | None:
    """Safely extract structured data from an event assertion."""
    try:
        ev = event_assert.event()
        if not hasattr(ev, "item"):
            return {"type": type(ev).__name__}
        item = ev.item
        data: dict = {"type": type(ev).__name__}
        if hasattr(item, "role"):
            data["role"] = str(item.role)
            raw = item.content if hasattr(item, "content") else ""
            if isinstance(raw, list):
                data["content"] = " ".join(str(c) for c in raw)
            else:
                data["content"] = str(raw)
        if hasattr(item, "name"):
            data["function_name"] = str(item.name)
        if hasattr(item, "arguments"):
            data["arguments"] = item.arguments
        if hasattr(item, "output"):
            data["output"] = str(item.output)
        if hasattr(item, "is_error"):
            data["is_error"] = item.is_error
        if hasattr(item, "metrics") and item.metrics:
            metrics = item.metrics
            if isinstance(metrics, dict):
                data["metrics"] = metrics
            else:
                data["metrics"] = {
                    k: getattr(metrics, k)
                    for k in ("started_speaking_at", "stopped_speaking_at", "llm_node_ttft")
                    if hasattr(metrics, k)
                }
        return data
    except Exception:
        return None


def _clean_reasoning(raw: str) -> str:
    """Strip the 'Context around failure' tail from LiveKit's assertion message."""
    marker = "Context around failure:"
    idx = raw.find(marker)
    reason = raw[:idx].strip() if idx != -1 else raw
    reason = reason.removeprefix("Assertion failed:").strip()
    reason = reason.removeprefix("Judgement failed:").strip()
    return reason


async def _evaluate_expectation(
    run_result, expectation: dict, judge_llm, exp_idx: int
) -> dict:
    """Evaluate a single expectation against the run result."""
    verdict = {
        "expectation_index": exp_idx,
        "passed": False,
        "intent": expectation.get("intent"),
        "reasoning": None,
        "actual_event": None,
    }

    try:
        exp_type = expectation["type"]

        if exp_type == "message":
            event_assert = run_result.expect.next_event()
            verdict["actual_event"] = _extract_event_data(event_assert)
            msg_assert = event_assert.is_message(role=expectation.get("role", "assistant"))

            if expectation.get("intent") and judge_llm:
                await msg_assert.judge(judge_llm, intent=expectation["intent"])

            verdict["passed"] = True
            verdict["reasoning"] = "Message assertion passed"

        elif exp_type == "function_call":
            event_assert = run_result.expect.next_event()
            verdict["actual_event"] = _extract_event_data(event_assert)
            kwargs = {}
            if expectation.get("function_name"):
                kwargs["name"] = expectation["function_name"]
            if expectation.get("function_args"):
                kwargs["arguments"] = expectation["function_args"]
            event_assert.is_function_call(**kwargs)
            verdict["passed"] = True
            verdict["reasoning"] = "Function call assertion passed"

        elif exp_type == "function_call_output":
            event_assert = run_result.expect.next_event()
            verdict["actual_event"] = _extract_event_data(event_assert)
            event_assert.is_function_call_output()
            verdict["passed"] = True
            verdict["reasoning"] = "Function call output assertion passed"

        elif exp_type == "agent_handoff":
            event_assert = run_result.expect.next_event()
            verdict["actual_event"] = _extract_event_data(event_assert)
            event_assert.is_agent_handoff()
            verdict["passed"] = True
            verdict["reasoning"] = "Agent handoff assertion passed"

    except AssertionError as e:
        verdict["passed"] = False
        verdict["reasoning"] = _clean_reasoning(str(e))
    except Exception as e:
        verdict["passed"] = False
        verdict["reasoning"] = f"{type(e).__name__}: {str(e)}"

    return verdict
