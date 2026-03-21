# Getting Started

## Prerequisites

- Docker and Docker Compose
- An OpenAI API key (used by the LLM judge for evaluating test results)

## 1. Start the stack

```bash
docker compose up -d --build
```

This starts:

| Service | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| Backend (FastAPI) | http://localhost:8000 |
| Swagger UI | http://localhost:8000/api/docs |
| Adminer (DB GUI) | http://localhost:8080 |

The backend applies schema migrations automatically on startup. No manual migration step is needed.

## 2. Set your OpenAI key

Add it to `backend/.env`:

```env
OPENAI_API_KEY=sk-...
```

Then restart the backend:

```bash
docker compose restart backend
```

The key is required for LLM-based evaluation of test expectations. Without it, runs will error on any `intent`-based expectation.

## 3. Seed demo data (optional)

Creates a demo user, an example agent, several scenarios, and a suite:

```bash
docker compose exec backend python scripts/reset_and_seed.py
```

Demo login:
- Email: `prakaasharun50@gmail.com`
- Password: `123456`

> **Warning:** This resets the database. Do not run against a production instance.

## 4. Register an account

Open http://localhost:3000 and register. Each user owns their own agents and scenarios.

## 5. Create an agent

An agent is the target under test — it can be a local Python class or an external HTTP endpoint.

**For an external REST API agent:**

1. Go to **Agents → New Agent**
2. Set **Connector Type** to `REST API (External)`
3. Fill in your endpoint URL and any required headers
4. Click **Test Connection** to verify reachability

See [Connecting External Agents](./connecting-agents.md) for the full integration guide.

## 6. Create a scenario

A scenario defines the conversation turns and what you expect the agent to do.

1. Go to **Scenarios → New Scenario**
2. Select your agent
3. Add one or more turns — each turn has:
   - **User input** — the message sent to the agent
   - **Expectations** — what the agent should do in response
4. Save the scenario

### Expectation types

| Type | Checks |
|---|---|
| `message` | Agent replied with a message matching an intent (LLM-judged) |
| `function_call` | Agent called a specific tool with expected arguments |
| `function_call_output` | Agent processed a tool result |
| `agent_handoff` | Agent transferred to another agent type |

## 7. Run a test

Open a scenario and click **Run Test**. Bench executes each turn in order, calls your agent, and evaluates the response against your expectations.

The run detail page shows:
- Overall pass/fail status
- Per-turn events (messages, tool calls, handoffs)
- Evaluation verdicts with reasoning
- Latency per turn

## 8. Group scenarios into a suite

Suites let you run related scenarios together.

1. Go to **Suites → New Suite**
2. Add scenarios
3. Click **Run Suite** to execute all of them in one go

## Next steps

- [Concepts](./concepts.md) — understand how everything fits together
- [Connecting External Agents](./connecting-agents.md) — integrate your agent via REST API
- [CI & Automation](./ci-automation.md) — schedule regression runs and integrate with CI
