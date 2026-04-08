from __future__ import annotations

from datetime import datetime
from enum import Enum
import re
from typing import Any
from urllib.parse import urlencode

from pydantic import BaseModel, Field


class TimeFilter(str, Enum):
    last_24h = "24h"
    last_7d = "7d"
    last_30d = "30d"


class IntentLevel(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"


class LinkedInWindow(str, Enum):
    last_24h = "24h"
    last_7d = "7d"
    last_6m = "6m"


class LinkedInSearchRequest(BaseModel):
    window: LinkedInWindow = LinkedInWindow.last_24h
    limit: int = Field(default=10, ge=10, le=100)
    offset: int = Field(default=0, ge=0)
    title_filter: str | None = None
    advanced_title_filter: str | None = None
    location_filter: str | None = None
    description_filter: str | None = None
    organization_filter: str | None = None
    organization_slug_filter: str | None = None
    type_filter: str | list[str] | None = None
    remote: bool | None = None
    agency: bool | None = None
    seniority_filter: str | list[str] | None = None
    industry_filter: str | list[str] | None = None
    include_ai: bool | None = None
    ai_work_arrangement_filter: str | list[str] | None = None
    ai_experience_level_filter: str | list[str] | None = None
    ai_taxonomies_a_filter: str | list[str] | None = None
    ai_has_salary: bool | None = None
    date_filter: str | None = None
    order: str | None = None
    description_type: str = "text"
    external_apply_url: bool | None = None
    directapply: bool | None = None
    employees_lte: int | None = None
    employees_gte: int | None = None
    extra_query_params: dict[str, Any] = Field(default_factory=dict)

    @staticmethod
    def _normalize_filter_expression(value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if not cleaned:
            return cleaned

        if re.search(r"\s+OR\s+", cleaned, flags=re.IGNORECASE):
            parts = re.split(r"\s+OR\s+", cleaned, flags=re.IGNORECASE)
            return ",".join(item.strip().strip('"').strip("'") for item in parts if item.strip())

        return cleaned.strip('"').strip("'")

    def to_query_params(self) -> dict[str, Any]:
        data = self.model_dump(exclude={"window", "extra_query_params"}, exclude_none=True)
        for key, value in list(data.items()):
            if isinstance(value, list):
                data[key] = ",".join(str(item) for item in value if item not in (None, ""))
            elif isinstance(value, str):
                data[key] = self._normalize_filter_expression(value)
        data.update(self.extra_query_params)
        return data

    def _map_window_to_tpr(self) -> str:
        if self.window == LinkedInWindow.last_24h:
            return "r86400"
        if self.window == LinkedInWindow.last_7d:
            return "r604800"
        return "r15552000"

    def to_apify_input(self) -> dict[str, Any]:
        query_params = self.to_query_params()
        url_params: dict[str, str] = {}

        keywords = " ".join(
            filter(
                None,
                [
                    query_params.get("title_filter"),
                    query_params.get("description_filter"),
                    query_params.get("organization_filter"),
                ],
            )
        )
        if keywords:
            url_params["keywords"] = keywords

        location = query_params.get("location_filter")
        if location:
            url_params["location"] = str(location)

        url_params["f_TPR"] = self._map_window_to_tpr()
        url_params["start"] = str(self.offset)
        url_params["sortBy"] = "R" if self.order == "asc" else "DD"

        for passthrough_key in ("f_AL", "f_E", "f_JT", "f_WT"):
            value = query_params.get(passthrough_key)
            if value is not None:
                url_params[passthrough_key] = str(value)

        job_type_map = {
            "Full-time": "F",
            "Part-time": "P",
            "Contract": "C",
            "Temporary": "T",
            "Internship": "I",
        }
        experience_map = {
            "Internship": "1",
            "Entry level": "2",
            "Associate": "3",
            "Mid-Senior level": "4",
            "Director": "5",
            "Executive": "6",
        }
        workplace_map = {
            "On-site": "1",
            "Remote": "2",
            "Hybrid": "3",
        }

        def _map_codes(raw: Any, mapping: dict[str, str]) -> str | None:
            if raw is None:
                return None
            if isinstance(raw, str):
                values = [item.strip() for item in raw.split(",") if item.strip()]
            elif isinstance(raw, list):
                values = [str(item).strip() for item in raw if str(item).strip()]
            else:
                return None
            codes = [mapping.get(value, value) for value in values]
            return ",".join(code for code in codes if code)

        mapped_job_types = _map_codes(self.type_filter, job_type_map)
        if mapped_job_types:
            url_params["f_JT"] = mapped_job_types

        mapped_experience = _map_codes(self.ai_experience_level_filter, experience_map)
        if mapped_experience:
            url_params["f_E"] = mapped_experience

        mapped_workplace = _map_codes(self.ai_work_arrangement_filter, workplace_map)
        if mapped_workplace:
            url_params["f_WT"] = mapped_workplace

        if self.directapply:
            url_params["f_AL"] = "true"
        if self.remote:
            url_params["f_WT"] = "2"

        search_url = "https://www.linkedin.com/jobs/search/?" + urlencode(
            {key: value for key, value in url_params.items() if value not in (None, "")}
        )

        actor_input: dict[str, Any] = {
            "count": self.limit,
            "scrapeCompany": True,
            "splitByLocation": False,
            "urls": [search_url],
        }

        if isinstance(self.extra_query_params, dict):
            if "count" in self.extra_query_params:
                actor_input["count"] = int(self.extra_query_params["count"])
            if "scrapeCompany" in self.extra_query_params:
                actor_input["scrapeCompany"] = bool(self.extra_query_params["scrapeCompany"])
            if "splitByLocation" in self.extra_query_params:
                actor_input["splitByLocation"] = bool(self.extra_query_params["splitByLocation"])
            if "urls" in self.extra_query_params and isinstance(self.extra_query_params["urls"], list):
                actor_input["urls"] = self.extra_query_params["urls"]

        return actor_input


class LinkedInErpAnalyzeRequest(BaseModel):
    keyword: str = Field(min_length=1)
    location: str = Field(min_length=1)
    window: LinkedInWindow = LinkedInWindow.last_7d
    limit: int = Field(default=25, ge=10, le=25)
    offset: int = Field(default=0, ge=0)
    pages_to_scrape: int = Field(default=1, ge=1, le=20)


class JobSearchInput(BaseModel):
    keywords: list[str] = Field(default_factory=lambda: ["ERP", "SAP", "Cloud", "QA", "Data", "AI"])
    locations: list[str] = Field(default_factory=list)
    experience_level: str | None = None
    company_list: list[str] = Field(default_factory=list)
    time_filter: TimeFilter = TimeFilter.last_7d
    job_limit_per_company: int = 20
    seniority_filter: list[str] = Field(default_factory=list)
    function_filter: list[str] = Field(default_factory=list)
    exclude_internships: bool = True
    historical_window: int = Field(default=30, ge=7, le=180)


class Stage2Request(BaseModel):
    company_name: str
    company_website: str | None = None
    region: list[str] = Field(default_factory=list)
    industry: str | None = None
    budget_threshold: float | None = None
    report_year: int | None = None
    time_window_days: int = 90
    jobs: JobSearchInput = Field(default_factory=JobSearchInput)


class JobRecord(BaseModel):
    job_id: str
    company_name: str
    job_title: str
    seniority_level: str | None = None
    employment_type: str | None = None
    function: str | None = None
    location: str | None = None
    posted_date: str | None = None
    summary: str | None = None
    role_responsibilities: list[str] = Field(default_factory=list)
    key_skills: list[str] = Field(default_factory=list)
    experience_range: str | None = None
    openings: int | None = None
    recruiter: str | None = None
    recruiter_signal: str | None = None
    is_hiring_spike: bool = False
    source: str
    source_url: str | None = None
    scraped_timestamp: datetime = Field(default_factory=datetime.utcnow)
    description: str = ""


class IntentRecord(BaseModel):
    company_name: str
    intent_categories: list[str]
    intent_type: str
    intent_score: int
    intent_strength: IntentLevel
    reasoning: str


class TechStackRecord(BaseModel):
    company_name: str
    erp_stack: list[str] = Field(default_factory=list)
    crm_stack: list[str] = Field(default_factory=list)
    cloud_stack: list[str] = Field(default_factory=list)
    data_stack: list[str] = Field(default_factory=list)
    testing_tools: list[str] = Field(default_factory=list)
    evidence_sources: list[str] = Field(default_factory=list)


class NewsEventRecord(BaseModel):
    company_name: str
    event_type: str
    headline: str
    summary: str
    event_date: str | None = None
    intent_signal: IntentLevel
    event_impact_score: int
    source_link: str | None = None


class TenderRecord(BaseModel):
    organization_name: str
    tender_title: str
    tender_status: str
    category: str
    budget: float | None = None
    deadline: str | None = None
    announcement_date: str | None = None
    source_link: str | None = None


class FilingRecord(BaseModel):
    company_name: str
    capex_focus: str
    investment_areas: list[str] = Field(default_factory=list)
    digital_spend_indicator: str
    strategic_priorities: list[str] = Field(default_factory=list)
    risk_mentions: list[str] = Field(default_factory=list)
    intent_signal: IntentLevel
    evidence: list[str] = Field(default_factory=list)


class ResearchRecord(BaseModel):
    company_name: str
    company_description: str
    key_triggers: list[str]
    business_problem: str
    intent_summary: str
    recommended_pitch: str
    why_now: str


class AggregateRecord(BaseModel):
    company_name: str
    intent: int
    intent_level: IntentLevel
    top_signals: list[str]
    recommended_action: str
    priority_tier: str
    signal_breakdown: dict[str, Any]


class IntentAnalyzeRequest(BaseModel):
    job_title: str = ""
    job_description: str
    company_name: str
    historical_job_count: int = 0


class IntentAnalyzeResponse(BaseModel):
    company_name: str
    intent_categories: list[str]
    intent_type: str
    intent_score: str
    reasoning: str
