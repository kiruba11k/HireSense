from __future__ import annotations

import asyncio
import random
import re
import time
import uuid
from datetime import datetime
from urllib.parse import quote_plus

import requests
try:
    from selenium import webdriver
    from selenium.common.exceptions import NoSuchElementException, StaleElementReferenceException, TimeoutException
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:  # pragma: no cover - optional runtime dependency
    webdriver = None

from app.services.deduplicator import apply_hiring_spike, deduplicate_jobs
from app.services.models import NaukriJob, NaukriRunRequest
from app.services.parser import (
    build_job_record,
    is_irrelevant_role,
    parse_job_details,
    parse_search_page,
    should_filter_company,
    should_filter_seniority,
)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
]


class NaukriScraper:
    def __init__(self):
        self.max_pages = 3
        self.max_detail_pages = 30
        self.max_concurrency = 4
        self.browser_wait_timeout = 15

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

    def _scrape_search_pages_with_browser(self, payload: NaukriRunRequest, status_cb=None) -> list[dict[str, str]]:
        if webdriver is None:
            return []

        chrome_options = Options()
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument(f"user-agent={random.choice(USER_AGENTS)}")

        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        wait = WebDriverWait(driver, self.browser_wait_timeout)
        scraped: list[dict[str, str]] = []
        seen: set[tuple[str, str, str]] = set()
        keywords = payload.keywords or ["AI"]
        locations = payload.locations or ["India"]

        try:
            for keyword in keywords:
                for location in locations:
                    url = self.build_search_url(keyword, location, payload.experience, page=1)
                    driver.get(url)
                    page_count = 1

                    while page_count <= self.max_pages:
                        try:
                            wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "srp-jobtuple-wrapper")))
                        except TimeoutException:
                            break

                        cards = driver.find_elements(By.CLASS_NAME, "srp-jobtuple-wrapper")
                        if not cards:
                            break

                        first_card = cards[0]
                        for card in cards:
                            try:
                                title_el = card.find_element(By.CLASS_NAME, "title")
                                title = title_el.text.strip()
                                if not title:
                                    continue

                                company = card.find_element(By.CLASS_NAME, "comp-name").text.strip()
                                source_url = (title_el.get_attribute("href") or "").strip()
                                if not source_url:
                                    continue

                                try:
                                    exp = card.find_element(By.CLASS_NAME, "expwdth").text.strip()
                                except NoSuchElementException:
                                    exp = ""

                                try:
                                    salary = card.find_element(By.CLASS_NAME, "sal-wrap").text.strip()
                                except NoSuchElementException:
                                    salary = ""

                                try:
                                    loc = card.find_element(By.CLASS_NAME, "locWdth").text.strip()
                                except NoSuchElementException:
                                    loc = ""

                                try:
                                    desc = card.find_element(By.CLASS_NAME, "job-desc").text.strip()
                                except NoSuchElementException:
                                    desc = ""

                                try:
                                    posted_date = card.find_element(By.CLASS_NAME, "job-post-day").text.strip()
                                except NoSuchElementException:
                                    posted_date = ""

                                tag_nodes = card.find_elements(By.CLASS_NAME, "tag-li")
                                key_skills = ", ".join(tag.text.strip() for tag in tag_nodes if tag.text.strip())
                                if salary and salary.lower() not in desc.lower():
                                    desc = f"{desc} Salary: {salary}".strip()

                                key = (title.lower(), company.lower(), source_url)
                                if key in seen:
                                    continue
                                seen.add(key)
                                scraped.append(
                                    {
                                        "job_title": title,
                                        "company_name": company or "Unknown",
                                        "location": loc,
                                        "experience_range": exp,
                                        "key_skills": key_skills,
                                        "role_responsibilities": desc,
                                        "posted_date": posted_date,
                                        "source_url": source_url,
                                    }
                                )
                            except (StaleElementReferenceException, NoSuchElementException):
                                continue

                        if status_cb:
                            status_cb(f"Scraped page {page_count} for {keyword} in {location}")

                        try:
                            next_button = driver.find_element(By.CSS_SELECTOR, "a.styles_btn-secondary__2AsIP")
                            if "next" not in next_button.text.lower():
                                break
                            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_button)
                            driver.execute_script("arguments[0].click();", next_button)
                            wait.until(EC.staleness_of(first_card))
                            page_count += 1
                            time.sleep(1)
                        except (NoSuchElementException, TimeoutException):
                            break
        finally:
            driver.quit()

        return scraped

    async def _fetch_detail(self, sem: asyncio.Semaphore, url: str) -> tuple[str, str | None, list[str]]:
        async with sem:
            try:
                html = await asyncio.to_thread(self._fetch, url)
                role, skills = parse_job_details(html)
                return url, role, skills
            except Exception:
                return url, None, []

    def _posted_within_days(self, posted_date: str | None, max_days: int) -> bool:
        if not posted_date:
            return True
        value = posted_date.lower().strip()
        if "today" in value or "just" in value:
            return True
        match = re.search(r"(\d+)", value)
        if not match:
            return True
        amount = int(match.group(1))
        if "hour" in value:
            return True
        if "week" in value:
            return amount * 7 <= max_days
        if "month" in value:
            return amount * 30 <= max_days
        return amount <= max_days

    async def run(self, payload: NaukriRunRequest, status_cb=None) -> list[NaukriJob]:
        keywords = payload.keywords or ["AI"]
        locations = payload.locations or ["India"]
        staged_raw: list[dict[str, str]] = []

        if status_cb:
            status_cb("Scraping search pages")

        staged_raw = await asyncio.to_thread(self._scrape_search_pages_with_browser, payload, status_cb)
        if not staged_raw:
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
            status_cb("Parsing job details")

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

            if payload.remove_consultancy_duplicates and should_filter_company(built.company_name):
                continue
            if payload.exclude_irrelevant_roles and is_irrelevant_role(built.job_title, built.role_responsibilities or ""):
                continue
            if should_filter_seniority(built.job_title):
                continue

            built.scraped_timestamp = datetime.utcnow()
            jobs.append(built)

        if status_cb:
            status_cb("Applying filters")

        days_window = 1 if payload.time_filter == "24h" else (7 if payload.time_filter == "7d" else 30)
        days_window = min(days_window, payload.historical_window)
        jobs = [job for job in jobs if self._posted_within_days(job.posted_date, days_window)]

        if payload.companies:
            allow = {item.lower().strip() for item in payload.companies}
            jobs = [job for job in jobs if any(token in job.company_name.lower() for token in allow)]

        if payload.seniority_filter:
            allow = {item.lower().strip() for item in payload.seniority_filter}
            jobs = [job for job in jobs if (job.seniority_level or "").lower() in allow]

        if payload.function_filter:
            allow = {item.lower().strip() for item in payload.function_filter}
            jobs = [job for job in jobs if (job.function or "").lower() in allow]

        if status_cb:
            status_cb("Deduplicating jobs")

        jobs = deduplicate_jobs(jobs)
        jobs = apply_hiring_spike(jobs)
        return jobs
