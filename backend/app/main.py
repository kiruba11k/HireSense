from __future__ import annotations

import asyncio
import csv
import io
import json
import uuid

from fastapi import FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import settings
from app.db import SessionLocal
from app.models import Result, Task
from app.schemas import LinkedInSearchRequest, Stage2Request
from app.services.linkedin_search_service import LinkedInSearchService, LinkedInWindow
from app.services.pipeline import run_pipeline
from app.services.websocket_manager import manager

app = FastAPI(title="HireSense Stage-2 Intent Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

    if isinstance(result["data"], str) and "<html" in result["data"].lower():
        raise HTTPException(
            status_code=502,
            detail="Invalid response from job provider (HTML instead of JSON). Check API key or params.",
        )

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

    for value in data.values():
        if isinstance(value, list) and value and all(isinstance(row, dict) for row in value):
            return value

    return []


def _build_dynamic_csv_rows(jobs: list[dict]) -> tuple[list[str], list[list[str]]]:
    if not jobs:
        return [], []

    keys: list[str] = []
    seen: set[str] = set()
    for job in jobs:
        for key in job.keys():
            if key not in seen:
                seen.add(key)
                keys.append(key)

    rows: list[list[str]] = []
    for job in jobs:
        row: list[str] = []
        for key in keys:
            value = job.get(key, "")
            if isinstance(value, (dict, list)):
                row.append(json.dumps(value, ensure_ascii=False))
            elif value is None:
                row.append("")
            else:
                row.append(str(value))
        rows.append(row)

    return keys, rows


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
    headers, rows = _build_dynamic_csv_rows(jobs)

    output = io.StringIO()
    writer = csv.writer(output)
    if headers:
        writer.writerow(headers)
    for row in rows:
        writer.writerow(row)

    output.seek(0)
    response_headers = {"Content-Disposition": "attachment; filename=linkedin-jobs.csv"}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers=response_headers)


@app.get("/results/{task_id}")
async def results(task_id: str):
    db = SessionLocal()
    row = db.query(Result).filter(Result.task_id == task_id).first()
    return row.data if row else {"status": "not_found"}
