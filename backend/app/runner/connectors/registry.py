from __future__ import annotations

from app.runner.connectors.base import AgentConnector
from app.runner.connectors.http_json import HttpJsonConnector
from app.runner.connectors.local_python import LocalPythonConnector


_CONNECTORS: dict[str, AgentConnector] = {
    "local_python": LocalPythonConnector(),
    "rest_api": HttpJsonConnector(),
}


def get_connector(provider_type: str | None) -> AgentConnector:
    if not provider_type:
        return _CONNECTORS["local_python"]
    return _CONNECTORS.get(provider_type, _CONNECTORS["local_python"])
