from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime
from urllib.parse import urlparse

COMPANY_ALIASES = {
    "tcs": "Tata Consultancy Services",
    "ibm": "IBM",
    "accenture plc": "Accenture",
    "infosys limited": "Infosys",
}

FUNCTION_KEYWORDS = {
    "ERP": ["erp", "sap", "oracle ebs", "dynamics"],
    "Cloud": ["aws", "azure", "gcp", "cloud"],
    "Data": ["data", "etl", "snowflake", "databricks", "bi"],
    "Security": ["security", "iam", "soc", "siem"],
    "QA": ["qa", "quality", "testing", "selenium", "cypress"],
    "AI": ["ai", "ml", "machine learning", "llm", "genai"],
    "CRM": ["crm", "salesforce", "dynamics crm", "hubspot"],
    "Finance": ["finance", "fp&a", "treasury", "controller", "accounts payable"],
    "Operations": ["operations", "supply chain", "warehouse", "manufacturing"],
    "Procurement": ["procurement", "sourcing", "vendor", "purchase"],
    "Digital Transformation": ["digital transformation", "transformation", "automation"],
}

TECH_KEYWORDS = {
    "erp_stack": ["sap", "oracle ebs", "dynamics 365", "workday"],
    "crm_stack": ["salesforce", "hubspot", "zoho crm", "microsoft dynamics"],
    "cloud_stack": ["aws", "azure", "gcp", "kubernetes", "terraform"],
    "data_stack": ["snowflake", "databricks", "redshift", "power bi", "tableau"],
    "testing_tools": ["selenium", "cypress", "playwright", "junit", "postman"],
}


def company_from_url(company_url: str) -> str:
    if not company_url:
        return ""
    normalized = company_url.strip()
    if not normalized.startswith(("http://", "https://")):
        normalized = f"https://{normalized}"
    parsed = urlparse(normalized)
    host = (parsed.netloc or parsed.path).lower().replace("www.", "")
    token = host.split(".")[0] if host else company_url.strip()
    return token.replace("-", " ").title()


def normalize_company_name(company: str) -> str:
    token = re.sub(r"\s+", " ", (company or "").strip())
    mapped = COMPANY_ALIASES.get(token.lower())
    return mapped or token.title()


def classify_function(text: str) -> str:
    raw = (text or "").lower()
    for function, words in FUNCTION_KEYWORDS.items():
        if any(word in raw for word in words):
            return function
    return "Other"


def extract_skills(text: str, limit: int = 8) -> list[str]:
    raw = (text or "").lower()
    found: list[str] = []
    for words in FUNCTION_KEYWORDS.values():
        for word in words:
            if word in raw and word not in found:
                found.append(word)
    return found[:limit]


def build_job_id(company: str, title: str, location: str, source: str) -> str:
    payload = f"{company}|{title}|{location}|{source}".lower()
    return hashlib.md5(payload.encode("utf-8")).hexdigest()[:16]


def summarize_text(text: str, limit: int = 220) -> str:
    clean = re.sub(r"\s+", " ", (text or "")).strip()
    return clean[:limit] + ("..." if len(clean) > limit else "")


def bullets_from_description(text: str, limit: int = 4) -> list[str]:
    if not text:
        return []
    parts = re.split(r"[\n\.;]+", text)
    bullets = [p.strip() for p in parts if len(p.strip()) > 18]
    return bullets[:limit]


def posted_within_days(posted_date: str | None, days: int) -> bool:
    if not posted_date:
        return True
    try:
        dt = datetime.fromisoformat(posted_date.replace("Z", "+00:00"))
        return (datetime.now(UTC) - dt).days <= days
    except ValueError:
        return True


def deduplicate_jobs(records: list[dict]) -> list[dict]:
    seen: set[str] = set()
    unique: list[dict] = []
    for record in records:
        key = record.get("job_id") or build_job_id(
            record.get("company_name", ""),
            record.get("job_title", ""),
            record.get("location", ""),
            record.get("source", ""),
        )
        if key in seen:
            continue
        seen.add(key)
        record["job_id"] = key
        unique.append(record)
    return unique


def detect_tech_stacks(text_blob: str) -> dict[str, list[str]]:
    lower = text_blob.lower()
    out: dict[str, list[str]] = {k: [] for k in TECH_KEYWORDS}
    for stack, tools in TECH_KEYWORDS.items():
        out[stack] = [tool for tool in tools if tool in lower]
    return out
