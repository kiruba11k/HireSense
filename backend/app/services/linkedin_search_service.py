from __future__ import annotations

import http.client
import json
from enum import Enum
from typing import Any
from urllib.parse import urlencode

from app.config import settings


class LinkedInWindow(str, Enum):
    last_24h = "24h"
    last_7d = "7d"
    last_6m = "6m"


WINDOW_ENDPOINT_MAP: dict[LinkedInWindow, str] = {
    LinkedInWindow.last_24h: "/active-jb-24h",
    LinkedInWindow.last_7d: "/active-jb-7d",
    LinkedInWindow.last_6m: "/active-jb-6m",
}


class LinkedInSearchService:
    """Infrastructure adapter for RapidAPI LinkedIn jobs endpoints."""

    def __init__(self, host: str | None = None, api_key: str | None = None, timeout: int = 30):
        self.host = host or settings.LINKEDIN_RAPIDAPI_HOST
        self.api_key = api_key or settings.LINKEDIN_RAPIDAPI_KEY
        self.timeout = timeout

    def search(self, window: LinkedInWindow, params: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("Missing LINKEDIN_RAPIDAPI_KEY environment variable")

        endpoint = WINDOW_ENDPOINT_MAP[window]
        query = urlencode({k: v for k, v in params.items() if v is not None and v != ""}, doseq=False)
        path = f"{endpoint}?{query}" if query else endpoint

        conn = http.client.HTTPSConnection(self.host, timeout=self.timeout)
        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.host,
            "Content-Type": "application/json",
        }

        conn.request("GET", path, headers=headers)
        response = conn.getresponse()
        payload = response.read().decode("utf-8")
        conn.close()

        parsed: Any
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            parsed = {"raw": payload}

        if response.status < 400 and isinstance(parsed, dict):
            raw = parsed.get("raw")
            if isinstance(raw, str) and "<title>404" in raw:
                parsed = {
                    "error": "RapidAPI returned an invalid LinkedIn page response (404).",
                    "hint": "Use plain filter values (for example: location_filter=United States,United Kingdom) and avoid raw LinkedIn URLs or quoted OR expressions.",
                    "raw": raw[:500],
                }
                return {
                    "status_code": 502,
                    "window": window.value,
                    "path": path,
                    "data": parsed,
                }

        return {
            "status_code": response.status,
            "window": window.value,
            "path": path,
            "data": parsed,
        }
