from __future__ import annotations

import re
from typing import Any

ALLOWED_CATEGORIES = {"ERP", "Cloud", "Data", "Security", "QA", "AI"}
ALLOWED_TYPES = {"Implementation", "Migration", "Optimization", "Unknown"}
ALLOWED_SCORES = {"Low", "Medium", "High"}
SAFE_REASONING_FILLER = {
    "based",
    "on",
    "the",
    "provided",
    "evidence",
    "this",
    "job",
    "description",
    "indicates",
    "for",
    "and",
    "with",
    "signals",
    "hiring",
    "intent",
    "is",
    "unknown",
    "low",
    "medium",
    "high",
}


def default_low_intent(company_name: str, reason: str) -> dict[str, Any]:
    return {
        "company_name": company_name,
        "intent_categories": [],
        "intent_type": "Unknown",
        "intent_score": "Low",
        "reasoning": reason,
    }


def validate_and_guardrail(
    company_name: str,
    evidence: list[str],
    classification: dict[str, Any],
) -> dict[str, Any]:
    if not evidence:
        return default_low_intent(company_name, "No relevant evidence found in the job description.")

    categories = [c for c in classification.get("intent_categories", []) if c in ALLOWED_CATEGORIES]
    intent_type = classification.get("intent_type") if classification.get("intent_type") in ALLOWED_TYPES else "Unknown"
    intent_score = classification.get("intent_score") if classification.get("intent_score") in ALLOWED_SCORES else "Low"
    reasoning = str(classification.get("reasoning", "")).strip()

    evidence_text = " ".join(evidence).lower()

    if intent_type == "Migration" and "migrat" not in evidence_text:
        intent_type = "Unknown"
        intent_score = "Low"
        reasoning = "Evidence does not explicitly mention migration."

    if not categories:
        intent_score = "Low"

    if not _reasoning_supported(reasoning, evidence_text):
        reasoning = "Reasoning was not fully grounded in extracted evidence, fallback applied."
        intent_score = "Low"

    return {
        "company_name": company_name,
        "intent_categories": categories,
        "intent_type": intent_type,
        "intent_score": intent_score,
        "reasoning": reasoning or "Derived from extracted evidence only.",
    }


def _reasoning_supported(reasoning: str, evidence_text: str) -> bool:
    if not reasoning:
        return True
    tokens = re.findall(r"[a-zA-Z]{4,}", reasoning.lower())
    for token in tokens:
        if token in SAFE_REASONING_FILLER:
            continue
        if token not in evidence_text:
            return False
    return True
