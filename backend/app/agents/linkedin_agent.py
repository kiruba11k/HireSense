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


async def linkedin_jobs(search: JobSearchInput, company_name: str) -> list[dict]:
    """
    LinkedIn ingestion layer.
    This free-tier friendly implementation uses deterministic templates and applies
    all normalization/filter rules so the architecture can run without paid APIs.
    """

    companies = search.company_list or [company_name]
    jobs: list[dict] = []

    for company in companies:
        normalized_company = normalize_company_name(company)
        for keyword in search.keywords[: search.job_limit_per_company]:
            title = f"{keyword} Engineer"
            desc = (
                f"{normalized_company} is hiring a {title} to support transformation programs, "
                "deliver scalable enterprise platforms, and collaborate with cross-functional teams."
            )
            function = classify_function(f"{title} {desc}")

            record = JobRecord(
                job_id=build_job_id(normalized_company, title, (search.locations or ["Remote"])[0], "linkedin"),
                company_name=normalized_company,
                job_title=title,
                seniority_level=search.experience_level or "Mid-Senior",
                employment_type="Full-time",
                function=function,
                location=(search.locations or ["Remote"])[0],
                posted_date=datetime.now(UTC).date().isoformat(),
                summary=summarize_text(desc),
                role_responsibilities=bullets_from_description(desc),
                key_skills=extract_skills(desc),
                source="LinkedIn",
                source_url=f"https://www.linkedin.com/jobs/search/?keywords={keyword}",
                description=desc,
            )
            jobs.append(record.model_dump())

    if search.exclude_internships:
        jobs = [j for j in jobs if "intern" not in (j.get("job_title", "").lower())]

    if search.function_filter:
        allow = {f.lower() for f in search.function_filter}
        jobs = [j for j in jobs if (j.get("function") or "").lower() in allow]

    if search.seniority_filter:
        allow = {f.lower() for f in search.seniority_filter}
        jobs = [j for j in jobs if (j.get("seniority_level") or "").lower() in allow]

    return deduplicate_jobs(jobs)
