from pydantic import BaseModel, Field


class NaukriRunRequest(BaseModel):
    keywords: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)
    experience: str | None = None
    companies: list[str] = Field(default_factory=list)
    time_filter: str = "7d"
    seniority_filter: list[str] = Field(default_factory=list)
    function_filter: list[str] = Field(default_factory=list)
    historical_window: int = 30
    max_pages: int = 2
    remove_consultancy_duplicates: bool = True
    exclude_irrelevant_roles: bool = True
