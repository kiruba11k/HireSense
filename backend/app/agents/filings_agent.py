from __future__ import annotations

from app.schemas import FilingRecord, IntentLevel


async def get_filings(company_name: str, report_year: int | None = None) -> list[dict]:
    year = report_year or 2025
    return [
        FilingRecord(
            company_name=company_name,
            capex_focus="Enterprise modernization and cloud infrastructure",
            investment_areas=["ERP", "Data Platform", "AI Automation"],
            digital_spend_indicator="Increasing",
            strategic_priorities=["Platform consolidation", "Risk reduction", "Faster go-live"],
            risk_mentions=["Cybersecurity exposure", "Vendor concentration"],
            intent_signal=IntentLevel.medium,
            evidence=[
                f"Annual report {year} - p.18: Digital transformation programs",
                f"Annual report {year} - p.42: Capex allocation",
            ],
        ).model_dump()
    ]
