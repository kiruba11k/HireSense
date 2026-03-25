from __future__ import annotations

import asyncio
import uuid

from app.agents.aggregator_agent import aggregate_signals
from app.agents.filings_agent import get_filings
from app.agents.intent_agent import detect_intent
from app.agents.linkedin_agent import linkedin_jobs
from app.agents.naukri_agent import naukri_jobs
from app.agents.news_agent import get_news
from app.agents.research_agent import deep_research
from app.agents.tech_agent import detect_tech
from app.agents.tender_agent import get_tenders
from app.db import SessionLocal
from app.models import Result, Task
from app.schemas import Stage2Request
from app.services.websocket_manager import manager


async def run_pipeline(task_id: str, payload: Stage2Request):
    db = SessionLocal()
    company_name = payload.company_name

    try:
        # Layer 1: ingestion agents (parallel)
        linkedin_task = linkedin_jobs(payload.jobs, company_name)
        naukri_task = naukri_jobs(payload.jobs, company_name)

        linkedin_data, naukri_data = await asyncio.gather(linkedin_task, naukri_task)
        jobs = linkedin_data + naukri_data
        await manager.send(task_id, {"type": "jobs", "data": jobs})

        # Layer 2: context agents (parallel)
        news_task = get_news(company_name, payload.time_window_days)
        tenders_task = get_tenders(
            company_list=payload.jobs.company_list or [company_name],
            keywords=payload.jobs.keywords,
            regions=payload.region,
            budget_threshold=payload.budget_threshold,
        )
        filings_task = get_filings(company_name, payload.report_year)
        tech_task = detect_tech(company_name, payload.company_website, jobs)

        news, tenders, filings, tech = await asyncio.gather(news_task, tenders_task, filings_task, tech_task)
        await manager.send(task_id, {"type": "news", "data": news})
        await manager.send(task_id, {"type": "tenders", "data": tenders})
        await manager.send(task_id, {"type": "filings", "data": filings})
        await manager.send(task_id, {"type": "tech", "data": tech})

        # Layer 3: intent interpreter (depends on jobs)
        intent_outputs = []
        historical_job_count = len(jobs)
        for job in jobs:
            intent = await detect_intent(
                job_title=job.get("job_title", ""),
                job_description=job.get("description", ""),
                company_name=job.get("company_name", company_name),
                historical_job_count=historical_job_count,
            )
            intent_outputs.append(intent)
        await manager.send(task_id, {"type": "intent", "data": intent_outputs})

        # Layer 4: deep research document
        research = await deep_research(
            company_name,
            {
                "jobs": jobs,
                "intent": intent_outputs,
                "tech": tech,
                "news": news,
                "tenders": tenders,
                "filings": filings,
            },
            payload.time_window_days,
        )
        await manager.send(task_id, {"type": "research", "data": research})

        # Layer 5: final aggregator
        score = await aggregate_signals(company_name, jobs, intent_outputs, tech, news, tenders, filings)

        final_result = {
            "company": company_name,
            "inputs": payload.model_dump(),
            "jobs": jobs,
            "intent": intent_outputs,
            "tech": tech,
            "news": news,
            "tenders": tenders,
            "filings": filings,
            "research": research,
            "score": score,
        }

        db.add(Result(id=str(uuid.uuid4()), task_id=task_id, data=final_result))
        task = db.query(Task).filter(Task.id == task_id).first()
        if task:
            task.status = "completed"
        db.commit()
        await manager.send(task_id, {"type": "done", "data": final_result})

    except Exception as exc:
        print("Pipeline failed:", exc)
        task = db.query(Task).filter(Task.id == task_id).first()
        if task:
            task.status = "failed"
        db.commit()
