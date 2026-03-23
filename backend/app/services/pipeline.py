import asyncio
import uuid
from app.db import SessionLocal
from app.models import Task, Result
from app.services.websocket_manager import manager

from app.agents.linkedin_agent import linkedin_jobs
from app.agents.naukri_agent import naukri_jobs
from app.agents.intent_agent import detect_intent
from app.agents.tech_agent import detect_tech

async def run_pipeline(task_id: str, company: str):
    db = SessionLocal()

    try:
        linkedin, naukri = await asyncio.gather(
            linkedin_jobs(company),
            naukri_jobs(company)
        )

        jobs = linkedin + naukri
        enriched = []

        for job in jobs:
            try:
                desc = job.get("description", "")
                intent = await detect_intent(desc)
                tech = await detect_tech(desc)

                data = {
                    "job": job,
                    "intent": intent,
                    "tech": tech
                }

                enriched.append(data)

                await manager.send(task_id, {
                    "type": "progress",
                    "data": data
                })

            except Exception as e:
                print("Job processing error:", e)

        db.add(Result(id=str(uuid.uuid4()), task_id=task_id, data=enriched))

        task = db.query(Task).filter(Task.id == task_id).first()
        task.status = "completed"
        db.commit()

        await manager.send(task_id, {"type": "done"})

    except Exception as e:
        task = db.query(Task).filter(Task.id == task_id).first()
        task.status = "failed"
        db.commit()
