from bs4 import BeautifulSoup
import uuid
from app.services.models import NaukriJob


def parse_search_page(html):

    soup = BeautifulSoup(html, "lxml")

    jobs = []

    cards = soup.select("div.srp-jobtuple-wrapper")

    for card in cards:

        title_el = card.select_one("a.title")
        company_el = card.select_one("a.comp-name")
        loc_el = card.select_one("span.locWdth")
        exp_el = card.select_one("span.expwdth")
        desc_el = card.select_one("span.job-desc")

        skill_els = card.select("ul.tags-gt li")

        if not title_el:
            continue

        skills = [s.text.strip() for s in skill_els]

        jobs.append({
            "job_title": title_el.text.strip(),
            "company_name": company_el.text.strip() if company_el else "Unknown",
            "location": loc_el.text.strip() if loc_el else "",
            "experience_range": exp_el.text.strip() if exp_el else "",
            "role_responsibilities": desc_el.text.strip() if desc_el else "",
            "key_skills": ", ".join(skills),
            "source_url": title_el.get("href")
        })

    return jobs


def build_job_record(raw):

    skills = raw.get("key_skills", "")

    if isinstance(skills, str):
        skills = [s.strip() for s in skills.split(",") if s.strip()]

    return NaukriJob(
        job_id=str(uuid.uuid4()),
        company_name=raw.get("company_name", "Unknown"),
        job_title=raw.get("job_title"),
        location=raw.get("location"),
        experience_range=raw.get("experience_range"),
        key_skills=skills,
        role_responsibilities=raw.get("role_responsibilities"),
        posted_date=raw.get("posted_date"),
        source_url=raw.get("source_url"),
    )
