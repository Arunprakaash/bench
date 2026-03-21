# Connecting External Agents

Bench calls your agent service once per scenario turn over HTTP. You implement a single adapter endpoint; Bench handles the rest.

## How it works

```
Bench                          Your App
  │                               │
  │── POST /your/endpoint ────────▶│
  │   { user_input, history, ... } │
  │                                │── call your agent logic
  │                                │
  │◀──────────── { events } ───────│
  │                                │
  │  evaluate events against       │
  │  scenario expectations         │
```

For each turn in a scenario, Bench sends a JSON request to your endpoint, your app runs the agent, and returns structured events. Bench evaluates the events against the turn's expectations.

---

## Step 1 — Create the agent in Bench

In the UI: **Agents → New Agent**, set **Connector Type** to `REST API (External)`.

Or via API:

```bash
curl -X POST http://localhost:8000/api/agents \
  -H "Authorization: Bearer $BENCH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Agent",
    "provider_type": "rest_api",
    "connection_config": {
      "endpoint": "https://your-app.example.com/bench/run",
      "method": "POST",
      "timeout_ms": 30000,
      "headers": {
        "Authorization": "Bearer YOUR_SERVICE_TOKEN"
      },
      "events_path": "events",
      "test_endpoint": "https://your-app.example.com/health"
    },
    "default_llm_model": "gpt-4o-mini",
    "default_judge_model": "gpt-4o-mini"
  }'
```

### Connection config fields

| Field | Required | Description |
|---|---|---|
| `endpoint` | Yes | URL Bench POSTs to for each turn |
| `method` | No | HTTP method, default `POST` |
| `timeout_ms` | No | Per-turn timeout, default `30000` |
| `headers` | No | Static headers (auth, content-type, etc.) |
| `payload` | No | Static fields merged into every turn request |
| `events_path` | No | Dot-path to the events array in your response, default `events` |
| `test_endpoint` | No | URL for connection health check |
| `test_method` | No | HTTP method for health check, default `GET` |

### Static payload fields

Use `payload` for routing metadata that never changes (e.g. an agent identifier in your system):

```json
{
  "connection_config": {
    "endpoint": "https://your-app.example.com/bench/run",
    "payload": {
      "agent_id": "interview_agent_v2",
      "tenant": "acme"
    }
  }
}
```

These fields are merged into every turn request alongside Bench's canonical keys.

### Real-world example

Here's a complete connection config for an external interview agent with JWT auth, a tenant header, and a static agent ID:

```json
{
  "endpoint": "https://api.example.com/api/v1/agentic/bench/run",
  "method": "POST",
  "timeout_ms": 30000,
  "events_path": "events",
  "headers": {
    "X-Tenant": "bench",
    "Authorization": "Bearer YOUR_JWT_TOKEN"
  },
  "payload": {
    "sia_agent_id": "your-agent-id"
  },
  "test_endpoint": "https://api.example.com/api/v1/agentic/bench/run"
}
```

A few things to note from this setup:

- **`test_endpoint` can be the same as `endpoint`** — if you don't have a dedicated health route, Bench will POST to your run endpoint for the connection test. Make sure it returns `2xx` even when `user_input` is missing or empty.
- **Custom headers** like `X-Tenant` go in `headers` alongside `Authorization`.
- **`sia_agent_id`** (or any agent-routing field unique to your system) goes in `payload` so it's automatically included in every turn request.
- **`agent_args`** (set per-scenario, not here) is the right place for behavioral flags like `{ "mode": "prod" }` that you want tracked and versioned per test run.

---

## Step 2 — Implement the adapter endpoint

Add one endpoint to your app. Keep it thin — translate Bench's format to your agent's input, call your agent, translate the output back to Bench events.

### Request contract (Bench → your app)

Bench sends this body for each turn:

```json
{
  "user_input": "What is my order status?",
  "chat_history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help you today?" }
  ],
  "llm_model": "gpt-4o-mini",
  "judge_model": "gpt-4o-mini",
  "agent_args": { "mode": "strict" },
  "mock_tools": null
}
```

Plus any fields from your `connection_config.payload`.

| Field | Type | Description |
|---|---|---|
| `user_input` | string | The user's message for this turn |
| `chat_history` | array | Previous turns (role + content pairs) |
| `llm_model` | string | Model name the scenario is configured to use |
| `judge_model` | string | Model name for evaluation (informational) |
| `agent_args` | object | Scenario-level agent parameters |
| `mock_tools` | object or null | Tool mock definitions (for tool-call testing) |

### Response contract (your app → Bench)

Return a JSON object with an `events` array:

```json
{
  "events": [
    { "type": "message", "role": "assistant", "content": "Your order is on its way." },
    { "type": "function_call", "name": "lookup_order", "arguments": { "order_id": "A-123" } },
    { "type": "function_call_output", "output": { "status": "shipped" }, "is_error": false },
    { "type": "agent_handoff", "new_agent_type": "billing_agent" }
  ]
}
```

### Event types

**`message`** — a text reply from the agent

```json
{ "type": "message", "role": "assistant", "content": "Hello! How can I help?" }
```

**`function_call`** — the agent invoked a tool

```json
{ "type": "function_call", "name": "get_weather", "arguments": { "city": "London" } }
```

**`function_call_output`** — the result of a tool invocation

```json
{ "type": "function_call_output", "output": { "temp": "12°C", "condition": "cloudy" }, "is_error": false }
```

**`agent_handoff`** — the agent transferred to another agent

```json
{ "type": "agent_handoff", "new_agent_type": "escalation_agent" }
```

### Text-only fallback

If your agent only produces text and you have no tool or handoff expectations, a simpler response is accepted:

```json
{ "text": "Your order is on its way." }
```

or

```json
{ "output": "Your order is on its way." }
```

Bench normalizes these into a `message` event. Use the full `events` array if you have tool calls or handoffs to verify.

---

## Step 3 — Test the connection

From the agent detail page, click **Test Connection**. Bench will call your `test_endpoint` (or fall back to `endpoint`) and report success or failure.

Via API:

```bash
curl -X POST http://localhost:8000/api/agents/{agent_id}/connection-test \
  -H "Authorization: Bearer $BENCH_TOKEN"
```

Response:

```json
{ "ok": true, "detail": "200 OK" }
```

---

## Step 4 — Smoke test with a scenario

Create a minimal scenario with a single turn and a `message` expectation. Run it and verify:

1. The run status is `passed`
2. The turn events show your agent's response
3. The evaluation verdict shows `passed` with reasoning

Once that works, add more complex expectations (function calls, handoffs) and verify your event mapping.

---

## Adapter examples

### Node.js (Express)

```js
app.post('/bench/run', async (req, res) => {
  const { user_input, chat_history, agent_args } = req.body;

  // Call your agent
  const result = await myAgent.run({ message: user_input, history: chat_history, ...agent_args });

  // Return events
  res.json({
    events: [
      { type: 'message', role: 'assistant', content: result.text },
      ...result.tool_calls.map(tc => ({
        type: 'function_call',
        name: tc.name,
        arguments: tc.args,
      })),
    ],
  });
});
```

### Python (FastAPI)

```python
@app.post("/bench/run")
async def bench_run(body: dict):
    user_input = body["user_input"]
    chat_history = body.get("chat_history", [])
    agent_args = body.get("agent_args", {})

    result = await my_agent.run(user_input, history=chat_history, **agent_args)

    events = [{"type": "message", "role": "assistant", "content": result.text}]
    for call in result.tool_calls:
        events.append({"type": "function_call", "name": call.name, "arguments": call.args})

    return {"events": events}
```

---

## `agent_args` vs `connection_config.payload`

| | `agent_args` | `connection_config.payload` |
|---|---|---|
| Scope | Per-scenario | Per-agent (all scenarios) |
| Versioned in runs | Yes | No |
| Use for | Scenario-specific behavior (mode, persona, flags) | Static routing metadata (agent ID, tenant, API version) |

---

## Smoke test script

```bash
API_BASE=http://localhost:8000/api \
API_TOKEN=ab_your_token \
python backend/scripts/smoke_http_json_agent.py \
  --endpoint https://your-app.example.com/bench/run \
  --test-endpoint https://your-app.example.com/health
```

> **Note:** The smoke script does not support custom headers or static payload fields. If your endpoint requires authentication headers or routing fields, use the manual approach below instead — create the agent via the UI or API with a full `connection_config`, then click **Test Connection** from the agent detail page.

---

## Deployment checklist

- [ ] Adapter endpoint returns `2xx` for valid input
- [ ] Response contains a valid `events` array (or text fallback)
- [ ] Connection test endpoint returns `2xx`
- [ ] Per-turn response time is under 30s
- [ ] Auth headers are set (token, API key, etc.)
- [ ] Adapter endpoint is stateless
- [ ] Adapter logs request identifiers for debugging

---

## Common failures

| Symptom | Likely cause |
|---|---|
| Connection test fails | Wrong URL, bad auth header, DNS/TLS issue |
| Run errors immediately | Endpoint unreachable or returning non-2xx |
| Events not found | Response shape doesn't match `events_path`, or `events` key is missing |
| Tool expectations fail | Your adapter isn't emitting `function_call` events |
| Run times out | Agent response takes longer than `timeout_ms` |
| Intent expectations fail | Agent response doesn't semantically match the expectation intent |
