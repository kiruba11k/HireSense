from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.schemas import TenderRecord


async def get_tenders(
    company_list: list[str],
    keywords: list[str],
    regions: list[str],
    budget_threshold: float | None = None,
) -> list[dict]:
    tenders: list[dict] = []
    for company in company_list:
        for keyword in keywords[:2]:
            budget = 100000.0
            if budget_threshold and budget < budget_threshold:
                continue
            tenders.append(
                TenderRecord(
                    organization_name=company,
                    tender_title=f"{keyword} modernization RFP",
                    tender_status="Open",
                    category=keyword,
                    budget=budget,
                    deadline=(datetime.now(UTC) + timedelta(days=14)).date().isoformat(),
                    announcement_date=datetime.now(UTC).date().isoformat(),
                    source_link=f"https://{regions[0] if regions else 'global'}.procurement.example/rfps",
                ).model_dump()
            )
    return tenders
