from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any

import requests

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"


class GroqClientError(RuntimeError):
    pass


async def groq_call(
    prompt: str,
    *,
    model: str | None = None,
    temperature: float = 0.0,
    timeout_seconds: int = 25,
    max_retries: int = 3,
) -> dict[str, Any]:
    """Call Groq chat completions and safely parse the model response as JSON."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise GroqClientError("Missing GROQ_API_KEY")

    selected_model = model or os.getenv("GROQ_MODEL", "mixtral-8x7b-32768")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": selected_model,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
    }

    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            response = await asyncio.to_thread(
                requests.post,
                GROQ_ENDPOINT,
                headers=headers,
                json=payload,
                timeout=timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return _safe_json_parse(content)
        except Exception as exc:  # noqa: BLE001 - intentional retry wrapper
            last_error = exc
            if attempt < max_retries:
                await asyncio.sleep(0.75 * attempt)

    raise GroqClientError(f"Groq call failed after {max_retries} attempts: {last_error}")


def _safe_json_parse(raw: str) -> dict[str, Any]:
    """Attempt strict JSON parse, then fallback to extracting the first object."""
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    raise GroqClientError("Model returned invalid JSON")
