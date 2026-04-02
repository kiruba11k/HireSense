from __future__ import annotations

import time
from typing import Any
from urllib.parse import quote_plus

import requests

from app.config import settings


class NaukriApifyService:
    """Adapter for the third-party Apify Naukri scraper actor."""

    OUTPUT_COLUMNS = [
        "jobId",
        "staticCompanyName",
        "title",
        "functionalArea",
        "jobRole",
        "experienceText",
        "minimumExperience",
        "maximumExperience",
        "locations",
        "createdDate",
        "description",
        "shortDescription",
        "keySkills",
        "url",
        "applyRedirectUrl",
        "companyApplyUrl",
        "scrapedAt",
    ]

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
        companies = [company.strip() for company in (getattr(payload, "companies", []) or []) if company and company.strip()]
        seniority_filter = [item.strip() for item in (getattr(payload, "seniority_filter", []) or []) if item and item.strip()]
        function_filter = [item.strip() for item in (getattr(payload, "function_filter", []) or []) if item and item.strip()]
        experience = (getattr(payload, "experience", None) or "").strip()
        historical_window = int(getattr(payload, "historical_window", 30) or 30)

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

        max_pages = max(1, min(int(getattr(payload, "max_pages", 1) or 1), 25))

        urls: list[str] = []
        for location in locations:
            location_slug = self._slugify(location)
            base = f"https://www.naukri.com/{keyword_path}-jobs-in-{location_slug}"
            for page_no in range(1, max_pages + 1):
                page_query = f"&pageNo={page_no}" if page_no > 1 else ""
                query_parts = [
                    f"k={query_keywords}",
                    f"l={quote_plus(', '.join(locations))}",
                    "nignbevent_src=jobsearchDeskGNB",
                    f"freshness={freshness}",
                    f"history={max(1, min(historical_window, 180))}",
                ]
                if experience:
                    query_parts.append(f"experience={quote_plus(experience)}")
                if companies:
                    query_parts.append(f"company={quote_plus(', '.join(companies))}")
                if function_filter:
                    query_parts.append(f"functionArea={quote_plus(', '.join(function_filter))}")
                if seniority_filter:
                    query_parts.append(f"seniority={quote_plus(', '.join(seniority_filter))}")
                url = f"{base}?{'&'.join(query_parts)}{page_query}"
                urls.append(url)

        return urls

    def _filter_output_columns(self, items: Any) -> list[dict[str, Any]]:
        if not isinstance(items, list):
            return []

        filtered_rows: list[dict[str, Any]] = []
        for row in items:
            if not isinstance(row, dict):
                continue
            normalized = {column: row.get(column) for column in self.OUTPUT_COLUMNS}
            filtered_rows.append(normalized)
        return filtered_rows

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

        endpoint = f"{self.base_url}/runs"
        params = {"token": self.token}

        try:
            run_response = requests.post(
                endpoint,
                params=params,
                json=self._build_actor_input(payload),
                timeout=self.timeout,
            )
        except Exception as exc:
            raise RuntimeError(f"Apify request failed: {str(exc)}") from exc

        try:
            run_payload = run_response.json()
        except ValueError:
            run_payload = {}

        if run_response.status_code >= 400:
            detail = run_payload if isinstance(run_payload, dict) else run_response.text
            return {
                "status_code": run_response.status_code,
                "data": {"message": "Unable to start Naukri actor run", "detail": detail},
            }

        run_id = run_payload.get("data", {}).get("id")
        if not run_id:
            return {
                "status_code": 500,
                "data": {"message": "Apify actor run did not return a run id", "detail": run_payload},
            }

        run_status_endpoint = f"https://api.apify.com/v2/actor-runs/{run_id}"
        status: str | None = None
        default_dataset_id: str | None = None

        try:
            for _ in range(60):
                status_response = requests.get(run_status_endpoint, params=params, timeout=30)
                status_payload = status_response.json() if status_response.headers.get("content-type", "").startswith("application/json") else {}
                if status_response.status_code >= 400:
                    return {
                        "status_code": status_response.status_code,
                        "data": {"message": "Unable to fetch actor run status", "detail": status_payload or status_response.text},
                    }

                run_data = status_payload.get("data", {}) if isinstance(status_payload, dict) else {}
                status = run_data.get("status")
                default_dataset_id = run_data.get("defaultDatasetId")
                if status in {"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"}:
                    break
                time.sleep(2)
        except Exception as exc:
            raise RuntimeError(f"Unable to monitor Apify actor run: {str(exc)}") from exc

        if status != "SUCCEEDED":
            return {
                "status_code": 502,
                "data": {
                    "message": "Naukri actor run did not complete successfully",
                    "status": status or "UNKNOWN",
                    "run_id": run_id,
                },
            }

        if not default_dataset_id:
            return {
                "status_code": 500,
                "data": {
                    "message": "Naukri actor run completed but dataset id is missing",
                    "run_id": run_id,
                },
            }

        dataset_endpoint = f"https://api.apify.com/v2/datasets/{default_dataset_id}/items"
        try:
            dataset_response = requests.get(dataset_endpoint, params=params, timeout=self.timeout)
            data = dataset_response.json() if dataset_response.headers.get("content-type", "").startswith("application/json") else dataset_response.text
        except Exception as exc:
            raise RuntimeError(f"Unable to fetch Apify dataset items: {str(exc)}") from exc

        return {
            "status_code": dataset_response.status_code,
            "data": self._filter_output_columns(data) if dataset_response.status_code < 400 else data,
        }
