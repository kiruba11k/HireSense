import asyncio
import json
import random
import uuid
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

from app.services.models import NaukriJob, NaukriRunRequest
from app.services.parser import build_job_record
from app.services.deduplicator import deduplicate_jobs


USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (X11; Linux x86_64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
]


class NaukriScraper:

    def __init__(self):
        self.max_pages = 3
        self.concurrency = 10

    def headers(self):

        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html",
        }

    def build_search_url(self, keyword, location, page):

        keyword_slug = keyword.lower().replace(" ", "-")
        location_slug = location.lower().replace(" ", "-")

        base = f"https://www.naukri.com/{keyword_slug}-jobs-in-{location_slug}"

        params = {
            "k": keyword,
            "l": location
        }

        if page > 1:
            params["pageNo"] = page

        query = "&".join(f"{k}={quote_plus(str(v))}" for k, v in params.items())

        return f"{base}?{query}"

    async def fetch(self, client, url):

        try:
            res = await client.get(url, headers=self.headers())
            if res.status_code == 200:
                return res.text
        except Exception:
            return None

    def extract_next_data(self, html):

        soup = BeautifulSoup(html, "lxml")

        script = soup.select_one("script#__NEXT_DATA__")

        if not script:
            return []

        try:
            data = json.loads(script.text)
        except Exception:
            return []

        jobs = []

        def walk(node):

            if isinstance(node, dict):

                title = node.get("title") or node.get("jobTitle")

                if title:

                    jobs.append({
                        "job_title": title,
                        "company_name": node.get("companyName", "Unknown"),
                        "location": node.get("location", ""),
                        "experience_range": node.get("experienceText", ""),
                        "key_skills": ", ".join(node.get("tagsAndSkills", [])),
                        "source_url": node.get("jdURL", ""),
                        "role_responsibilities": "",
                        "posted_date": ""
                    })

                for v in node.values():
                    walk(v)

            elif isinstance(node, list):

                for item in node:
                    walk(item)

        walk(data)

        return jobs

    async def scrape_page(self, client, url):

        html = await self.fetch(client, url)

        if not html:
            return []

        return self.extract_next_data(html)

    async def run(self, payload: NaukriRunRequest):

        keywords = payload.keywords or ["developer"]
        locations = payload.locations or ["India"]

        self.max_pages = payload.max_pages

        urls = []

        for keyword in keywords:
            for location in locations:
                for page in range(1, self.max_pages + 1):

                    urls.append(
                        self.build_search_url(keyword, location, page)
                    )

        async with httpx.AsyncClient(timeout=30) as client:

            tasks = [self.scrape_page(client, url) for url in urls]

            results = await asyncio.gather(*tasks)

        raw_jobs = []

        for r in results:
            raw_jobs.extend(r)

        jobs = []

        for raw in raw_jobs:

            try:
                job = build_job_record(raw)
                jobs.append(job)
            except Exception:
                continue

        jobs = deduplicate_jobs(jobs)

        return jobs
