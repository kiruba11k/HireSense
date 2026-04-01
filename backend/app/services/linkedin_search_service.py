from __future__ import annotations

from typing import Any

import requests

from app.config import settings


class LinkedInSearchService:
    """Infrastructure adapter for Apify LinkedIn jobs actor."""

    def __init__(
        self,
        actor_id: str | None = None,
        token: str | None = None,
        timeout: int = 120,
    ):
        self.actor_id = actor_id or settings.LINKEDIN_APIFY_ACTOR_ID
        self.token = token or settings.LINKEDIN_APIFY_TOKEN
        self.timeout = timeout
        self.base_url = f"https://api.apify.com/v2/acts/{self.actor_id}"

    def search(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.token:
            raise RuntimeError("Missing LINKEDIN_APIFY_TOKEN environment variable")

        endpoint = f"{self.base_url}/run-sync-get-dataset-items"
        params = {"token": self.token}

        try:
            response = requests.post(
                endpoint,
                params=params,
                json=payload,
                timeout=self.timeout,
            )
        except Exception as exc:
            raise RuntimeError(f"Apify request failed: {str(exc)}") from exc

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
            "path": "/run-sync-get-dataset-items",
            "data": data,
        }
