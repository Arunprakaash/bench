from __future__ import annotations

import importlib
from contextlib import asynccontextmanager
from typing import Any

from app.runner.connectors.base import TurnExecutionResult


def _load_agent_class(module_path: str, class_name: str):
    module = importlib.import_module(module_path)
    cls = getattr(module, class_name, None)
    if cls is None:
        raise ImportError(f"Class '{class_name}' not found in module '{module_path}'")
    return cls


def _build_mock_fns(mock_config: dict[str, Any]) -> dict[str, Any]:
    mock_fns = {}
    for tool_name, config in mock_config.items():
        if "error" in config:
            mock_fns[tool_name] = lambda: RuntimeError(config["error"])
        elif "return" in config:
            return_val = config["return"]
            mock_fns[tool_name] = lambda: return_val
        elif "conditional" in config:
            conditions = config["conditional"]

            def _conditional_mock(**kwargs):
                for cond in conditions:
                    if_args = cond.get("if_args", {})
                    if all(kwargs.get(k) == v for k, v in if_args.items()):
                        if "error" in cond:
                            return RuntimeError(cond["error"])
                        return cond.get("return", "")
                return cond.get("default", "")

            mock_fns[tool_name] = _conditional_mock

    return mock_fns


def _extract_events(run_result) -> list[dict]:
    events = []
    try:
        idx = 0
        while True:
            try:
                event_assert = run_result.expect[idx]
                event = event_assert.event()
                event_data = {"index": idx}

                if hasattr(event, "item"):
                    item = event.item
                    if hasattr(item, "role"):
                        event_data["type"] = "message"
                        event_data["role"] = item.role
                        raw = item.content if hasattr(item, "content") else ""
                        if isinstance(raw, list):
                            raw = " ".join(str(c) for c in raw)
                        event_data["content"] = str(raw)
                    elif hasattr(item, "name") and hasattr(item, "arguments"):
                        event_data["type"] = "function_call"
                        event_data["name"] = item.name
                        event_data["arguments"] = item.arguments
                    elif hasattr(item, "output"):
                        event_data["type"] = "function_call_output"
                        event_data["output"] = str(item.output)
                        event_data["is_error"] = getattr(item, "is_error", False)
                    else:
                        event_data["type"] = "unknown"
                        event_data["raw"] = str(event)
                else:
                    event_data["type"] = "unknown"
                    event_data["raw"] = str(event)

                events.append(event_data)
                idx += 1
            except (IndexError, AssertionError):
                break
    except Exception:
        pass
    return events


class LocalPythonRuntime:
    def __init__(self, session: Any, agent_cls: type[Any]):
        self._session = session
        self._agent_cls = agent_cls

    async def run_turn(self, user_input: str, mock_tools: dict[str, Any] | None = None) -> TurnExecutionResult:
        if mock_tools:
            from livekit.agents import mock_tools as livekit_mock_tools

            mock_fns = _build_mock_fns(mock_tools)
            with livekit_mock_tools(self._agent_cls, mock_fns):
                run_result = await self._session.run(user_input=user_input)
        else:
            run_result = await self._session.run(user_input=user_input)

        return TurnExecutionResult(run_result=run_result, events=_extract_events(run_result))


class LocalPythonConnector:
    provider_type = "local_python"

    @asynccontextmanager
    async def create_runtime(self, scenario: Any, agent_kwargs: dict[str, Any]):
        agent_cls = _load_agent_class(scenario.agent_module, scenario.agent_class)

        from livekit.agents import AgentSession
        from livekit.plugins import openai

        async with (
            openai.responses.LLM(model=scenario.llm_model, use_websocket=False) as llm,
            AgentSession(llm=llm) as session,
        ):
            agent = agent_cls(**agent_kwargs)
            await session.start(agent)

            if scenario.chat_history:
                from livekit.agents import ChatContext

                chat_ctx = ChatContext()
                for msg in scenario.chat_history:
                    chat_ctx.add_message(role=msg["role"], content=msg["content"])
                await agent.update_chat_ctx(chat_ctx)

            yield LocalPythonRuntime(session=session, agent_cls=agent_cls)

    async def test_connection(
        self,
        module: str | None = None,
        agent_class: str | None = None,
        connection_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not module or not agent_class:
            raise ValueError("module and agent_class are required for local_python connector test")
        _load_agent_class(module, agent_class)
        return {"ok": True, "detail": "Agent class import succeeded"}
