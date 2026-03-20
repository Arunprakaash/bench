# API Reference

Base URL:

- `http://localhost:8000`

Swagger/OpenAPI:

- `http://localhost:8000/api/docs`
- `http://localhost:8000/api/openapi.json`

Postman collection:

- `backend/postman/Bench-API.postman_collection.json`

## Auth

All endpoints that create/update/delete require a valid bearer token.
Bearer token can be either:

- a JWT from `POST /api/auth/login` or `POST /api/auth/register`
- a user API token from `POST /api/auth/api-token` (for programmatic access such as CI/scripts)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/auth/change-password`
- `GET /api/auth/api-token`
- `POST /api/auth/api-token`
- `DELETE /api/auth/api-token`
- `POST /api/auth/logout`

## Scenarios

- `GET /api/scenarios`
- `GET /api/scenarios/{scenario_id}`
- `POST /api/scenarios`
- `PUT /api/scenarios/{scenario_id}`
- `DELETE /api/scenarios/{scenario_id}`
- `GET /api/scenarios/{scenario_id}/export`
- `GET /api/scenarios/{scenario_id}/versions`
- `POST /api/scenarios/import`

## Suites

- `GET /api/suites`
- `GET /api/suites/{suite_id}`
- `POST /api/suites`
  - supports `scenario_ids` (optional)
- `PUT /api/suites/{suite_id}`
  - supports `scenario_ids` (optional)
- `DELETE /api/suites/{suite_id}`

## Runs

- `GET /api/runs`
- `GET /api/runs/{run_id}`
- `POST /api/runs`
  - execute a single scenario
- `POST /api/runs/suite`
  - execute all scenarios in a suite
- `DELETE /api/runs/{run_id}`

## Failures

- `GET /api/failures`

## Automation

- `GET /api/automation/schedules`
- `POST /api/automation/schedules`
- `DELETE /api/automation/schedules/{schedule_id}`
- `GET /api/automation/alerts`
- `POST /api/automation/alerts/{alert_id}/ack`
