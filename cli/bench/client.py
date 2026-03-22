"""HTTP client for the agent-bench backend API."""

import uuid

import httpx


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


class BenchClient:
    def __init__(self, base_url: str, token: str):
        self._base = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"}

    def _get(self, path: str, **params) -> dict | list:
        resp = httpx.get(f"{self._base}{path}", headers=self._headers, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, body: dict, timeout: float = 300) -> dict | list:
        resp = httpx.post(f"{self._base}{path}", headers=self._headers, json=body, timeout=timeout)
        resp.raise_for_status()
        return resp.json()

    def _delete(self, path: str) -> None:
        resp = httpx.delete(f"{self._base}{path}", headers=self._headers, timeout=15)
        resp.raise_for_status()

    @staticmethod
    def login(base_url: str, email: str, password: str) -> str:
        resp = httpx.post(
            f"{base_url.rstrip('/')}/api/auth/login",
            json={"email": email, "password": password},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["token"]

    # ------------------------------------------------------------------
    # Scenarios
    # ------------------------------------------------------------------

    def list_scenarios(self) -> list:
        return self._get("/api/scenarios")

    def resolve_scenario(self, name_or_id: str) -> dict | None:
        """Return scenario by name or UUID. None if not found."""
        if _is_uuid(name_or_id):
            try:
                return self._get(f"/api/scenarios/{name_or_id}")
            except httpx.HTTPStatusError:
                return None
        for s in self.list_scenarios():
            if s["name"].lower() == name_or_id.lower():
                return s
        return None

    def get_scenario(self, scenario_id: str) -> dict:
        return self._get(f"/api/scenarios/{scenario_id}")

    def delete_scenario(self, scenario_id: str) -> None:
        self._delete(f"/api/scenarios/{scenario_id}")

    # ------------------------------------------------------------------
    # Agents
    # ------------------------------------------------------------------

    def list_agents(self) -> list:
        return self._get("/api/agents")

    def resolve_agent(self, name_or_id: str) -> dict | None:
        if _is_uuid(name_or_id):
            try:
                return self._get(f"/api/agents/{name_or_id}")
            except httpx.HTTPStatusError:
                return None
        for a in self.list_agents():
            if a["name"].lower() == name_or_id.lower():
                return self._get(f"/api/agents/{a['id']}")
        return None

    # ------------------------------------------------------------------
    # Suites
    # ------------------------------------------------------------------

    def list_suites(self) -> list:
        return self._get("/api/suites")

    def resolve_suite(self, name_or_id: str) -> dict | None:
        if _is_uuid(name_or_id):
            try:
                return self._get(f"/api/suites/{name_or_id}")
            except httpx.HTTPStatusError:
                return None
        for s in self.list_suites():
            if s["name"].lower() == name_or_id.lower():
                return self._get(f"/api/suites/{s['id']}")
        return None

    def delete_suite(self, suite_id: str) -> None:
        self._delete(f"/api/suites/{suite_id}")

    def run_suite(self, suite_id: str) -> list:
        """Start a suite run; returns list of pending TestRunListResponse."""
        return self._post("/api/runs/suite", {"suite_id": suite_id}, timeout=30)

    # ------------------------------------------------------------------
    # Runs
    # ------------------------------------------------------------------

    def list_runs(self, scenario_id: str | None = None, status: str | None = None) -> list:
        params = {}
        if scenario_id:
            params["scenario_id"] = scenario_id
        if status:
            params["status"] = status
        return self._get("/api/runs", **params)

    def get_run(self, run_id: str) -> dict:
        return self._get(f"/api/runs/{run_id}")

    def delete_run(self, run_id: str) -> None:
        self._delete(f"/api/runs/{run_id}")

    def create_run(self, scenario_id: str) -> dict:
        """Trigger a scenario run and block until complete."""
        return self._post("/api/runs", {"scenario_id": scenario_id}, timeout=300)
