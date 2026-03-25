from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

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
    type_filter: str | None = None
    remote: bool | None = None
    agency: bool | None = None
    seniority_filter: str | None = None
    industry_filter: str | None = None
    include_ai: bool | None = None
    ai_work_arrangement_filter: str | None = None
    ai_experience_level_filter: str | None = None
    ai_taxonomies_a_filter: str | None = None
    ai_has_salary: bool | None = None
    date_filter: str | None = None
    order: str | None = None
    description_type: str = "text"
    external_apply_url: bool | None = None
    directapply: bool | None = None
    employees_lte: int | None = None
    employees_gte: int | None = None
    extra_query_params: dict[str, str | int | float | bool] = Field(default_factory=dict)

    def to_query_params(self) -> dict[str, Any]:
        data = self.model_dump(exclude={"window", "extra_query_params"}, exclude_none=True)
        data.update(self.extra_query_params)
        return data


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
