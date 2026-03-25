from __future__ import annotations

from datetime import UTC, datetime

from app.schemas import IntentLevel, NewsEventRecord


async def get_news(company_name: str, time_window_days: int = 90) -> list[dict]:
    """Business event miner (free-tier stub with strict schema)."""
    sample_events = [
        ("Expansion", f"{company_name} expands digital delivery center", 8),
        ("Partnership", f"{company_name} announces strategic cloud alliance", 7),
    ]

    results: list[dict] = []
    for event_type, headline, impact in sample_events:
        level = IntentLevel.high if impact >= 8 else IntentLevel.medium
        results.append(
            NewsEventRecord(
                company_name=company_name,
                event_type=event_type,
                headline=headline,
                summary=f"Detected within the last {time_window_days} days and mapped as {event_type} trigger.",
                event_date=datetime.now(UTC).date().isoformat(),
                intent_signal=level,
                event_impact_score=impact,
                source_link=None,
            ).model_dump()
        )
    return results
