# API Reference

**Base URL:** `http://localhost:8000`

**Interactive docs:** http://localhost:8000/api/docs

**Postman collection:** `backend/postman/Bench-API.postman_collection.json`

---

## Authentication

All endpoints (except register and login) require a bearer token.

```
Authorization: Bearer <token>
```

Two token types are accepted:
- **JWT** — obtained from `/api/auth/login` or `/api/auth/register`. Expires after 7 days.
- **API token** — generated from `/api/auth/api-token`. Prefixed `ab_`. Does not expire until revoked.

---

## Auth

### `POST /api/auth/register`

Create a new account.

```json
// Request
{ "email": "you@example.com", "password": "yourpassword" }

// Response 201
{ "token": "<jwt>", "user": { "id": "...", "email": "...", "display_name": null } }
```

### `POST /api/auth/login`

```json
// Request
{ "email": "you@example.com", "password": "yourpassword" }

// Response 200
{ "token": "<jwt>", "user": { "id": "...", "email": "...", "display_name": "..." } }
```

### `GET /api/auth/me`

Returns the current user.

### `PATCH /api/auth/me`

Update profile fields.

```json
// Request (all fields optional)
{ "display_name": "Ada", "avatar_url": "https://example.com/avatar.png" }
```

### `POST /api/auth/change-password`

```json
// Request
{ "current_password": "old", "new_password": "new" }
```

### `POST /api/auth/api-token`

Generate an API token (replaces any existing token).

```json
// Response 201
{ "token": "ab_xxxxxxxxxxxxxxxx", "prefix": "ab_xxxx", "last4": "xxxx", "created_at": "..." }
```

The full token is only shown once. Store it securely.

### `GET /api/auth/api-token`

Returns metadata about the current token (prefix, last4, created_at). Does not return the full token.

### `DELETE /api/auth/api-token`

Revokes the current API token.

---

## Agents

### `GET /api/agents`

List all agents owned by the current user.

```json
// Response 200
[
  {
    "id": "uuid",
    "name": "My Agent",
    "description": "...",
    "provider_type": "rest_api",
    "module": "remote.http",
    "agent_class": "HttpJsonAgent",
    "default_llm_model": "gpt-4o-mini",
    "default_judge_model": "gpt-4o-mini",
    "tags": [],
    "created_at": "...",
    "updated_at": "..."
  }
]
```

### `GET /api/agents/{agent_id}`

Returns full agent details including `connection_config` and `default_agent_args`.

### `POST /api/agents`

Create an agent.

```json
// Request
{
  "name": "My Agent",
  "description": "Optional description",
  "provider_type": "rest_api",
  "connection_config": {
    "endpoint": "https://your-app.example.com/bench/run",
    "method": "POST",
    "timeout_ms": 30000,
    "headers": { "Authorization": "Bearer TOKEN" },
    "payload": { "agent_id": "v2" },
    "events_path": "events",
    "test_endpoint": "https://your-app.example.com/health"
  },
  "default_llm_model": "gpt-4o-mini",
  "default_judge_model": "gpt-4o-mini",
  "default_agent_args": {}
}
```

### `PUT /api/agents/{agent_id}`

Update agent configuration. All fields are optional.

### `DELETE /api/agents/{agent_id}`

Delete an agent. This does not delete associated scenarios or runs.

### `POST /api/agents/{agent_id}/connection-test`

Test the agent's connectivity.

```json
// Response 200
{ "ok": true, "detail": "200 OK" }

// Response 200 (failure)
{ "ok": false, "detail": "Connection refused" }
```

### `GET /api/agents/{agent_id}/arg-schema`

Returns the JSON schema for the agent's constructor arguments. Used by the UI to generate the agent args form.

---

## Scenarios

### `GET /api/scenarios`

List scenarios. Optionally filter by tag:

```
GET /api/scenarios?tag=regression
```

### `GET /api/scenarios/{scenario_id}`

Returns the scenario with all turns and expectations.

### `POST /api/scenarios`

Create a scenario.

```json
// Request
{
  "name": "Happy path",
  "description": "User books an appointment successfully",
  "agent_id": "uuid",
  "llm_model": "gpt-4o-mini",
  "judge_model": "gpt-4o-mini",
  "tags": ["regression", "booking"],
  "turns": [
    {
      "user_input": "I'd like to book an appointment",
      "expectations": [
        { "type": "message", "role": "assistant", "intent": "acknowledges and asks for details" }
      ]
    },
    {
      "user_input": "Tomorrow at 2pm",
      "expectations": [
        { "type": "function_call", "function_name": "book_appointment" },
        { "type": "message", "role": "assistant", "intent": "confirms the booking" }
      ]
    }
  ]
}
```

### `PUT /api/scenarios/{scenario_id}`

Update a scenario. All fields are optional. Saving increments the version and creates a revision snapshot.

### `DELETE /api/scenarios/{scenario_id}`

### `GET /api/scenarios/{scenario_id}/versions`

List revision history (most recent first, up to 50 entries).

```json
// Response 200
[
  { "version": 3, "created_at": "..." },
  { "version": 2, "created_at": "..." },
  { "version": 1, "created_at": "..." }
]
```

### `POST /api/scenarios/{scenario_id}/versions/{version}/restore`

Restore a scenario to a previous version. Creates a new version with the restored content.

```json
// Response 200 — the updated scenario
```

### `GET /api/scenarios/{scenario_id}/export`

Export a scenario as a portable JSON object.

```json
// Response 200
{
  "version": 3,
  "scenario": { /* full ScenarioCreate shape */ }
}
```

### `POST /api/scenarios/import`

Import a previously exported scenario.

```json
// Request — the ScenarioCreate object from an export
{ "name": "...", "agent_id": "uuid", "turns": [...] }
```

---

## Suites

### `GET /api/suites`

### `GET /api/suites/{suite_id}`

Returns the suite with its linked scenarios.

### `POST /api/suites`

```json
// Request
{
  "name": "Regression suite",
  "description": "All regression tests",
  "scenario_ids": ["uuid1", "uuid2"]
}
```

### `PUT /api/suites/{suite_id}`

```json
// Request (all fields optional)
{
  "name": "Updated name",
  "scenario_ids": ["uuid1", "uuid2", "uuid3"]
}
```

Providing `scenario_ids` replaces the full set of scenarios in the suite.

### `DELETE /api/suites/{suite_id}`

---

## Runs

### `GET /api/runs`

List runs. Filter parameters:

| Parameter | Type | Description |
|---|---|---|
| `scenario_id` | uuid | Filter by scenario |
| `suite_id` | uuid | Filter by suite |
| `agent_id` | uuid | Filter by agent |
| `status` | string | `passed`, `failed`, `error`, `running`, `pending` |
| `limit` | int | Max results (default 100) |

### `GET /api/runs/{run_id}`

Returns the run with all turn results, events, and judge verdicts.

```json
// Response 200
{
  "id": "uuid",
  "scenario_id": "uuid",
  "status": "passed",
  "duration_ms": 4200,
  "created_at": "...",
  "completed_at": "...",
  "turn_results": [
    {
      "turn_index": 0,
      "user_input": "Hello",
      "events": [
        { "type": "message", "role": "assistant", "content": "Hi! How can I help?" }
      ],
      "passed": true,
      "judge_verdicts": [
        {
          "expectation_index": 0,
          "passed": true,
          "intent": "greets the user",
          "reasoning": "The assistant responded with a greeting and offered assistance."
        }
      ],
      "latency_ms": 1240
    }
  ]
}
```

### `POST /api/runs`

Execute a scenario. Runs synchronously and returns when complete.

```json
// Request
{ "scenario_id": "uuid" }

// Response 201 — the completed run
```

### `POST /api/runs/suite`

Execute all scenarios in a suite. Returns a list of runs.

```json
// Request
{ "suite_id": "uuid" }

// Response 201
[ /* array of completed runs */ ]
```

### `DELETE /api/runs/{run_id}`

---

## Failures

### `GET /api/failures`

Returns failed runs with the first failing turn surfaced for quick triage.

```json
// Response 200
[
  {
    "run_id": "uuid",
    "scenario_id": "uuid",
    "scenario_name": "Booking flow",
    "failed_turn_index": 1,
    "failed_expectation": { "type": "function_call", "function_name": "book_appointment" },
    "reasoning": "No function_call event was emitted.",
    "created_at": "..."
  }
]
```

---

## Automation

### `GET /api/automation/schedules`

List all schedules.

### `POST /api/automation/schedules`

Create a schedule.

```json
// Request
{
  "target_type": "scenario",
  "scenario_id": "uuid",
  "interval_minutes": 60,
  "is_active": true
}
```

For suite schedules, use `"target_type": "suite"` and `suite_id` instead.

### `GET /api/automation/schedules/{schedule_id}`

### `PUT /api/automation/schedules/{schedule_id}`

```json
// Request (all fields optional)
{ "interval_minutes": 120, "is_active": false }
```

### `DELETE /api/automation/schedules/{schedule_id}`

### `GET /api/automation/alerts`

Returns unacknowledged regression alerts (scenarios that went from passing to failing).

```json
// Response 200
[
  {
    "id": "uuid",
    "scenario_id": "uuid",
    "scenario_name": "Booking flow",
    "run_id": "uuid",
    "previous_run_id": "uuid",
    "title": "Regression detected",
    "detail": "...",
    "created_at": "..."
  }
]
```

### `POST /api/automation/alerts/{alert_id}/ack`

Acknowledge an alert (marks it as reviewed).

---

## Error responses

All errors follow this shape:

```json
{ "detail": "Human-readable error message" }
```

| Status | Meaning |
|---|---|
| 400 | Bad request (validation error, missing required field) |
| 401 | Missing or invalid token |
| 403 | Forbidden (resource belongs to another user) |
| 404 | Resource not found |
| 500 | Internal server error |
