import uuid
from app.services.models import NaukriJob


def build_job_record(raw):

    skills = raw.get("key_skills", "")

    if isinstance(skills, str):
        skills = [s.strip() for s in skills.split(",") if s.strip()]

    return NaukriJob(
        job_id=str(uuid.uuid4()),
        company_name=raw.get("company_name", "Unknown"),
        job_title=raw.get("job_title", ""),
        location=raw.get("location"),
        experience_range=raw.get("experience_range"),
        key_skills=skills,
        role_responsibilities=raw.get("role_responsibilities"),
        posted_date=raw.get("posted_date"),
        source_url=raw.get("source_url"),
    )
