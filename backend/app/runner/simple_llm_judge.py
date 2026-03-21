from __future__ import annotations

import json
import os
from typing import Literal

from openai import AsyncOpenAI

Verdict = Literal["pass", "fail", "maybe"]


async def evaluate_intent(content: str, intent: str, model_name: str | None = None) -> tuple[bool, str]:
    """Evaluates if the content meets the intent using an LLM."""
    if not model_name:
        model_name = "gpt-4o"

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return False, "OPENAI_API_KEY not set"

    client = AsyncOpenAI(api_key=api_key)

    tools = [
        {
            "type": "function",
            "function": {
                "name": "submit_verdict",
                "description": "Submit the evaluation verdict.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "verdict": {
                            "type": "string",
                            "enum": ["pass", "fail", "maybe"],
                            "description": "The judgment verdict.",
                        },
                        "reasoning": {
                            "type": "string",
                            "description": "Brief explanation of the reasoning.",
                        },
                    },
                    "required": ["verdict", "reasoning"],
                },
            },
        }
    ]

    messages = [
        {
            "role": "system",
            "content": (
                "You are an evaluator for conversational AI agents. "
                "Analyze the message against the given criteria, then call submit_verdict "
                "with your verdict ('pass', 'fail', or 'maybe') and a brief reasoning."
            ),
        },
        {
            "role": "user",
            "content": f"Criteria: {intent}\n\nMessage: {content}\n\nEvaluate if the message meets the criteria.",
        },
    ]

    try:
        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            tools=tools,
            tool_choice={"type": "function", "function": {"name": "submit_verdict"}},
            temperature=0.0,
        )

        choice = response.choices[0]
        if not choice.message.tool_calls:
            return False, "LLM did not call submit_verdict"

        tool_call = choice.message.tool_calls[0]
        args = json.loads(tool_call.function.arguments)
        verdict = args.get("verdict")
        reasoning = args.get("reasoning", "No reasoning provided")

        if verdict == "pass":
            return True, reasoning
        return False, reasoning

    except Exception as e:
        return False, f"Judge error: {str(e)}"
