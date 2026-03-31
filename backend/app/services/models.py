from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class NaukriRunRequest(BaseModel):
    keywords: list[str] = Field(default_factory=list)
    experience: str | None = None
    locations: list[str] = Field(default_factory=list)
    companies: list[str] = Field(default_factory=list)
    time_filter: str = "7d"


class NaukriJob(BaseModel):
    job_id: str
    company_name: str
    job_title: str
    function: str | None = None
    experience_range: str | None = None
    location: str | None = None
    posted_date: str | None = None
    role_responsibilities: str | None = None
    key_skills: list[str] = Field(default_factory=list)
    source: str = "Naukri"
    scraped_timestamp: datetime = Field(default_factory=datetime.utcnow)
    hiring_spike: bool = False
    source_url: str | None = None
