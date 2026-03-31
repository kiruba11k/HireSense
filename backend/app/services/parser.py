from __future__ import annotations

import json
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from app.services.models import NaukriJob

COMPANY_SPAM_KEYWORDS = ("consultancy", "staffing", "solutions", "recruitment")
ALLOWED_FUNCTIONS = {
    "it",
    "technology",
    "finance",
    "operations",
    "procurement",
    "digital transformation",
}


def _extract_posted_date(text: str) -> str | None:
    if not text:
        return None
    match = re.search(r"(\d+\+?\s*(?:day|days|hour|hours|week|weeks|month|months)\s+ago)", text, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    return text.strip()[:100]


def _infer_function(job_title: str, description: str) -> str:
    blob = f"{job_title} {description}".lower()
    if any(token in blob for token in ("finance", "account", "finops")):
        return "Finance"
    if any(token in blob for token in ("procurement", "supply chain", "sourcing")):
        return "Procurement"
    if any(token in blob for token in ("operation", "ops")):
        return "Operations"
    if any(token in blob for token in ("digital transformation", "transformation")):
        return "Digital Transformation"
    if any(token in blob for token in ("software", "developer", "engineer", "cloud", "data", "qa", "it", "ai")):
        return "Technology"
    return "IT"


def normalize_company_name(name: str) -> str:
    cleaned = re.sub(
        r"\b(pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|inc\.?|llp)\b",
        "",
        name,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", cleaned).strip(" -,")


def should_filter_company(name: str) -> bool:
    value = name.lower()
    return any(token in value for token in COMPANY_SPAM_KEYWORDS)


def should_filter_seniority(title: str) -> bool:
    value = title.lower()
    return "intern" in value or "trainee" in value


def parse_search_page(html: str, base_url: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "lxml")
    jobs: list[dict[str, str]] = []

    cards = soup.select("article.jobTuple") or soup.select("div.srp-jobtuple-wrapper") or soup.select("div.row1")
    for card in cards:
        anchor = card.select_one("a.title") or card.select_one("a[href*='/job-listings-']")
        company_el = card.select_one("a.comp-name") or card.select_one("span.comp-name")
        location_el = card.select_one("span.locWdth") or card.select_one("span.location")
        exp_el = card.select_one("span.expwdth") or card.select_one("span.exp")
        skills = [skill.get_text(strip=True) for skill in card.select("ul.tags-gt li")]
        desc_el = card.select_one("span.job-desc")
        posted_el = card.select_one("span.job-post-day") or card.select_one("span.job-post-day")

        if not anchor:
            continue

        href = anchor.get("href", "")
        jobs.append(
            {
                "job_title": anchor.get_text(strip=True),
                "company_name": company_el.get_text(strip=True) if company_el else "Unknown",
                "location": location_el.get_text(strip=True) if location_el else "",
                "experience_range": exp_el.get_text(strip=True) if exp_el else "",
                "key_skills": ", ".join(skills),
                "role_responsibilities": desc_el.get_text(strip=True) if desc_el else "",
                "posted_date": _extract_posted_date(posted_el.get_text(" ", strip=True) if posted_el else ""),
                "source_url": href if href.startswith("http") else urljoin(base_url, href),
            }
        )

    if not jobs:
        scripts = soup.select("script[type='application/ld+json']")
        for script in scripts:
            try:
                payload = json.loads(script.text)
            except json.JSONDecodeError:
                continue
            entries = payload if isinstance(payload, list) else [payload]
            for item in entries:
                if not isinstance(item, dict) or item.get("@type") != "JobPosting":
                    continue
                jobs.append(
                    {
                        "job_title": item.get("title", ""),
                        "company_name": (item.get("hiringOrganization") or {}).get("name", "Unknown"),
                        "location": ((item.get("jobLocation") or {}).get("address") or {}).get("addressLocality", ""),
                        "experience_range": "",
                        "key_skills": "",
                        "role_responsibilities": BeautifulSoup(item.get("description", ""), "lxml").get_text(" ", strip=True),
                        "posted_date": item.get("datePosted", ""),
                        "source_url": item.get("url", base_url),
                    }
                )

    return jobs


def parse_job_details(html: str) -> tuple[str | None, list[str]]:
    soup = BeautifulSoup(html, "lxml")
    detail = soup.select_one("section.styles_job-desc-container__txpYf") or soup.select_one("div.styles_JDC__dang-inner-html__h0K4t")
    role = detail.get_text(" ", strip=True)[:4000] if detail else None
    skills = [node.get_text(strip=True) for node in soup.select("div.styles_key-skill a") if node.get_text(strip=True)]
    return role, skills


def build_job_record(raw: dict[str, str], fallback_job_id: str, detailed_role: str | None, detail_skills: list[str]) -> NaukriJob | None:
    company = normalize_company_name(raw.get("company_name", "Unknown"))
    title = raw.get("job_title", "").strip()
    if not company or not title:
        return None
    if should_filter_company(company) or should_filter_seniority(title):
        return None

    role_text = detailed_role or raw.get("role_responsibilities") or ""
    inferred_function = _infer_function(title, role_text)
    if inferred_function.lower() not in ALLOWED_FUNCTIONS:
        return None

    merged_skills = [item.strip() for item in (raw.get("key_skills", "").split(",") + detail_skills) if item and item.strip()]

    return NaukriJob(
        job_id=fallback_job_id,
        company_name=company,
        job_title=title,
        function=inferred_function,
        experience_range=raw.get("experience_range") or None,
        location=raw.get("location") or None,
        posted_date=raw.get("posted_date") or None,
        role_responsibilities=role_text or None,
        key_skills=sorted(set(merged_skills)),
        source_url=raw.get("source_url") or None,
    )
