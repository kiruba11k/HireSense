from __future__ import annotations

from app.agents.utils import detect_tech_stacks
from app.schemas import TechStackRecord


async def detect_tech(company_name: str, company_website: str | None, job_data: list[dict] | None = None) -> dict:
    evidence = []
    text_parts = [company_name]

    for job in job_data or []:
        text_parts.append(job.get("description", ""))
        if job.get("source_url"):
            evidence.append(job["source_url"])

    if company_website:
        evidence.append(company_website)
        text_parts.append(company_website)

    stacks = detect_tech_stacks(" ".join(text_parts))

    return TechStackRecord(
        company_name=company_name,
        erp_stack=stacks["erp_stack"],
        crm_stack=stacks["crm_stack"],
        cloud_stack=stacks["cloud_stack"],
        data_stack=stacks["data_stack"],
        testing_tools=stacks["testing_tools"],
        evidence_sources=sorted(set(evidence)),
    ).model_dump()
