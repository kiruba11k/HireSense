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

CATEGORY_KEYWORDS = {
    "ERP": ("erp", "sap", "oracle erp", "dynamics 365", "netsuite"),
    "Cloud": ("aws", "azure", "gcp", "cloud", "kubernetes", "docker"),
    "Data": ("data engineering", "etl", "warehouse", "snowflake", "databricks", "analytics"),
    "Security": ("security", "siem", "soc", "iam", "zero trust", "vulnerability"),
    "QA": ("qa", "test automation", "selenium", "cypress", "quality assurance"),
    "AI": ("ai", "ml", "machine learning", "llm", "genai", "artificial intelligence"),
}

GENERIC_HIRING_PATTERNS = (
    "we are hiring",
    "join our team",
    "multiple openings",
    "urgent hiring",
    "walk in",
)



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
    job_title: str,
    job_description: str,
    historical_job_count: int,
) -> dict[str, Any]:
    normalized_text = f"{job_title} {job_description}".lower()
    if _is_generic_hiring(normalized_text) and not _detect_categories(normalized_text):
        return default_low_intent(
            company_name,
            "Ignored as generic hiring language without ERP/Cloud/Data/Security/QA/AI evidence.",
        )

    categories = [c for c in classification.get("intent_categories", []) if c in ALLOWED_CATEGORIES]
    if not categories:
        categories = _detect_categories(" ".join(evidence).lower() or normalized_text)

    intent_type = classification.get("intent_type") if classification.get("intent_type") in ALLOWED_TYPES else "Unknown"
    intent_score = classification.get("intent_score") if classification.get("intent_score") in ALLOWED_SCORES else "Low"
    reasoning = str(classification.get("reasoning", "")).strip()

    evidence_text = " ".join(evidence).lower()
    if not evidence:
        return default_low_intent(company_name, "No relevant evidence found in the job description.")

    if intent_type == "Migration" and "migrat" not in evidence_text:
        intent_type = "Unknown"
        intent_score = "Low"
        reasoning = "Evidence does not explicitly mention migration."

    if not categories:
        intent_score = "Low"

    if not _reasoning_supported(reasoning, evidence_text):
        reasoning = "Reasoning was not fully grounded in extracted evidence, fallback applied."
        intent_score = "Low"

    intent_score = _apply_repeated_role_boost(intent_score, historical_job_count)
    if not reasoning:
        reasoning = f"Evidence: {' | '.join(evidence[:2])}"

    return {
        "company_name": company_name,
        "intent_categories": categories,
        "intent_type": intent_type,
        "intent_score": intent_score,
        "reasoning": reasoning,
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



def _apply_repeated_role_boost(intent_score: str, historical_job_count: int) -> str:
    if historical_job_count < 3:
        return intent_score
    if intent_score == "Low":
        return "Medium"
    if intent_score == "Medium":
        return "High"
    return intent_score



def _detect_categories(text: str) -> list[str]:
    found = []
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            found.append(category)
    return found



def _is_generic_hiring(text: str) -> bool:
    return any(phrase in text for phrase in GENERIC_HIRING_PATTERNS)
