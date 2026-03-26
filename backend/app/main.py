from __future__ import annotations

import asyncio
import csv
import io
import uuid

from fastapi import FastAPI, HTTPException, Query, WebSocket
from fastapi.responses import StreamingResponse

from app.db import SessionLocal
from app.models import Result, Task
from app.schemas import LinkedInSearchRequest, Stage2Request
from app.services.linkedin_search_service import LinkedInSearchService, LinkedInWindow
from app.services.pipeline import run_pipeline
from app.services.websocket_manager import manager

app = FastAPI(title="HireSense Stage-2 Intent Pipeline")


@app.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await manager.connect(task_id, websocket)


@app.post("/run")
async def run(payload: Stage2Request | None = None, company: str | None = Query(default=None)):
    effective_payload = payload
    if effective_payload is None:
        if not company:
            company = "example.com"
        effective_payload = Stage2Request(company_name=company, company_website=company)

    db = SessionLocal()
    task_id = str(uuid.uuid4())
    db.add(Task(id=task_id, company=effective_payload.company_name, status="running"))
    db.commit()

    asyncio.create_task(run_pipeline(task_id, effective_payload))
    return {"task_id": task_id}


@app.get("/status/{task_id}")
async def status(task_id: str):
    db = SessionLocal()
    task = db.query(Task).filter(Task.id == task_id).first()
    return {"status": task.status if task else "not_found"}




@app.post("/linkedin/jobs")
async def linkedin_jobs_search(payload: LinkedInSearchRequest):
    service = LinkedInSearchService()
    try:
        result = await asyncio.to_thread(service.search, LinkedInWindow(payload.window.value), payload.to_query_params())
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if result["status_code"] >= 400:
        raise HTTPException(status_code=result["status_code"], detail=result["data"])

    return result


def _extract_linkedin_jobs(data: object) -> list[dict]:
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if not isinstance(data, dict):
        return []
    nested_data = data.get("data")
    if isinstance(nested_data, list):
        return [row for row in nested_data if isinstance(row, dict)]
    nested_jobs = data.get("jobs")
    if isinstance(nested_jobs, list):
        return [row for row in nested_jobs if isinstance(row, dict)]
    return []


@app.post("/linkedin/jobs/csv")
async def linkedin_jobs_search_csv(payload: LinkedInSearchRequest):
    service = LinkedInSearchService()
    try:
        result = await asyncio.to_thread(service.search, LinkedInWindow(payload.window.value), payload.to_query_params())
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if result["status_code"] >= 400:
        raise HTTPException(status_code=result["status_code"], detail=result["data"])

    jobs = _extract_linkedin_jobs(result.get("data"))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Title", "Company", "Location", "Posted", "Url", "Salary"])
    for job in jobs:
        writer.writerow(
            [
                job.get("title") or job.get("job_title") or "",
                job.get("organization") or job.get("company") or job.get("company_name") or "",
                job.get("location") or "",
                job.get("date_posted") or job.get("posted_date") or "",
                job.get("url") or job.get("linkedin_url") or job.get("source_url") or "",
                job.get("salary_raw") or job.get("salary") or "",
            ]
        )

    output.seek(0)
    headers = {"Content-Disposition": "attachment; filename=linkedin-jobs.csv"}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers=headers)


@app.get("/results/{task_id}")
async def results(task_id: str):
    db = SessionLocal()
    row = db.query(Result).filter(Result.task_id == task_id).first()
    return row.data if row else {"status": "not_found"}
