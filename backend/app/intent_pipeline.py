from __future__ import annotations

import json
import os
from typing import Any

from app.llm_client import GroqClientError, groq_call
from app.validators import default_low_intent, validate_and_guardrail

EVIDENCE_PROMPT = """You are an information extraction system.

Extract exact sentences from the job description that indicate hiring related to:

ERP
Cloud
Data
Security
QA
AI

Rules:
- Only return sentences that exist in the job description.
- Do not paraphrase.
- Do not infer.
- Do not add new information.
- If nothing relevant exists return an empty list.

Return JSON only.

Schema:
{{
 "evidence": ["sentence1", "sentence2"]
}}

Job Description:
{job_description}
"""

CLASSIFICATION_PROMPT = """You are a hiring intent classification system.

Using ONLY the evidence provided, determine the hiring intent.

Evidence:
{evidence}

Rules:
- Do not use information outside the evidence
- If evidence is weak return intent_score = Low
- If no evidence exists return Unknown

Categories allowed:
ERP
Cloud
Data
Security
QA
AI

Intent types allowed:
Implementation
Migration
Optimization
Unknown

Return JSON only.

Schema:
{{
 "intent_categories": [],
 "intent_type": "",
 "intent_score": "",
 "reasoning": ""
}}
"""

JUDGE_PROMPT = """You are a verification system.

Check if the prediction below is supported by the evidence.

Evidence:
{evidence}

Prediction:
{prediction}

Rules:
- If prediction is unsupported return FALSE
- If supported return TRUE

Return JSON:
{{
 "valid": true,
 "explanation": ""
}}
"""


async def analyze_hiring_intent(job: dict[str, Any]) -> dict[str, Any]:
    company_name = str(job.get("company_name", "")).strip() or "Unknown"
    job_description = str(job.get("job_description", "")).strip()

    if not job_description:
        return default_low_intent(company_name, "Empty job description.")

    try:
        extraction = await groq_call(EVIDENCE_PROMPT.format(job_description=job_description))
    except GroqClientError as exc:
        return default_low_intent(company_name, f"Evidence extraction failed: {exc}")

    evidence = extraction.get("evidence", [])
    if not isinstance(evidence, list):
        evidence = []
    evidence = [str(sentence).strip() for sentence in evidence if str(sentence).strip()]

    try:
        classification = await groq_call(CLASSIFICATION_PROMPT.format(evidence=json.dumps(evidence, ensure_ascii=False)))
    except GroqClientError as exc:
        return default_low_intent(company_name, f"Classification failed: {exc}")

    guarded = validate_and_guardrail(company_name, evidence, classification)

    if os.getenv("ENABLE_JUDGE", "false").lower() == "true":
        try:
            judge_result = await groq_call(
                JUDGE_PROMPT.format(
                    evidence=json.dumps(evidence, ensure_ascii=False),
                    prediction=json.dumps(guarded, ensure_ascii=False),
                )
            )
            if not bool(judge_result.get("valid", False)):
                return default_low_intent(
                    company_name,
                    f"Verification rejected prediction: {judge_result.get('explanation', 'unsupported output')}",
                )
        except GroqClientError:
            # Keep free-tier latency/cost predictable by making judge optional.
            pass

    return guarded
