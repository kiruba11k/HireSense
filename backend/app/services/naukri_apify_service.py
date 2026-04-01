from __future__ import annotations

from typing import Any
from urllib.parse import quote_plus

import requests

from app.config import settings


class NaukriApifyService:
    """Adapter for the third-party Apify Naukri scraper actor."""

    def __init__(
        self,
        actor_id: str | None = None,
        token: str | None = None,
        timeout: int = 180,
    ):
        self.actor_id = actor_id or settings.NAUKRI_APIFY_ACTOR_ID
        self.token = token or settings.NAUKRI_APIFY_TOKEN
        self.timeout = timeout
        self.base_url = f"https://api.apify.com/v2/acts/{self.actor_id}"

    @staticmethod
    def _slugify(value: str) -> str:
        return "-".join(value.strip().lower().split())

    def _build_start_urls(self, payload: Any) -> list[str]:
        keywords = [keyword.strip() for keyword in (payload.keywords or []) if keyword and keyword.strip()]
        locations = [location.strip() for location in (payload.locations or []) if location and location.strip()]

        if not keywords:
            keywords = ["developer"]
        if not locations:
            locations = ["india"]

        keyword_path = self._slugify(" ".join(keywords))
        query_keywords = quote_plus(", ".join(keywords))

        freshness_map = {
            "24h": "1",
            "7d": "7",
            "30d": "30",
        }
        freshness = freshness_map.get(getattr(payload, "time_filter", "7d"), "7")

        urls: list[str] = []
        for location in locations:
            location_slug = self._slugify(location)
            base = f"https://www.naukri.com/{keyword_path}-jobs-in-{location_slug}"
            url = f"{base}?k={query_keywords}&nignbevent_src=jobsearchDeskGNB&freshness={freshness}"
            urls.append(url)

        return urls

    def _build_actor_input(self, payload: Any) -> dict[str, Any]:
        return {
            "includeAmbitionBoxDetails": False,
            "proxy": {
                "useApifyProxy": True,
                "apifyProxyGroups": ["RESIDENTIAL"],
            },
            "startUrls": self._build_start_urls(payload),
        }

    def search(self, payload: Any) -> dict[str, Any]:
        if not self.token:
            raise RuntimeError("Missing NAUKRI_APIFY_TOKEN environment variable")

        endpoint = f"{self.base_url}/run-sync-get-dataset-items"
        params = {"token": self.token}

        try:
            response = requests.post(
                endpoint,
                params=params,
                json=self._build_actor_input(payload),
                timeout=self.timeout,
            )
        except Exception as exc:
            raise RuntimeError(f"Apify request failed: {str(exc)}") from exc

        try:
            data = response.json()
        except ValueError:
            data = response.text

        return {
            "status_code": response.status_code,
            "data": data,
        }
