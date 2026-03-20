# Developer Guide

## Architecture (high level)

- Frontend: Next.js app (React) + shadcn/ui components
- Backend: FastAPI + SQLAlchemy (async)
- Execution engine: runs scenarios using the agent runtime (LiveKit testing API)
- Streaming: execution progress is streamed to the UI via Socket.IO events

## Local development (Docker)

Start everything:

```bash
docker compose up -d --build
```

The backend Swagger UI is available at:

- http://localhost:8000/api/docs

Seed demo data (resets DB):

```bash
docker compose exec backend python scripts/reset_and_seed.py
```

## Environment

Backend uses `backend/.env` and `docker-compose.yml` passes:

- `DATABASE_URL`
- `REDIS_URL`
- `CORS_ORIGINS`

If you’re missing `OPENAI_API_KEY`, judge/evaluation steps may fail or be incomplete.

## Common operational notes

- The backend performs lightweight schema initialization at startup.
- Test execution runs may be long; watch the backend logs for execution errors.
- If a run creation fails (5xx), check backend stack traces for the endpoint.

## API + Postman

For quick manual testing, use:

- Postman: `backend/postman/Bench-API.postman_collection.json`
- Swagger: `/api/docs`

