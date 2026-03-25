from __future__ import annotations

from datetime import UTC, datetime

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


async def naukri_jobs(search: JobSearchInput, company_name: str) -> list[dict]:
    companies = search.company_list or [company_name]
    out: list[dict] = []

    for company in companies:
        normalized_company = normalize_company_name(company)
        for keyword in search.keywords[: search.job_limit_per_company]:
            title = f"{keyword} Consultant"
            desc = (
                f"Drive {keyword} roadmap, optimize delivery quality, and partner with business teams "
                f"for {normalized_company}."
            )
            fn = classify_function(f"{title} {desc}")
            record = JobRecord(
                job_id=build_job_id(normalized_company, title, (search.locations or ["Remote"])[0], "naukri"),
                company_name=normalized_company,
                job_title=title,
                function=fn,
                experience_range=search.experience_level or "5-10 years",
                location=(search.locations or ["Remote"])[0],
                posted_date=datetime.now(UTC).date().isoformat(),
                role_responsibilities=bullets_from_description(desc),
                key_skills=extract_skills(desc),
                summary=summarize_text(desc),
                source="Naukri",
                source_url="https://www.naukri.com/",
                openings=2,
                recruiter="Internal Talent Team",
                description=desc,
            )
            out.append(record.model_dump())

    # Remove consultancy duplicates / duplicate postings.
    out = [r for r in out if "consultancy" not in (r.get("company_name", "").lower())]
    if search.function_filter:
        allow = {f.lower() for f in search.function_filter}
        out = [r for r in out if (r.get("function") or "").lower() in allow]

    return deduplicate_jobs(out)
