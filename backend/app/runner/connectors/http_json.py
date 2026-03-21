from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

import httpx

from app.runner.connectors.base import TurnExecutionResult
from app.runner.simple_llm_judge import evaluate_intent


def _headers_from_config(connection_config: dict[str, Any]) -> dict[str, str]:
    headers = connection_config.get("headers") or {}
    if not isinstance(headers, dict):
        return {}
    return {str(k): str(v) for k, v in headers.items()}


def _extract_events_from_payload(payload: Any, events_path: str) -> list[dict[str, Any]]:
    node = payload
    if events_path:
        for segment in events_path.split("."):
            if isinstance(node, dict):
                node = node.get(segment)
            else:
                node = None
                break

    if isinstance(node, list):
        out: list[dict[str, Any]] = []
        for ev in node:
            if isinstance(ev, dict):
                out.append(ev)
            else:
                out.append({"type": "message", "role": "assistant", "content": str(ev)})
        return out

    if isinstance(payload, dict):
        if "text" in payload:
            return [{"type": "message", "role": "assistant", "content": str(payload["text"])}]
        if "output" in payload:
            return [{"type": "message", "role": "assistant", "content": str(payload["output"])}]
    if isinstance(payload, str):
        return [{"type": "message", "role": "assistant", "content": payload}]
    return []


@dataclass
class _SimpleItem:
    role: str | None = None
    content: str | None = None
    name: str | None = None
    arguments: Any = None
    output: Any = None
    is_error: bool = False
    new_agent_type: str | None = None


class _SimpleEvent:
    def __init__(self, raw: dict[str, Any]):
        t = raw.get("type")
        if t == "message":
            self.item = _SimpleItem(role=str(raw.get("role", "assistant")), content=str(raw.get("content", "")))
        elif t == "function_call":
            self.item = _SimpleItem(name=str(raw.get("name", "")), arguments=raw.get("arguments") or {})
        elif t == "function_call_output":
            self.item = _SimpleItem(output=raw.get("output"), is_error=bool(raw.get("is_error", False)))
        elif t == "agent_handoff":
            self.item = _SimpleItem(new_agent_type=str(raw.get("new_agent_type", "")))
        else:
            self.item = _SimpleItem(content=str(raw))


class _SimpleMessageAssertion:
    def __init__(self, event: dict[str, Any]):
        self._event = event

    async def judge(self, judge_llm: Any, intent: str):
        if not intent:
            return

        content = str(self._event.get("content", ""))
        model_name = "gpt-4o-mini"

        # Try to get model name from judge_llm (LiveKit object) if passed
        if judge_llm and hasattr(judge_llm, "model"):
            model_name = str(judge_llm.model)

        passed, reasoning = await evaluate_intent(content, intent, model_name)
        if not passed:
            raise AssertionError(f"Judgement failed: {reasoning}")


class _SimpleEventAssertion:
    def __init__(self, event: dict[str, Any]):
        self._event = event

    def event(self) -> _SimpleEvent:
        return _SimpleEvent(self._event)

    def is_message(self, role: str = "assistant") -> _SimpleMessageAssertion:
        if self._event.get("type") != "message":
            raise AssertionError(f"Expected message event, got {self._event.get('type')}")
        actual_role = str(self._event.get("role", "assistant"))
        if actual_role != role:
            raise AssertionError(f"Expected role {role}, got {actual_role}")
        return _SimpleMessageAssertion(self._event)

    def is_function_call(self, name: str):
        if self._event.get("type") != "function_call":
            raise AssertionError(f"Expected function_call event, got {self._event.get('type')}")
        actual_name = str(self._event.get("name", ""))
        if actual_name != name:
            raise AssertionError(f"Expected function {name}, got {actual_name}")

    def is_function_call_output(self):
        if self._event.get("type") != "function_call_output":
            raise AssertionError(f"Expected function_call_output event, got {self._event.get('type')}")

    def is_agent_handoff(self, new_agent_type: str):
        if self._event.get("type") != "agent_handoff":
            raise AssertionError(f"Expected agent_handoff event, got {self._event.get('type')}")
        actual = str(self._event.get("new_agent_type", ""))
        if actual != new_agent_type:
            raise AssertionError(f"Expected handoff {new_agent_type}, got {actual}")


class _SimpleExpect:
    def __init__(self, events: list[dict[str, Any]]):
        self._events = events
        self._cursor = 0

    def __getitem__(self, idx: int) -> _SimpleEventAssertion:
        if idx < 0 or idx >= len(self._events):
            raise IndexError(idx)
        return _SimpleEventAssertion(self._events[idx])

    def next_event(self) -> _SimpleEventAssertion:
        if self._cursor >= len(self._events):
            raise AssertionError("No more events")
        out = _SimpleEventAssertion(self._events[self._cursor])
        self._cursor += 1
        return out


class _SimpleRunResult:
    def __init__(self, events: list[dict[str, Any]]):
        self.expect = _SimpleExpect(events)


class HttpJsonRuntime:
    def __init__(self, client: httpx.AsyncClient, connection_config: dict[str, Any], scenario: Any, agent_kwargs: dict[str, Any]):
        self._client = client
        self._cfg = connection_config
        self._scenario = scenario
        self._agent_kwargs = agent_kwargs

    async def run_turn(self, user_input: str, mock_tools: dict[str, Any] | None = None) -> TurnExecutionResult:
        endpoint = self._cfg.get("endpoint")
        if not endpoint:
            raise ValueError("rest_api connector requires connection_config.endpoint")
        method = str(self._cfg.get("method", "POST")).upper()
        static_payload = self._cfg.get("payload") or {}
        if not isinstance(static_payload, dict):
            raise ValueError("connection_config.payload must be an object")

        request_payload = {
            **static_payload,
            "user_input": user_input,
            "chat_history": self._scenario.chat_history,
            "llm_model": self._scenario.llm_model,
            "judge_model": self._scenario.judge_model,
            "agent_args": self._agent_kwargs,
            "mock_tools": mock_tools,
        }
        response = await self._client.request(method, endpoint, json=request_payload)
        response.raise_for_status()

        payload = response.json()
        events = _extract_events_from_payload(payload, str(self._cfg.get("events_path", "events")))
        if not events:
            raise ValueError("rest_api response did not contain events or text/output fields")

        run_result = _SimpleRunResult(events)
        return TurnExecutionResult(run_result=run_result, events=events)


class HttpJsonConnector:
    provider_type = "rest_api"

    @asynccontextmanager
    async def create_runtime(self, scenario: Any, agent_kwargs: dict[str, Any]):
        cfg = scenario.agent.connection_config if scenario.agent and scenario.agent.connection_config else {}
        timeout_ms = int(cfg.get("timeout_ms", 30000))
        timeout = timeout_ms / 1000
        async with httpx.AsyncClient(timeout=timeout, headers=_headers_from_config(cfg)) as client:
            yield HttpJsonRuntime(client=client, connection_config=cfg, scenario=scenario, agent_kwargs=agent_kwargs)

    async def test_connection(
        self,
        module: str | None = None,  # noqa: ARG002
        agent_class: str | None = None,  # noqa: ARG002
        connection_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        cfg = connection_config or {}
        endpoint = cfg.get("test_endpoint") or cfg.get("endpoint")
        if not endpoint:
            raise ValueError("rest_api connector test requires connection_config.endpoint")
        method = str(cfg.get("test_method", "GET")).upper()
        timeout_ms = int(cfg.get("timeout_ms", 30000))
        timeout = timeout_ms / 1000
        payload = cfg.get("test_payload")
        if payload is not None and not isinstance(payload, dict):
            raise ValueError("connection_config.test_payload must be an object")

        async with httpx.AsyncClient(timeout=timeout, headers=_headers_from_config(cfg)) as client:
            response = await client.request(method, endpoint, json=payload)
            detail = f"{method} {endpoint} -> {response.status_code}"
            response.raise_for_status()
            sample = response.text[:500] if response.text else ""
            return {"ok": True, "detail": detail, "sample": sample}
