# Concepts

## Overview

```
Agent → Scenario → Run → Turn Results
          ↓
        Suite → Suite Run
          ↓
       Schedule → Regression Alerts
```

---

## Agent

An agent is the system under test. It receives a user message and returns a structured response (events).

Bench supports two connector types:

| Type | Use case |
|---|---|
| `local_python` | Agent implemented as a Python class in the backend codebase |
| `rest_api` | Agent running as an external HTTP service |

Each agent stores:
- **Connection config** — how to reach the agent (endpoint, headers, timeout)
- **Default LLM model** — used when running scenarios
- **Default judge model** — used to evaluate test expectations
- **Default agent args** — constructor/initialization parameters

Agent configuration is versioned. Every time you run a test, Bench captures an immutable snapshot of the agent config used, so you can always reproduce the exact conditions of a past run.

---

## Scenario

A scenario defines a multi-turn conversation and the expectations for each turn.

### Structure

```
Scenario
  └── Turn 1
        ├── user_input: "Hello"
        └── expectations:
              └── { type: "message", role: "assistant", intent: "greets the user" }
  └── Turn 2
        ├── user_input: "What is my order status?"
        └── expectations:
              ├── { type: "function_call", function_name: "lookup_order" }
              └── { type: "message", role: "assistant", intent: "reports the order status" }
```

### Expectations

Each turn can have one or more expectations. All expectations in a turn must pass for the turn to pass.

**`message`** — checks that the agent produced a message matching an intent

```json
{ "type": "message", "role": "assistant", "intent": "confirms the booking" }
```

The `intent` is evaluated by an LLM judge — it checks semantic meaning, not exact text.

**`function_call`** — checks that the agent called a tool

```json
{ "type": "function_call", "function_name": "book_appointment", "function_args": { "date": "2024-01-15" } }
```

`function_args` is optional. If omitted, only the function name is checked.

**`function_call_output`** — checks that the agent processed a tool result

```json
{ "type": "function_call_output" }
```

**`agent_handoff`** — checks that the agent transferred control

```json
{ "type": "agent_handoff", "new_agent_type": "billing_agent" }
```

### Versioning

Every save creates a new version. You can view the full history and restore any previous version from the scenario detail page.

### Import / Export

Scenarios can be exported as JSON and imported into another Bench instance, making it easy to share test cases across environments.

---

## Run

A run is one execution of a scenario. Bench calls your agent for each turn, collects the response events, and evaluates them against your expectations.

### Turn execution

For each turn:
1. Bench sends `user_input` (plus chat history, agent args, etc.) to the agent
2. The agent returns a list of events
3. Bench evaluates each expectation against the events

### Run status

| Status | Meaning |
|---|---|
| `pending` | Queued, not yet started |
| `running` | Executing turns |
| `passed` | All turns passed |
| `failed` | One or more turns failed |
| `error` | Execution error (e.g. agent unreachable, invalid response) |

### Execution snapshot

Every run stores an immutable snapshot of the agent config and scenario version used. This lets you:
- Debug failures with the exact config that was active
- Compare runs across agent versions
- Replay a test under identical conditions

---

## Suite

A suite is a named collection of scenarios. Use suites to group related tests (e.g. all happy-path scenarios, all edge cases for a specific feature).

Running a suite executes all its scenarios and produces individual run results for each. Suite runs are tracked separately so you can see aggregate pass rates over time.

---

## Failures

The Failures page is an inbox of failed runs. It surfaces the first failing turn per run, with the expectation that failed and the judge's reasoning. This makes it easy to triage regressions without opening each run individually.

---

## Automation

### Scheduled runs

You can schedule a scenario or suite to run automatically at a fixed interval (every N minutes, hourly, daily). This gives you continuous regression coverage without manual execution.

### Regression alerts

When a scenario that previously passed starts failing, Bench creates a regression alert. Alerts appear in the Automation → Alerts section. You can acknowledge them once investigated.

This catches regressions automatically — even changes you didn't make yourself (e.g. a model update, an infrastructure change affecting your agent).

---

## Authentication

### Session login

Register at `/auth/register` or log in at `/auth/login`. Sessions use JWT tokens (7-day expiry).

### API tokens

For CI pipelines and scripts, generate an API token from **Profile → API Token**. Tokens are prefixed with `ab_` and never expire until revoked.

Use the token as a bearer token:

```
Authorization: Bearer ab_<your_token>
```

Revoke a token from the Profile page at any time. Only one token can be active per user.
