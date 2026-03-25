from __future__ import annotations

from collections import Counter

from app.agents.utils import FUNCTION_KEYWORDS
from app.schemas import IntentLevel, IntentRecord


def _intent_type(text: str) -> str:
    t = text.lower()
    if "migrat" in t:
        return "Migration"
    if "implement" in t or "greenfield" in t:
        return "Implementation"
    return "Optimization"


async def detect_intent(job_title: str, job_description: str, company_name: str, historical_job_count: int) -> dict:
    payload = f"{job_title} {job_description}".lower()
    categories = [
        category
        for category, words in FUNCTION_KEYWORDS.items()
        if any(word in payload for word in words)
    ]

    weighted = len(categories) * 20 + min(historical_job_count * 5, 35)
    score = max(10, min(100, weighted))
    strength = IntentLevel.low
    if score >= 70:
        strength = IntentLevel.high
    elif score >= 40:
        strength = IntentLevel.medium

    evidence = Counter(c for c in categories)
    reasoning = (
        "Evidence-based from role keywords "
        f"{dict(evidence)} and repeated hiring volume ({historical_job_count})."
    )

    return IntentRecord(
        company_name=company_name,
        intent_categories=categories or ["General"],
        intent_type=_intent_type(payload),
        intent_score=score,
        intent_strength=strength,
        reasoning=reasoning,
    ).model_dump()
