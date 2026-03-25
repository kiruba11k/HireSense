from __future__ import annotations

import asyncio
import uuid

from fastapi import FastAPI, Query, WebSocket

from app.db import SessionLocal
from app.models import Result, Task
from app.schemas import Stage2Request
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


@app.get("/results/{task_id}")
async def results(task_id: str):
    db = SessionLocal()
    row = db.query(Result).filter(Result.task_id == task_id).first()
    return row.data if row else {"status": "not_found"}
