import time
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import Agent
from app.runner.connectors import get_connector
from app.schemas.chat import ChatMessage, ChatTurnRequest, ChatTurnResponse

router = APIRouter()


@dataclass
class SimpleAgent:
    provider_type: str = "local_python"
    connection_config: dict[str, Any] = field(default_factory=dict)


@dataclass
class SimpleScenario:
    agent_module: str
    agent_class: str
    agent: SimpleAgent
    llm_model: str
    judge_model: str | None = None
    chat_history: list[dict[str, str]] = field(default_factory=list)
    mock_tools: dict[str, Any] | None = None


@router.post("/turn", response_model=ChatTurnResponse)
async def chat_turn(data: ChatTurnRequest, db: AsyncSession = Depends(get_db)):
    """
    Stateless chat turn runner.

    We re-create an AgentSession per request, but seed it with the provided history so the
    agent behaves consistently turn-to-turn. The client owns the transcript.
    """
    module = data.agent_module
    cls_name = data.agent_class
    llm_model = data.llm_model
    agent_kwargs = data.agent_args or {}
    provider_type = "local_python"
    connection_config = {}

    if data.agent_id:
        res = await db.execute(select(Agent).where(Agent.id == data.agent_id))
        agent_model = res.scalar_one_or_none()
        if not agent_model:
            raise HTTPException(status_code=400, detail="agent_id not found")
        module = agent_model.module
        cls_name = agent_model.agent_class
        llm_model = agent_model.default_llm_model
        if not data.agent_args and agent_model.default_agent_args:
            agent_kwargs = agent_model.default_agent_args
        provider_type = agent_model.provider_type or "local_python"
        connection_config = agent_model.connection_config or {}

    # Shim the scenario interface required by connectors
    # Convert Pydantic chat history to list of dicts for connectors
    history_dicts = [{"role": msg.role, "content": msg.content} for msg in data.history or []]

    scenario = SimpleScenario(
        agent_module=module,
        agent_class=cls_name,
        agent=SimpleAgent(provider_type=provider_type, connection_config=connection_config),
        llm_model=llm_model,
        chat_history=history_dicts,
        mock_tools=data.mock_tools,
    )

    connector = get_connector(provider_type)

    turn_start = time.monotonic()
    try:
        async with connector.create_runtime(scenario, agent_kwargs) as runtime:
            turn_output = await runtime.run_turn(data.user_input, data.mock_tools)
            events = turn_output.events
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Turn execution failed: {type(e).__name__}: {str(e)}")

    assistant_msgs = [
        e.get("content", "")
        for e in events
        if e.get("type") == "message" and e.get("role") == "assistant"
    ]
    assistant_message = (assistant_msgs[-1] if assistant_msgs else "").strip()
    if not assistant_message:
        # Fallback: show at least *something* in the UI if the agent only tool-called.
        assistant_message = "(no assistant message)"

    _ = (time.monotonic() - turn_start) * 1000

    next_history = [
        *data.history,
        ChatMessage(role="user", content=data.user_input),
        ChatMessage(role="assistant", content=assistant_message),
    ]
    return ChatTurnResponse(assistant_message=assistant_message, events=events, history=next_history)
