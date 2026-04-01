from __future__ import annotations

from collections import Counter

from app.services.models import NaukriJob


def deduplicate_jobs(jobs: list[NaukriJob]) -> list[NaukriJob]:
    seen: set[tuple[str, str, str, str]] = set()
    output: list[NaukriJob] = []
    for job in jobs:
        key = (
            job.company_name.lower().strip(),
            job.job_title.lower().strip(),
            (job.location or "").lower().strip(),
            (job.source_url or "").split("?")[0].lower().strip(),
        )
        if key in seen:
            continue
        seen.add(key)
        output.append(job)
    return output


def apply_hiring_spike(jobs: list[NaukriJob]) -> list[NaukriJob]:
    company_counts = Counter(job.company_name for job in jobs)
    for job in jobs:
        if company_counts[job.company_name] > 20:
            job.hiring_spike = True
    return jobs
