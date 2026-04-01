import asyncio
from fastapi import APIRouter

from app.services.scraper import NaukriScraper
from app.services.models import NaukriRunRequest

router = APIRouter(prefix="/naukri", tags=["naukri"])

_state = {
    "status": "idle",
    "results": [],
}


async def _run(payload):

    scraper = NaukriScraper()

    jobs = await scraper.run(payload)

    _state["results"] = [j.model_dump() for j in jobs]
    _state["status"] = "completed"


@router.post("/run-agent")
async def run_agent(payload: NaukriRunRequest):

    _state["status"] = "running"

    asyncio.create_task(_run(payload))

    return {"status": "started"}


@router.get("/results")
async def get_results():

    return {
        "status": _state["status"],
        "count": len(_state["results"]),
        "rows": _state["results"]
    }
