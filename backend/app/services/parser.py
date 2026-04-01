from __future__ import annotations

import json
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from app.services.models import NaukriJob

COMPANY_SPAM_KEYWORDS = ("consultancy", "staffing", "recruitment", "placement")
ALLOWED_FUNCTIONS = {
    "it",
    "technology",
    "finance",
    "operations",
    "procurement",
    "digital transformation",
}
IRRELEVANT_ROLE_KEYWORDS = {
    "telecaller",
    "customer support",
    "bpo",
    "field sales",
    "inside sales",
    "insurance advisor",
    "real estate agent",
    "telesales",
}


def _walk_json(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from _walk_json(value)
    elif isinstance(node, list):
        for item in node:
            yield from _walk_json(item)


def _extract_jobs_from_next_data(soup: BeautifulSoup, base_url: str) -> list[dict[str, str]]:
    next_data = soup.select_one("script#__NEXT_DATA__")
    if not next_data:
        return []

    text = (next_data.string or next_data.get_text() or "").strip()
    if not text:
        return []

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return []

    jobs: list[dict[str, str]] = []
    for node in _walk_json(payload):
        title = (node.get("title") or node.get("jobTitle") or "").strip() if isinstance(node, dict) else ""
        if not title:
            continue

        company = (
            node.get("companyName")
            or node.get("company")
            or ((node.get("compInfo") or {}).get("companyName") if isinstance(node.get("compInfo"), dict) else "")
            or "Unknown"
        )
        location = node.get("location") or node.get("jobLocation") or ""
        if isinstance(location, list):
            location = ", ".join(str(item).strip() for item in location if str(item).strip())
        experience = node.get("experienceText") or node.get("experience") or node.get("exp") or ""
        posted = node.get("footerPlaceholderLabel") or node.get("postedDate") or node.get("createdDate") or ""
        skills = node.get("tagsAndSkills") or node.get("skills") or []
        if isinstance(skills, list):
            skill_text = ", ".join(str(skill).strip() for skill in skills if str(skill).strip())
        else:
            skill_text = str(skills).strip()

        source_url = node.get("jdURL") or node.get("url") or node.get("jobDetailUrl") or ""
        if source_url and not str(source_url).startswith("http"):
            source_url = urljoin(base_url, str(source_url))

        jobs.append(
            {
                "job_title": title,
                "company_name": str(company).strip() or "Unknown",
                "location": str(location).strip(),
                "experience_range": str(experience).strip(),
                "key_skills": skill_text,
                "role_responsibilities": str(node.get("jobDescription") or node.get("jobDetails") or "").strip(),
                "posted_date": _extract_posted_date(str(posted)),
                "source_url": str(source_url) if source_url else base_url,
            }
        )
    return jobs


def _extract_posted_date(text: str) -> str | None:
    if not text:
        return None
    match = re.search(r"(\d+\+?\s*(?:day|days|hour|hours|week|weeks|month|months)\s+ago)", text, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    return text.strip()[:100]


def infer_seniority(job_title: str, experience_range: str | None = None) -> str:
    blob = f"{job_title} {experience_range or ''}".lower()
    if any(token in blob for token in ("director", "vp", "head ", "chief", "cxo")):
        return "Executive"
    if any(token in blob for token in ("senior", "lead", "principal", "architect", "manager")):
        return "Mid-Senior"
    if any(token in blob for token in ("intern", "trainee", "fresher", "apprentice")):
        return "Entry"
    return "Associate"


def _infer_function(job_title: str, description: str) -> str:
    blob = f"{job_title} {description}".lower()
    if any(token in blob for token in ("finance", "account", "finops", "tax", "fp&a")):
        return "Finance"
    if any(token in blob for token in ("procurement", "supply chain", "sourcing", "vendor")):
        return "Procurement"
    if any(token in blob for token in ("operation", "ops", "process excellence")):
        return "Operations"
    if any(token in blob for token in ("digital transformation", "transformation", "change management")):
        return "Digital Transformation"
    if any(token in blob for token in ("software", "developer", "engineer", "cloud", "data", "qa", "it", "ai", "sap", "erp")):
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


def is_irrelevant_role(title: str, role_text: str) -> bool:
    blob = f"{title} {role_text}".lower()
    return any(token in blob for token in IRRELEVANT_ROLE_KEYWORDS)


def parse_search_page(html: str, base_url: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "lxml")
    jobs: list[dict[str, str]] = []

    cards = soup.select("article.jobTuple, div.srp-jobtuple-wrapper, div.row1, div.cust-job-tuple")
    for card in cards:
        anchor = card.select_one("a.title") or card.select_one("a[href*='/job-listings-']") or card.select_one("a[title]")
        company_el = card.select_one("a.comp-name, span.comp-name, a.subTitle")
        location_el = card.select_one("span.locWdth, span.location, li.location span")
        exp_el = card.select_one("span.expwdth, span.exp, li.experience span")
        skills = [skill.get_text(strip=True) for skill in card.select("ul.tags-gt li, ul.tags li")]
        desc_el = card.select_one("span.job-desc, div.job-desc")
        posted_el = card.select_one("span.job-post-day") or card.select_one("span.jobTupleFooter span")

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

    if not jobs:
        jobs = _extract_jobs_from_next_data(soup, base_url)

    if not jobs:
        for script in soup.select("script"):
            text = (script.string or script.get_text() or "").strip()
            if not text:
                continue

            if "\"jobTuple\"" in text or "\"tuple\"" in text:
                for match in re.finditer(r"\{[^{}]{0,2000}\}", text):
                    snippet = match.group(0)
                    if "jobId" not in snippet and "title" not in snippet:
                        continue
                    try:
                        item = json.loads(snippet)
                    except json.JSONDecodeError:
                        continue

                    title = item.get("title") or item.get("jobTitle") or ""
                    company = item.get("companyName") or item.get("company") or "Unknown"
                    location = item.get("location") or ""
                    placeholders = item.get("placeholders")
                    if not location and isinstance(placeholders, list) and placeholders:
                        first_placeholder = placeholders[0]
                        if isinstance(first_placeholder, dict):
                            location = first_placeholder.get("label") or ""
                    experience = item.get("experienceText") or item.get("experience") or ""
                    posted = item.get("footerPlaceholderLabel") or item.get("postedDate") or ""
                    skills = item.get("tagsAndSkills") or item.get("skills") or []
                    if isinstance(skills, list):
                        skill_text = ", ".join(str(skill).strip() for skill in skills if str(skill).strip())
                    else:
                        skill_text = str(skills)

                    source_url = (
                        item.get("jdURL")
                        or item.get("url")
                        or item.get("jobDetailUrl")
                        or ""
                    )
                    if source_url and not str(source_url).startswith("http"):
                        source_url = urljoin(base_url, str(source_url))

                    if title:
                        jobs.append(
                            {
                                "job_title": str(title).strip(),
                                "company_name": str(company).strip() or "Unknown",
                                "location": str(location).strip(),
                                "experience_range": str(experience).strip(),
                                "key_skills": skill_text,
                                "role_responsibilities": str(item.get("jobDescription") or item.get("jobDetails") or "").strip(),
                                "posted_date": _extract_posted_date(str(posted)),
                                "source_url": str(source_url) if source_url else base_url,
                            }
                        )

    if not jobs:
        for node in soup.select("div[data-job-id], article[data-job-id], a[href*='job-listings']"):
            anchor = node if node.name == "a" else node.select_one("a[href*='job-listings'], a[title], a.title")
            if not anchor:
                continue
            title = anchor.get("title") or anchor.get_text(strip=True)
            href = anchor.get("href", "")
            if not title:
                continue
            jobs.append(
                {
                    "job_title": title,
                    "company_name": "Unknown",
                    "location": "",
                    "experience_range": "",
                    "key_skills": "",
                    "role_responsibilities": "",
                    "posted_date": None,
                    "source_url": href if href.startswith("http") else urljoin(base_url, href),
                }
            )

    deduped: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for job in jobs:
        key = (job.get("job_title", "").strip().lower(), job.get("company_name", "").strip().lower())
        if not key[0] or key in seen:
            continue
        seen.add(key)
        deduped.append(job)

    return deduped


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
        seniority_level=infer_seniority(title, raw.get("experience_range")),
        experience_range=raw.get("experience_range") or None,
        location=raw.get("location") or None,
        posted_date=raw.get("posted_date") or None,
        role_responsibilities=role_text or None,
        key_skills=sorted(set(merged_skills)),
        source_url=raw.get("source_url") or None,
    )
