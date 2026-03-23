import asyncio
import uuid

from app.db import SessionLocal
from app.models import Result, Task
from app.services.websocket_manager import manager

from app.agents.aggregator_agent import aggregate_signals
from app.agents.filings_agent import get_filings
from app.agents.intent_agent import detect_intent
from app.agents.linkedin_agent import linkedin_jobs
from app.agents.naukri_agent import naukri_jobs
from app.agents.news_agent import get_news
from app.agents.research_agent import deep_research
from app.agents.tech_agent import detect_tech
from app.agents.tender_agent import get_tenders
from app.agents.utils import company_from_url


async def run_pipeline(task_id: str, company_url: str):
    db = SessionLocal()

    try:
        company = company_from_url(company_url)

        # STEP 1 — independent agents in parallel
        jobs_task = asyncio.gather(linkedin_jobs(company_url), naukri_jobs(company_url))
        news_task = get_news(company_url)
        tenders_task = get_tenders(company_url)
        filings_task = get_filings(company_url)

        (linkedin_data, google_jobs_data), news, tenders, filings = await asyncio.gather(
            jobs_task,
            news_task,
            tenders_task,
            filings_task,
        )

        jobs = linkedin_data + google_jobs_data

        await manager.send(task_id, {"type": "jobs", "data": jobs[:10]})
        await manager.send(task_id, {"type": "news", "data": news})
        await manager.send(task_id, {"type": "tenders", "data": tenders})
        await manager.send(task_id, {"type": "filings", "data": filings})

        # STEP 2 — dependent intent (jobs -> intent)
        enriched_jobs = []
        for job in jobs:
            try:
                intent = await detect_intent(job.get("description", ""))
                enriched_job = {**job, "intent": intent}
                enriched_jobs.append(enriched_job)

                await manager.send(task_id, {"type": "intent", "data": enriched_job})
            except Exception as e:
                print("Intent error:", e)

        # STEP 3 — dependent tech (jobs + website)
        tech = await detect_tech(company_url, enriched_jobs)
        await manager.send(task_id, {"type": "tech", "data": tech})

        # STEP 4 — research + final aggregation (aggregator <- ALL)
        research = await deep_research(
            {
                "jobs": enriched_jobs,
                "tech": tech,
                "news": news,
                "tenders": tenders,
                "filings": filings,
            }
        )
        await manager.send(task_id, {"type": "research", "data": research})

        score = await aggregate_signals(
            jobs=enriched_jobs,
            tech=tech,
            news=news,
            tenders=tenders,
            filings=filings,
        )

        final_result = {
            "company": company,
            "jobs": enriched_jobs,
            "tech": tech,
            "news": news,
            "tenders": tenders,
            "filings": filings,
            "research": research,
            "score": score,
        }

        db.add(Result(id=str(uuid.uuid4()), task_id=task_id, data=final_result))

        task = db.query(Task).filter(Task.id == task_id).first()
        task.status = "completed"
        db.commit()

        await manager.send(task_id, {"type": "done", "data": final_result})

    except Exception as e:
        print("Pipeline failed:", e)

        task = db.query(Task).filter(Task.id == task_id).first()
        task.status = "failed"
        db.commit()
