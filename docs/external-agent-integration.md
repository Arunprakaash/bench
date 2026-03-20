# External Agent Integration Guide

This guide explains how to connect any external agent service to Bench using the `http_json` connector.

Use this as the implementation reference for new teams integrating their own app/agent into Bench.

## 1) Integration Model

Bench calls your service once per scenario turn over HTTP.

- Bench sends a JSON payload (`user_input`, `chat_history`, `agent_args`, etc.)
- Your service runs agent logic
- Your service returns normalized `events`
- Bench evaluates expectations against those events

You only need an adapter endpoint in your app. Core agent logic can remain unchanged.

## 2) Bench-Side Setup

Create an agent in Bench with:

- `provider_type`: `http_json`
- `connection_config.endpoint`: your turn endpoint (required)
- `connection_config.method`: typically `POST`
- `connection_config.events_path`: usually `events`
- `connection_config.headers`: optional auth/custom headers
- `connection_config.test_endpoint`: optional health endpoint for connection test

Reference payload: [http-json-agent-template.md](./http-json-agent-template.md)

## 3) Request Contract (Bench -> Your App)

Bench sends this body per turn:

```json
{
  "user_input": "Hi",
  "chat_history": [],
  "llm_model": "gpt-4o-mini",
  "judge_model": "gpt-4o-mini",
  "agent_args": {},
  "mock_tools": null
}
```

## 4) Response Contract (Your App -> Bench)

Preferred response:

```json
{
  "events": [
    { "type": "message", "role": "assistant", "content": "Hello, how can I help?" },
    { "type": "function_call", "name": "lookup_order", "arguments": { "order_id": "A-123" } },
    { "type": "function_call_output", "output": { "status": "shipped" }, "is_error": false },
    { "type": "agent_handoff", "new_agent_type": "billing" }
  ]
}
```

Supported fallback:

```json
{ "text": "Hello, how can I help?" }
```

Fallback is enough for message-only scenarios. Tool/handoff expectations require explicit event objects.

## 5) Minimal Adapter Pattern

Implement a thin adapter endpoint in your app:

1. Parse Bench payload.
2. Map to your existing agent input format.
3. Execute your existing logic.
4. Transform output into Bench `events`.
5. Return JSON.

Do not rewrite your core agent. Keep translation in one dedicated adapter route/module.

## 6) Recommended API Endpoints In Your App

- `POST /bench/run` (or equivalent): Bench turn endpoint
- `GET /health`: health endpoint for Bench connection test

## 7) End-to-End Testing Flow

1. Create Bench agent (`provider_type=http_json`).
2. Run Bench connection test:
   - `POST /api/agents/{agent_id}/connection-test`
3. Create a simple scenario with one message expectation.
4. Run scenario and confirm run status + turn events.
5. Add tool/handoff expectations and verify event mapping.

Useful helpers:

- Postman requests in `backend/postman/Bench-API.postman_collection.json`
- Smoke script: `backend/scripts/smoke_http_json_agent.py`

## 8) CI Validation Checklist

Run these checks in your pipeline before deploying adapter changes:

1. Adapter endpoint responds `2xx` for valid input.
2. Response includes valid `events` array.
3. At least one smoke scenario in Bench passes with your adapter.
4. Connection test endpoint succeeds.
5. Error responses from your app are explicit and non-empty.

## 9) Deployment Guidance

- Keep adapter endpoint stateless.
- Add request timeout budget (`< 30s` preferred).
- Rate-limit/secure with auth headers or API gateway.
- Version your adapter route (`/v1/bench/run`) to avoid contract breakage.
- Log request id + scenario/run identifiers for debugging.

## 10) Common Failure Modes

- `Connection test failed`: wrong endpoint, auth header, DNS, or TLS issue.
- `No events/text/output`: adapter response shape mismatch.
- Scenario fails with tool expectations: tool events not emitted in response.
- Slow runs/timeouts: external service latency too high for per-turn execution.

## 11) Security Notes

- Do not hardcode secrets in Bench `connection_config`.
- Prefer short-lived service tokens or gateway-issued credentials.
- Redact sensitive content from adapter logs.

## 12) Contract Evolution

If your app needs richer semantics, keep backward compatibility:

- Preserve existing event types and keys.
- Add new keys only as optional fields.
- Roll out with a versioned endpoint and test one scenario suite before full switch.
