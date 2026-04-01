from __future__ import annotations

from app.intent_pipeline import analyze_hiring_intent


async def detect_intent(job_title: str, job_description: str, company_name: str, historical_job_count: int) -> dict:
    return await analyze_hiring_intent(
        {
            "job_title": job_title,
            "job_description": job_description,
            "company_name": company_name,
            "historical_job_count": historical_job_count,
        }
    )
