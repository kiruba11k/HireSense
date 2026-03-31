from __future__ import annotations

from app.schemas import AggregateRecord, IntentLevel


async def aggregate_signals(
    company_name: str,
    jobs: list[dict],
    intent: list[dict],
    tech: dict,
    news: list[dict],
    tenders: list[dict],
    filings: list[dict],
) -> dict:
    # Weighted scoring (stage-2 specification)
    spike_bonus = len([j for j in jobs if j.get("is_hiring_spike")]) * 4
    recruiter_bonus = len([j for j in jobs if (j.get("recruiter_signal") or "").lower() != "standard"]) * 2
    hiring = min(100, len(jobs) * 6 + sum(i.get("intent_score", 0) for i in intent[:5]) // 5 + spike_bonus + recruiter_bonus)
    news_score = min(100, sum(item.get("event_impact_score", 0) for item in news) * 5)
    tech_score = min(100, sum(len(v) for k, v in tech.items() if k.endswith("_stack") or k == "testing_tools") * 10)
    filing_score = 70 if filings else 0
    tender_score = min(100, len([t for t in tenders if t.get("tender_status") == "Open"]) * 25)

    total = int(hiring * 0.30 + news_score * 0.20 + tech_score * 0.15 + filing_score * 0.15 + tender_score * 0.20)

    level = IntentLevel.low
    tier = "Tier-3"
    action = "Nurture sequence"
    if total >= 70:
        level = IntentLevel.high
        tier = "Tier-1"
        action = "Immediate AE outreach with tailored POV"
    elif total >= 40:
        level = IntentLevel.medium
        tier = "Tier-2"
        action = "SDR discovery + intent monitoring"

    signals = []
    if hiring >= 50:
        signals.append("Strong hiring momentum")
    if spike_bonus > 0:
        signals.append("Hiring spike detected")
    if recruiter_bonus > 0:
        signals.append("Recruiter activity signal")
    if news_score >= 50:
        signals.append("Business trigger events")
    if tender_score >= 50:
        signals.append("Active procurement cycle")

    return AggregateRecord(
        company_name=company_name,
        intent=total,
        intent_level=level,
        top_signals=signals,
        recommended_action=action,
        priority_tier=tier,
        signal_breakdown={
            "hiring": hiring,
            "news": news_score,
            "tech_stack": tech_score,
            "filings": filing_score,
            "tenders": tender_score,
        },
    ).model_dump()
