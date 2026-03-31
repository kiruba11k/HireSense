from __future__ import annotations

import asyncio
import random
import time
import re
import uuid
from datetime import datetime
from urllib.parse import quote_plus

import requests

from app.services.deduplicator import apply_hiring_spike, deduplicate_jobs
from app.services.models import NaukriJob, NaukriRunRequest
from app.services.parser import build_job_record, parse_job_details, parse_search_page

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
]


class NaukriScraper:
    def __init__(self):
        self.max_pages = 3
        self.max_detail_pages = 30
        self.max_concurrency = 4

    def _headers(self) -> dict[str, str]:
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Connection": "keep-alive",
        }

    def build_search_url(self, keyword: str, location: str, experience: str | None, page: int = 1) -> str:
        keyword_slug = quote_plus(keyword.lower().replace(" ", "-"))
        location_slug = quote_plus(location.lower().replace(" ", "-")) if location else "india"
        exp_min = re.findall(r"\d+", experience or "")
        exp_param = exp_min[0] if exp_min else "0"
        if page == 1:
            return f"https://www.naukri.com/{keyword_slug}-jobs-in-{location_slug}?k={quote_plus(keyword)}&l={quote_plus(location)}&experience={exp_param}"
        return f"https://www.naukri.com/{keyword_slug}-jobs-{page}-in-{location_slug}?k={quote_plus(keyword)}&l={quote_plus(location)}&experience={exp_param}"

    def _fetch(self, url: str, timeout: int = 20) -> str:
        for attempt in range(3):
            response = requests.get(url, headers=self._headers(), timeout=timeout)
            if response.status_code == 200 and "captcha" not in response.text.lower():
                return response.text
            time.sleep(1.2 * (attempt + 1))
        raise RuntimeError("Naukri temporarily blocked scraping")

    async def _fetch_detail(self, sem: asyncio.Semaphore, url: str) -> tuple[str, str | None, list[str]]:
        async with sem:
            try:
                html = await asyncio.to_thread(self._fetch, url)
                role, skills = parse_job_details(html)
                return url, role, skills
            except Exception:
                return url, None, []

    async def run(self, payload: NaukriRunRequest, status_cb=None) -> list[NaukriJob]:
        keywords = payload.keywords or ["AI"]
        locations = payload.locations or ["India"]
        staged_raw: list[dict[str, str]] = []

        if status_cb:
            status_cb("Scraping search page")

        for keyword in keywords:
            for location in locations:
                for page in range(1, self.max_pages + 1):
                    url = self.build_search_url(keyword, location, payload.experience, page)
                    try:
                        html = await asyncio.to_thread(self._fetch, url)
                    except RuntimeError:
                        continue
                    staged_raw.extend(parse_search_page(html, "https://www.naukri.com"))

        if status_cb:
            status_cb("Parsing jobs")

        staged_raw = staged_raw[: self.max_detail_pages]
        sem = asyncio.Semaphore(self.max_concurrency)
        detail_tasks = [
            asyncio.create_task(self._fetch_detail(sem, item.get("source_url", "")))
            for item in staged_raw
            if item.get("source_url")
        ]

        details: dict[str, tuple[str | None, list[str]]] = {}
        if detail_tasks:
            for detail_url, role, skills in await asyncio.gather(*detail_tasks):
                details[detail_url] = (role, skills)

        jobs: list[NaukriJob] = []
        for raw in staged_raw:
            raw_url = raw.get("source_url", "")
            role, skills = details.get(raw_url, (None, []))
            built = build_job_record(raw, str(uuid.uuid4()), role, skills)
            if built is None:
                continue
            built.scraped_timestamp = datetime.utcnow()
            jobs.append(built)

        if status_cb:
            status_cb("Deduplicating")

        jobs = deduplicate_jobs(jobs)
        jobs = apply_hiring_spike(jobs)
        return jobs
