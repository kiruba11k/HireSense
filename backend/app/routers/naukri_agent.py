from fastapi import APIRouter
from app.services.selenium_scraper import NaukriSeleniumScraper
from app.services.models import NaukriRunRequest

router = APIRouter(prefix="/naukri")


@router.post("/run-agent")

def run_agent(payload: NaukriRunRequest):

    scraper = NaukriSeleniumScraper()

    jobs = scraper.scrape(
        payload.keywords,
        payload.locations,
        payload.max_pages
    )

    return {
        "status": "completed",
        "count": len(jobs),
        "rows": jobs
    }
