---
id: ci-automation
sidebar_position: 6
---

# CI & Automation

## API tokens

For CI pipelines and scripts, use an API token instead of a JWT. Tokens:
- Are prefixed with `ab_`
- Do not expire until revoked
- Are tied to a specific user account

**Generate a token** from **Profile → API Token** in the UI, or:

```bash
curl -X POST http://localhost:8000/api/auth/api-token \
  -H "Authorization: Bearer $JWT_TOKEN"
```

Store the token as a secret in your CI environment. Use it as a bearer token in all requests:

```
Authorization: Bearer ab_your_token_here
```

---

## Running tests from CI

### Run a single scenario

```bash
curl -X POST https://your-bench.example.com/api/runs \
  -H "Authorization: Bearer $BENCH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "scenario_id": "your-scenario-uuid" }'
```

The request is synchronous — it returns when the run completes.

Check the result:

```bash
STATUS=$(curl -s https://your-bench.example.com/api/runs/$RUN_ID \
  -H "Authorization: Bearer $BENCH_TOKEN" | jq -r '.status')

if [ "$STATUS" != "passed" ]; then
  echo "Scenario failed: $STATUS"
  exit 1
fi
```

### Run a suite

```bash
curl -X POST https://your-bench.example.com/api/runs/suite \
  -H "Authorization: Bearer $BENCH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "suite_id": "your-suite-uuid" }'
```

Returns an array of runs. Check that all statuses are `passed`:

```bash
FAILED=$(echo $RESPONSE | jq '[.[] | select(.status != "passed")] | length')

if [ "$FAILED" -gt 0 ]; then
  echo "$FAILED scenario(s) failed"
  exit 1
fi
```

### GitHub Actions example

```yaml
name: Agent regression tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  bench:
    runs-on: ubuntu-latest
    steps:
      - name: Run Bench suite
        env:
          BENCH_TOKEN: ${{ secrets.BENCH_TOKEN }}
          BENCH_URL: ${{ secrets.BENCH_URL }}
          SUITE_ID: ${{ vars.BENCH_SUITE_ID }}
        run: |
          RESPONSE=$(curl -sf -X POST "$BENCH_URL/api/runs/suite" \
            -H "Authorization: Bearer $BENCH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"suite_id\": \"$SUITE_ID\"}")

          FAILED=$(echo $RESPONSE | jq '[.[] | select(.status != "passed")] | length')

          if [ "$FAILED" -gt 0 ]; then
            echo "❌ $FAILED scenario(s) failed"
            echo $RESPONSE | jq '[.[] | select(.status != "passed") | {id, status}]'
            exit 1
          fi

          echo "✅ All scenarios passed"
```

---

## Scheduled runs

Use scheduled runs for continuous regression coverage — Bench will automatically re-run your scenarios at a fixed interval without any CI trigger needed.

### Create a schedule

```bash
curl -X POST https://your-bench.example.com/api/automation/schedules \
  -H "Authorization: Bearer $BENCH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "suite",
    "suite_id": "your-suite-uuid",
    "interval_minutes": 60,
    "is_active": true
  }'
```

Common intervals:

| Interval | `interval_minutes` |
|---|---|
| Every 15 minutes | `15` |
| Hourly | `60` |
| Every 6 hours | `360` |
| Daily | `1440` |

### Pause and resume

```bash
# Pause
curl -X PUT https://your-bench.example.com/api/automation/schedules/$SCHEDULE_ID \
  -H "Authorization: Bearer $BENCH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "is_active": false }'

# Resume
curl -X PUT ... -d '{ "is_active": true }'
```

---

## Regression alerts

When a scheduled run detects that a scenario went from `passed` to `failed`, Bench creates a regression alert. Alerts appear in **Automation → Alerts** in the UI.

### Check for unacknowledged alerts

```bash
curl https://your-bench.example.com/api/automation/alerts \
  -H "Authorization: Bearer $BENCH_TOKEN"
```

If the array is non-empty, there are unresolved regressions.

### Acknowledge an alert

After investigating a regression:

```bash
curl -X POST https://your-bench.example.com/api/automation/alerts/$ALERT_ID/ack \
  -H "Authorization: Bearer $BENCH_TOKEN"
```

---

## Smoke test script

Before integrating a new external agent, use the built-in smoke script to verify your endpoint is reachable and returns a valid response:

```bash
API_BASE=https://your-bench.example.com/api \
API_TOKEN=ab_your_token \
python backend/scripts/smoke_http_json_agent.py \
  --endpoint https://your-agent.example.com/bench/run \
  --test-endpoint https://your-agent.example.com/health
```

This creates a temporary agent in Bench, runs a connection test, and cleans up after itself.

---

## Environment variables reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `OPENAI_API_KEY` | Yes | Used by the LLM judge for evaluation |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `CORS_ORIGINS` | No | JSON array of allowed origins, default `["http://localhost:3000"]` |

### Frontend

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (default: `http://localhost:8000`) |
