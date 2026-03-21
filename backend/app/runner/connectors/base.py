from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class TurnExecutionResult:
    run_result: Any
    events: list[dict[str, Any]]


class AgentRuntime(Protocol):
    async def run_turn(self, user_input: str, mock_tools: dict[str, Any] | None = None) -> TurnExecutionResult:
        ...


class AgentConnector(Protocol):
    provider_type: str

    async def create_runtime(self, scenario: Any, agent_kwargs: dict[str, Any]) -> Any:
        ...

    async def test_connection(
        self,
        module: str | None = None,
        agent_class: str | None = None,
        connection_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        ...
