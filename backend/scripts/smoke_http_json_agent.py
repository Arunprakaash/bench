"""
Create a rest_api agent and run connection-test in one command.

Usage:
  API_BASE=http://localhost:8000/api \
  API_TOKEN=<bearer token> \
  python scripts/smoke_http_json_agent.py \
    --endpoint https://example.com/agent/run \
    --test-endpoint https://example.com/health
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any


def _fail(message: str, response: Any | None = None) -> None:
    print(message, file=sys.stderr)
    if response is not None:
        print(f"  HTTP {response.status_code}: {response.text}", file=sys.stderr)
    raise SystemExit(1)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a rest_api agent and test its connection.")
    parser.add_argument(
        "--base",
        default=os.environ.get("API_BASE", "http://127.0.0.1:8000/api").rstrip("/"),
        help="Base API URL (default: API_BASE or http://127.0.0.1:8000/api)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("API_TOKEN", "").strip(),
        help="Bearer token for Bench API (default: API_TOKEN env var)",
    )
    parser.add_argument(
        "--endpoint",
        required=True,
        help="Remote agent run endpoint used by rest_api connector",
    )
    parser.add_argument(
        "--test-endpoint",
        default="",
        help="Optional health/check endpoint for connection-test (defaults to --endpoint)",
    )
    parser.add_argument(
        "--name",
        default="Remote HTTP Agent (smoke)",
        help="Agent name to create",
    )
    parser.add_argument(
        "--auth-header",
        default="",
        help="Optional Authorization header value sent to remote endpoint, e.g. 'Bearer xyz'",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    import httpx

    if not args.token:
        _fail("Missing token. Provide --token or set API_TOKEN.")

    headers = {"Authorization": f"Bearer {args.token}"}
    remote_headers = {"X-Bench-Smoke": "true"}
    if args.auth_header:
        remote_headers["Authorization"] = args.auth_header

    create_payload = {
        "name": args.name,
        "description": "Smoke-test agent for rest_api connector",
        "module": "remote.http",
        "agent_class": "HttpJsonAgent",
        "provider_type": "rest_api",
        "connection_config": {
            "endpoint": args.endpoint,
            "method": "POST",
            "timeout_ms": 30000,
            "headers": remote_headers,
            "events_path": "events",
            "test_endpoint": args.test_endpoint or args.endpoint,
            "test_method": "GET" if args.test_endpoint else "POST",
        },
        "default_llm_model": "gpt-4o-mini",
        "default_judge_model": "gpt-4o-mini",
        "tags": ["remote", "http", "smoke"],
    }

    with httpx.Client(timeout=30) as client:
        print(f"Creating agent at {args.base}/agents ...")
        create = client.post(f"{args.base}/agents", json=create_payload, headers=headers)
        if create.status_code >= 400:
            _fail("Create agent failed.", create)
        agent = create.json()
        agent_id = agent["id"]
        print(f"  Created agent: {agent.get('name')} ({agent_id})")

        print("Running connection test ...")
        test = client.post(f"{args.base}/agents/{agent_id}/connection-test", headers=headers)
        if test.status_code >= 400:
            _fail("Connection test failed.", test)
        out = test.json()
        print("  Connection test response:")
        print(f"    ok={out.get('ok')}")
        print(f"    provider_type={out.get('provider_type')}")
        if out.get("detail"):
            print(f"    detail={out['detail']}")
        if out.get("sample"):
            print(f"    sample={out['sample']}")


if __name__ == "__main__":
    main()
