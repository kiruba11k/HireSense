import asyncio
import random

import httpx

from app.services.parser import parse_search_page
from app.services.parser import build_job_record
from app.services.deduplicator import deduplicate_jobs


USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
]


class NaukriScraper:

    def __init__(self):

        self.max_pages = 3

    def headers(self):

        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html",
            "Referer": "https://www.naukri.com/",
        }

    def build_url(self, keyword, location, page):

        keyword = keyword.replace(" ", "-")
        location = location.replace(" ", "-")

        base = f"https://www.naukri.com/{keyword}-jobs-in-{location}"

        if page == 1:
            return base

        return f"{base}-{page}"

    async def fetch(self, client, url):

        try:
            r = await client.get(url, headers=self.headers(), timeout=30)
            return r.text
        except:
            return ""

    async def run(self, payload):

        keywords = payload.keywords or ["developer"]
        locations = payload.locations or ["india"]

        urls = []

        for keyword in keywords:
            for loc in locations:
                for page in range(1, payload.max_pages + 1):

                    urls.append(self.build_url(keyword, loc, page))

        async with httpx.AsyncClient() as client:

            tasks = [self.fetch(client, u) for u in urls]

            html_pages = await asyncio.gather(*tasks)

        raw_jobs = []

        for html in html_pages:

            jobs = parse_search_page(html)

            raw_jobs.extend(jobs)

        jobs = []

        for raw in raw_jobs:

            try:
                jobs.append(build_job_record(raw))
            except:
                continue

        jobs = deduplicate_jobs(jobs)

        return jobs
