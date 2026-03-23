from fastapi import FastAPI, WebSocket, Depends
from app.db import SessionLocal
from app.models import Task
from app.services.pipeline import run_pipeline
from app.services.websocket_manager import manager
import uuid, asyncio

app = FastAPI()

@app.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await manager.connect(task_id, websocket)

@app.post("/run")
async def run(company: str):
    db = SessionLocal()

    task_id = str(uuid.uuid4())
    db.add(Task(id=task_id, company=company, status="running"))
    db.commit()

    asyncio.create_task(run_pipeline(task_id, company))

    return {"task_id": task_id}

@app.get("/status/{task_id}")
async def status(task_id: str):
    db = SessionLocal()
    task = db.query(Task).filter(Task.id == task_id).first()
    return {"status": task.status if task else "not_found"}
