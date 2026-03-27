from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import re

from app.agents.utils import (
    build_job_id,
    bullets_from_description,
    classify_function,
    deduplicate_jobs,
    extract_skills,
    normalize_company_name,
    summarize_text,
)
from app.schemas import JobRecord, JobSearchInput

IRRELEVANT_ROLE_TERMS = {
    "intern",
    "internship",
    "teacher",
    "bpo",
    "call center",
    "sales promoter",
}

CONSULTANCY_TERMS = {
    "consultancy",
    "consultancies",
    "staffing",
    "recruitment services",
    "manpower",
}

TIME_FILTER_TO_DAYS = {"24h": 1, "7d": 7, "30d": 30}

RECRUITER_TITLES = [
    "Talent Acquisition Specialist",
    "Senior Recruiter",
    "Technical Recruiter",
    "HR Business Partner",
]


def _stable_int(seed: str, minimum: int, maximum: int) -> int:
    value = int(hashlib.md5(seed.encode("utf-8")).hexdigest()[:8], 16)
    return minimum + (value % (maximum - minimum + 1))


def _time_window_days(search: JobSearchInput) -> int:
    return TIME_FILTER_TO_DAYS.get(search.time_filter.value, 7)


def _seniority_from_experience(experience: str | None) -> str:
    raw = (experience or "").lower()
    if any(token in raw for token in ("0-2", "1-3", "fresher", "entry")):
        return "Entry Level"
    if any(token in raw for token in ("3-6", "4-8", "mid", "associate")):
        return "Mid Level"
    if any(token in raw for token in ("8+", "10+", "lead", "principal", "architect")):
        return "Senior Level"
    return "Mid Level"


def _looks_irrelevant(title: str, description: str) -> bool:
    haystack = f"{title} {description}".lower()
    return any(term in haystack for term in IRRELEVANT_ROLE_TERMS)


def _is_consultancy(company_name: str) -> bool:
    token = (company_name or "").lower()
    return any(term in token for term in CONSULTANCY_TERMS)


def _normalize_title(keyword: str) -> str:
    return f"{keyword.strip()} Engineer".replace("  ", " ").title()


def _detect_hiring_spikes(records: list[dict], recent_window_days: int, historical_window_days: int) -> list[dict]:
    now = datetime.now(UTC).date()
    baseline_window_days = max(recent_window_days, historical_window_days - recent_window_days)

    grouped: dict[tuple[str, str], dict[str, int]] = {}
    for rec in records:
        posted_raw = rec.get("posted_date")
        try:
            posted_date = datetime.fromisoformat(posted_raw).date() if posted_raw else now
        except (TypeError, ValueError):
            posted_date = now
        age_days = (now - posted_date).days
        key = (rec.get("company_name", ""), rec.get("function", "Other"))
        bucket = grouped.setdefault(key, {"recent": 0, "baseline": 0})
        if age_days <= recent_window_days:
            bucket["recent"] += 1
        elif age_days <= recent_window_days + baseline_window_days:
            bucket["baseline"] += 1

    for rec in records:
        key = (rec.get("company_name", ""), rec.get("function", "Other"))
        counts = grouped.get(key, {"recent": 0, "baseline": 0})
        recent = counts["recent"]
        baseline = counts["baseline"]
        spike = recent >= 3 and (baseline == 0 or recent >= baseline * 2)
        rec["is_hiring_spike"] = spike
        rec["recruiter_signal"] = (
            "High recruiter activity"
            if spike and (rec.get("openings") or 0) >= 3
            else ("Active recruiter outreach" if (rec.get("recruiter") and (rec.get("openings") or 0) >= 2) else "Standard")
        )
    return records


async def naukri_jobs(search: JobSearchInput, company_name: str) -> list[dict]:
    companies = search.company_list or [company_name]
    out: list[dict] = []
    now = datetime.now(UTC).date()
    historical_window = max(7, int(search.historical_window or 30))
    recent_window = _time_window_days(search)
    seniority_level = _seniority_from_experience(search.experience_level)

    for company in companies:
        normalized_company = normalize_company_name(company)
        for keyword in search.keywords[: search.job_limit_per_company]:
            posting_count = _stable_int(f"{normalized_company}:{keyword}:count", 1, 4)
            for slot in range(posting_count):
                location = (search.locations or ["Remote"])[slot % max(1, len(search.locations or ["Remote"]))]
                title = _normalize_title(keyword)
                desc = (
                    f"Lead {keyword} initiatives, partner with IT and business stakeholders, "
                    f"and deliver transformation outcomes for {normalized_company}."
                )
                fn = classify_function(f"{title} {desc}")
                keyword_slug = re.sub(r"\s+", "-", keyword.strip().lower())
                posted_age = _stable_int(f"{normalized_company}:{keyword}:{slot}:posted", 0, historical_window)
                posted_date = (now - timedelta(days=posted_age)).isoformat()
                openings = _stable_int(f"{normalized_company}:{keyword}:{slot}:openings", 1, 6)
                recruiter = f"{RECRUITER_TITLES[slot % len(RECRUITER_TITLES)]} - {normalized_company}"

                if _looks_irrelevant(title, desc):
                    continue

                record = JobRecord(
                    job_id=build_job_id(normalized_company, title, location, "naukri"),
                    company_name=normalized_company,
                    job_title=title,
                    seniority_level=seniority_level,
                    function=fn,
                    experience_range=search.experience_level or "5-10 years",
                    location=location,
                    posted_date=posted_date,
                    role_responsibilities=bullets_from_description(desc),
                    key_skills=extract_skills(desc),
                    summary=summarize_text(desc),
                    source="Naukri",
                    source_url=f"https://www.naukri.com/{keyword_slug}-jobs",
                    openings=openings,
                    recruiter=recruiter,
                    description=desc,
                )
                out.append(record.model_dump())

    # Remove consultancy duplicates / duplicate postings.
    out = [r for r in out if not _is_consultancy(r.get("company_name", ""))]
    if search.function_filter:
        allow = {f.lower() for f in search.function_filter}
        out = [r for r in out if (r.get("function") or "").lower() in allow]
    if search.seniority_filter:
        allow = {s.lower() for s in search.seniority_filter}
        out = [r for r in out if (r.get("seniority_level") or "").lower() in allow]
    if search.exclude_internships:
        out = [r for r in out if "intern" not in (r.get("job_title", "").lower())]

    # Strict de-dup across same company/title/location/day.
    dedupe_seen: set[tuple[str, str, str, str]] = set()
    deduped: list[dict] = []
    for rec in out:
        key = (
            normalize_company_name(rec.get("company_name", "")),
            re.sub(r"\s+", " ", (rec.get("job_title", "") or "").strip().lower()),
            (rec.get("location", "") or "").strip().lower(),
            rec.get("posted_date", "") or "",
        )
        if key in dedupe_seen:
            continue
        dedupe_seen.add(key)
        rec["company_name"] = key[0]
        deduped.append(rec)

    spiked = _detect_hiring_spikes(deduped, recent_window_days=recent_window, historical_window_days=historical_window)
    return deduplicate_jobs(spiked)
