from __future__ import annotations

from app.schemas import ResearchRecord


async def deep_research(company_name: str, all_agent_outputs: dict, time_context_days: int = 90) -> dict:
    intents = all_agent_outputs.get("intent", [])
    top_intent = intents[0] if intents else {}
    triggers = []

    if all_agent_outputs.get("news"):
        triggers.append("Recent business-impact events detected")
    if all_agent_outputs.get("tenders"):
        triggers.append("Open tenders suggest active budget cycles")
    if all_agent_outputs.get("jobs"):
        triggers.append("Hiring demand indicates execution readiness")

    return ResearchRecord(
        company_name=company_name,
        company_description=f"{company_name} appears to be executing transformation initiatives.",
        key_triggers=triggers,
        business_problem="Need to accelerate delivery while managing platform complexity and risk.",
        intent_summary=(
            f"Within the last {time_context_days} days, multiple signals indicate "
            f"{(top_intent.get('intent_type') or 'Optimization')} intent."
        ),
        recommended_pitch="Offer rapid assessment + phased implementation package aligned to active initiatives.",
        why_now="Concurrent hiring, trigger events, and procurement activity shorten buying cycles.",
    ).model_dump()
