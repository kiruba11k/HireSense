from __future__ import annotations

import asyncio
import csv
import io
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services.models import NaukriRunRequest
from app.services.scraper import NaukriScraper

router = APIRouter(prefix="/naukri", tags=["naukri"])

_state = {
    "status": "idle",
    "message": "No Naukri task running.",
    "started_at": None,
    "updated_at": None,
    "error": None,
    "results": [],
}


async def _run_agent(payload: NaukriRunRequest):
    scraper = NaukriScraper()
    _state["status"] = "running"
    _state["message"] = "Starting Naukri pipeline"
    _state["started_at"] = datetime.utcnow().isoformat()
    _state["updated_at"] = _state["started_at"]
    _state["error"] = None
    _state["results"] = []

    def update_message(message: str):
        _state["message"] = message
        _state["updated_at"] = datetime.utcnow().isoformat()

    try:
        jobs = await scraper.run(payload, status_cb=update_message)
    except RuntimeError as exc:
        _state["status"] = "error"
        _state["message"] = str(exc)
        _state["error"] = str(exc)
        _state["updated_at"] = datetime.utcnow().isoformat()
        return
    except Exception as exc:  # noqa: BLE001
        _state["status"] = "error"
        _state["message"] = "Unexpected scraping error"
        _state["error"] = str(exc)
        _state["updated_at"] = datetime.utcnow().isoformat()
        return

    _state["status"] = "completed"
    _state["message"] = "Completed"
    _state["results"] = [job.model_dump(mode="json") for job in jobs]
    _state["updated_at"] = datetime.utcnow().isoformat()


@router.post("/run-agent")
async def run_agent(payload: NaukriRunRequest):
    if _state["status"] == "running":
        raise HTTPException(status_code=409, detail="Naukri agent is already running")
    asyncio.create_task(_run_agent(payload))
    return {"status": "started", "message": "Starting Naukri pipeline"}


@router.get("/status")
async def get_status():
    return {
        "status": _state["status"],
        "message": _state["message"],
        "error": _state["error"],
        "updated_at": _state["updated_at"],
    }


@router.get("/results")
async def get_results():
    return {"status": _state["status"], "rows": _state["results"]}


@router.get("/download")
async def download_results():
    rows = _state["results"]
    if not rows:
        raise HTTPException(status_code=404, detail="No Naukri results available")

    headers = [
        "job_id",
        "company_name",
        "job_title",
        "function",
        "experience_range",
        "location",
        "posted_date",
        "role_responsibilities",
        "key_skills",
        "source",
        "scraped_timestamp",
        "hiring_spike",
    ]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for row in rows:
        dump = dict(row)
        if isinstance(dump.get("key_skills"), list):
            dump["key_skills"] = ", ".join(dump["key_skills"])
        writer.writerow(dump)

    output.seek(0)
    response_headers = {"Content-Disposition": "attachment; filename=naukri-jobs.csv"}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers=response_headers)
