# RFC: Agent Connector Architecture (Beyond Direct Code Imports)

## Status

- Proposed
- Date: 2026-03-21
- Owners: Bench backend/frontend

## Problem

Current execution is tightly coupled to in-process Python imports (`agent_module`, `agent_class`) and a specific runtime path in `backend/app/runner/executor.py`.

This creates constraints:

- Bench must load agent code directly from local Python modules.
- Non-Python / remote agents are hard to integrate.
- Voice and non-voice experiences are not modeled with one common runtime contract.
- CI and external automation become brittle because execution relies on backend runtime internals.

## Goals

- Support multiple agent connection types (local code, HTTP, WebSocket/WebRTC, queue workers).
- Support voice and non-voice agents under one normalized run contract.
- Keep scenario/run evaluation pipeline unchanged as much as possible.
- Decouple Bench orchestration from agent implementation details.

## Non-Goals (Phase 1)

- Replacing all existing run/evaluation logic at once.
- Removing legacy `agent_module` / `agent_class` immediately.
- Building full media transport infrastructure in first iteration.

## Proposed Architecture

### 1) Connector Abstraction

Introduce a backend runtime abstraction:

- `AgentConnector`: provider adapter interface.
- `ConnectorRegistry`: resolves connector implementation by `provider_type`.
- `ExecutionOrchestrator`: existing run flow calls connector instead of direct import/session logic.

The orchestrator keeps ownership of:

- test run lifecycle (`pending/running/passed/failed/error`)
- turn loop and expectation evaluation
- persistence of `TurnResult`, metrics, snapshots

Connectors own:

- how to call the agent runtime
- event streaming/adaptation into canonical event schema
- provider-specific auth and transport

### 2) Canonical Event Schema

All connectors return normalized events per turn:

- `message` (assistant/user/system text chunks or final)
- `tool_call`
- `tool_result`
- `handoff`
- `audio_chunk` (optional in phase 2+)
- `error`
- `final`

This keeps judge/evaluation logic provider-agnostic.

### 3) Agent Manifest (Connection Config)

Add manifest-like fields for each agent:

- `provider_type`: `local_python | rest_api | openai_responses | livekit_realtime | queue_worker`
- `connection_config` (JSON): endpoint/module/options
- `capabilities` (JSON): `text`, `voice`, `tool_calling`, `streaming`, `multimodal`
- `auth_config` (JSON): reference to encrypted secret or token policy

Existing fields (`module`, `agent_class`) stay for backward compatibility and map to `local_python`.

## Interface Sketch (Python)

```python
from typing import Any, AsyncIterator, Protocol

class ConnectorEvent(dict):
    """
    Required keys:
      type: str
      ts: str
    Optional by type:
      role, content, name, arguments, output, is_error, metadata
    """

class TurnInput(dict):
    """
    user_input: str
    chat_history: list[dict] | None
    tools: dict | None
    metadata: dict | None
    """

class AgentConnector(Protocol):
    provider_type: str

    async def validate_config(self, connection_config: dict[str, Any]) -> None: ...

    async def run_turn(
        self,
        connection_config: dict[str, Any],
        turn: TurnInput,
        runtime_ctx: dict[str, Any],
    ) -> AsyncIterator[ConnectorEvent]: ...
```

Notes:

- `run_turn` streams events; orchestrator collects and stores them.
- Connectors should be stateless per call where possible.

## Initial Connector Set

### A) `local_python` (Compatibility Adapter)

- Wrap existing dynamic import + LiveKit session path.
- Keeps current behavior while moving behind interface.

### B) `rest_api` (New)

- Calls remote agent endpoint via HTTP.
- Supports request/response and optional server-sent events stream.
- Suitable for CI, hosted agents, non-Python stacks.

### C) `openai_responses` (New)

- Direct connector using OpenAI Responses API for text/multimodal.
- No dependency on local agent class import.

### D) `livekit_realtime` (Phase 2)

- Connector for voice streaming paths.
- Normalizes realtime events into canonical schema.

## Data Model Changes

### Agent table (incremental)

Add nullable columns:

- `provider_type VARCHAR(64)` default `local_python`
- `connection_config JSONB` nullable
- `capabilities JSONB` nullable
- `auth_config JSONB` nullable

Keep:

- `module`, `agent_class`, `default_*` for compatibility and migration.

### Scenario table (minimal in phase 1)

- Keep `agent_id` as primary link.
- Optional future field: `runtime_overrides JSONB` for per-scenario transport overrides.

## Execution Snapshot Changes

Current snapshot stores resolved module/class/config.
Extend to include connector metadata:

- `connector.provider_type`
- `connector.connection_config_resolved` (redacted)
- `connector.capabilities`
- `legacy_agent_ref` (module/class if applicable)

This preserves reproducibility and debugging.

## Security

- Do not persist raw provider API keys in agent rows.
- `auth_config` should store references to secret ids (or encrypted values if secret manager unavailable).
- Redact secrets from run snapshots and logs.
- Timeouts/retries/circuit-breakers per connector to avoid hanging runs.

## Migration Plan

### Phase 1: Abstraction without behavior change

1. Add connector interfaces and registry.
2. Implement `local_python` adapter by moving current executor runtime calls behind connector.
3. Default all existing agents to `provider_type=local_python`.

### Phase 2: Remote text agents

1. Add `rest_api` connector.
2. Add API/UI fields for provider selection + connection config.
3. Add connector health check endpoint (`/api/agents/{id}/connection-test`).

### Phase 3: OpenAI + voice

1. Add `openai_responses` connector.
2. Add `livekit_realtime` connector for voice flows.
3. Unify run artifacts for text/voice events.

### Phase 4: Deprecation cleanup

1. Mark direct module/class import as legacy-only.
2. Remove hard dependency from main executor path once migration is complete.

## API/UI Impacts

- `POST/PUT /api/agents` should accept provider fields.
- UI Agent form changes:
  - provider select
  - provider-specific config form
  - capability badges
  - connection test action

No immediate breaking changes if provider defaults to `local_python`.

## Risks and Mitigations

- Risk: event mismatch across connectors.
  - Mitigation: strict canonical event schema + contract tests.
- Risk: increased runtime failure modes (network/auth).
  - Mitigation: per-connector retries, timeout budgets, clear error typing.
- Risk: migration complexity.
  - Mitigation: compatibility adapter first, then gradual rollout.

## Definition of Done (Phase 1)

- Existing runs execute via `local_python` connector path.
- No regression in run statuses and turn result persistence.
- Agent records support `provider_type` with default.
- Docs updated with provider model and migration notes.

## Recommended Next Implementation Slice

Smallest valuable slice to start coding now:

1. Add `provider_type` + `connection_config` columns to `agents`.
2. Implement connector protocol + registry.
3. Implement `LocalPythonConnector` by moving code from `executor.py`.
4. Refactor `execute_scenario` to call registry connector.
5. Keep old scenario/agent payloads backward-compatible.
