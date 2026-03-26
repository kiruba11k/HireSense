from __future__ import annotations

from enum import Enum
from typing import Any

import requests

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

    BASE_URL = "https://linkedin-job-search-api.p.rapidapi.com"

    def __init__(self, host: str | None = None, api_key: str | None = None, timeout: int = 30):
        self.host = host or settings.LINKEDIN_RAPIDAPI_HOST
        self.api_key = api_key or settings.LINKEDIN_RAPIDAPI_KEY
        self.timeout = timeout
        self.base_url = self.BASE_URL

    def search(self, window: LinkedInWindow, params: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("Missing LINKEDIN_RAPIDAPI_KEY environment variable")

        endpoint = WINDOW_ENDPOINT_MAP[window]
        cleaned_params = {k: v for k, v in params.items() if v is not None and v != ""}
        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.host,
            "Content-Type": "application/json",
        }
        try:
            response = requests.get(
                f"{self.base_url}{endpoint}",
                headers=headers,
                params=cleaned_params,
                timeout=self.timeout,
            )
        except Exception as exc:
            raise RuntimeError(f"RapidAPI request failed: {str(exc)}") from exc

        print("REQUEST PARAMS:", cleaned_params)
        print("STATUS:", response.status_code)
        print("RESPONSE:", response.text[:300])

        content_type = response.headers.get("content-type", "").lower()
        data: Any
        if content_type.startswith("application/json"):
            try:
                data = response.json()
            except ValueError:
                data = response.text
        else:
            data = response.text

        return {
            "status_code": response.status_code,
            "window": window.value,
            "path": endpoint,
            "data": data,
        }
