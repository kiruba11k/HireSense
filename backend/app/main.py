from __future__ import annotations

import asyncio
import csv
import io
import json
import uuid

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from app.config import settings
from app.csv_handler import parse_intent_csv
from app.db import SessionLocal
from app.intent_pipeline import analyze_hiring_intent
from app.llm_client import GroqClientError, groq_call
from app.models import Result, Task
from app.schemas import IntentAnalyzeRequest, LinkedInErpAnalyzeRequest, LinkedInSearchRequest, Stage2Request
from app.routers.naukri_agent import router as naukri_router
from app.services.linkedin_search_service import LinkedInSearchService
from app.services.pipeline import run_pipeline
from app.services.tech_stack_detector import TechStackAgentSystem
from app.services.websocket_manager import manager

app = FastAPI(title="HireSense Stage-2 Intent Pipeline")
app.include_router(naukri_router)
tech_stack_system = TechStackAgentSystem()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_origin_regex=settings.CORS_ALLOW_ORIGIN_REGEX,
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
        result = await asyncio.to_thread(service.search, payload.to_apify_input())
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
        result = await asyncio.to_thread(service.search, payload.to_apify_input())
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


def _extract_job_description_text(job: dict) -> str:
    description_fields = (
        "descriptionText",
        "description",
        "descriptionHtml",
        "jobDescription",
        "summary",
    )
    for field in description_fields:
        value = job.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


async def _classify_erp_job(description: str) -> tuple[str, str]:
    if not description.strip():
        return "NO", "No job description was available to evaluate ERP specificity."

    prompt = f"""
You are an expert ERP job filter.

Task: Analyze the job description and determine if it is a TRUE ERP-SPECIFIC ROLE.

STRICT CRITERIA:

Only say YES if:
- The role involves ERP as the CORE responsibility (not secondary)
- Includes one or more of the following:
  - ERP implementation / rollout / migration
  - ERP configuration / customization
  - ERP functional consulting (SAP FICO, MM, SD, SuccessFactors, etc.)
  - ERP solution architecture / system ownership
  - ERP transformation programs (core role, not support)
  - ERP integration across systems
  - ERP module ownership (Finance, HR, Procurement, Supply Chain)

Say NO if:
- ERP is only used as a tool (data entry, reporting, tracking, operations)
- Role is support/operations/PMO/finance/accounting with ERP exposure
- Role is testing/QA ONLY without ownership or configuration
- Role is master data / data steward / admin
- ERP is just mentioned as “experience required/preferred”

Be extremely strict. Reject borderline roles.

Return JSON with this exact schema:
{{
  "erp_specific": "YES" or "NO",
  "reason": "single concise reason"
}}

    Job description:
\"\"\"{description}\"\"\"
"""
    try:
        result = await groq_call(prompt, temperature=0.0, model="llama-3.3-70b-versatile")
    except GroqClientError as exc:
        return "NO", f"GROQ_ERROR: {exc}"

    verdict = str(result.get("erp_specific", "NO")).strip().upper()
    if verdict not in {"YES", "NO"}:
        verdict = "NO"
    reason = str(result.get("reason", "")).strip() or "No reason provided by model."
    return verdict, reason


@app.post("/linkedin/jobs/erp-analyzed-csv")
async def linkedin_jobs_erp_analyzed_csv(payload: LinkedInErpAnalyzeRequest):
    service = LinkedInSearchService()
    all_jobs: list[dict] = []
    for page_index in range(payload.pages_to_scrape):
        page_offset = payload.offset + (page_index * payload.limit)
        search_payload = LinkedInSearchRequest(
            window=payload.window,
            limit=payload.limit,
            offset=page_offset,
            title_filter=payload.keyword,
            location_filter=payload.location,
        )

        try:
            result = await asyncio.to_thread(service.search, search_payload.to_apify_input())
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        if result["status_code"] >= 400:
            raise HTTPException(status_code=result["status_code"], detail=result["data"])

        page_jobs = _extract_linkedin_jobs(result.get("data"))
        if not page_jobs:
            break
        all_jobs.extend(page_jobs)

    jobs = all_jobs
    semaphore = asyncio.Semaphore(4)

    async def analyze_one(job: dict) -> tuple[str, str]:
        async with semaphore:
            description = _extract_job_description_text(job)
            return await _classify_erp_job(description)

    analyses = await asyncio.gather(*(analyze_one(job) for job in jobs)) if jobs else []

    output_headers = [
        "title",
        "company",
        "location",
        "publication_date",
        "url",
        "description",
        "llm_output",
        "reason",
    ]
    output_rows: list[list[str]] = []
    for job, (verdict, reason) in zip(jobs, analyses):
        title = str(job.get("title") or "").strip()
        company = str(job.get("companyName") or job.get("organization") or job.get("company") or "").strip()
        location = str(
            job.get("location")
            or (job.get("locations_derived") or [""])[0]
            or (job.get("countries_derived") or [""])[0]
            or ""
        ).strip()
        publication_date = str(job.get("publication_date") or job.get("postedAt") or job.get("date_posted") or job.get("date_created") or "").strip()
        url = str(job.get("url") or job.get("link") or "").strip()
        description = _extract_job_description_text(job)
        output_rows.append([title, company, location, publication_date, url, description, verdict, reason])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(output_headers)
    for row in output_rows:
        writer.writerow(row)

    output.seek(0)
    response_headers = {"Content-Disposition": "attachment; filename=linkedin-jobs-erp-analyzed.csv"}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers=response_headers)


@app.post("/analyze-intent")
async def analyze_intent(
    request: Request,
    file: UploadFile | None = File(default=None),
):
    if file is not None:
        content = await file.read()
        try:
            jobs = parse_intent_csv(content)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    else:
        content_type = (request.headers.get("content-type") or "").lower()
        if "application/json" not in content_type:
            raise HTTPException(status_code=400, detail="Provide JSON body or multipart CSV file upload.")
        raw_payload = await request.json()
        try:
            payload = IntentAnalyzeRequest(**raw_payload)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors()) from exc
        jobs = [payload.model_dump()]

    results = []
    for job in jobs:
        results.append(await analyze_hiring_intent(job))

    return {"results": results}


@app.get("/results/{task_id}")
async def results(task_id: str):
    db = SessionLocal()
    row = db.query(Result).filter(Result.task_id == task_id).first()
    return row.data if row else {"status": "not_found"}


@app.post("/detect-tech-stack")
async def detect_tech_stack(data: dict):
    company_name = str(data.get("company_name", "")).strip()
    company_website = str(data.get("company_website", "")).strip()
    job_data = str(data.get("job_data", "") or "")

    if not company_name:
        raise HTTPException(status_code=422, detail="company_name is required")
    if not company_website:
        raise HTTPException(status_code=422, detail="company_website is required")

    result = await asyncio.to_thread(tech_stack_system.run, company_name, company_website, job_data)
    return result
