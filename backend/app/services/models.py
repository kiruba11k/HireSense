from datetime import datetime
from pydantic import BaseModel, Field


class NaukriRunRequest(BaseModel):
    keywords: list[str] = Field(default_factory=list)
    experience: str | None = None
    locations: list[str] = Field(default_factory=list)
    companies: list[str] = Field(default_factory=list)
    time_filter: str = "30d"
    seniority_filter: list[str] = Field(default_factory=list)
    function_filter: list[str] = Field(default_factory=list)
    historical_window: int = 30
    max_pages: int = 3


class NaukriJob(BaseModel):
    job_id: str
    company_name: str
    job_title: str
    location: str | None = None
    experience_range: str | None = None
    key_skills: list[str] = Field(default_factory=list)
    role_responsibilities: str | None = None
    posted_date: str | None = None
    source_url: str | None = None
    source: str = "Naukri"
    scraped_timestamp: datetime = Field(default_factory=datetime.utcnow)
