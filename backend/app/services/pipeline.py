import asyncio
import uuid
from app.db import SessionLocal
from app.models import Task, Result
from app.services.websocket_manager import manager

# Agents
from app.agents.linkedin_agent import linkedin_jobs
from app.agents.naukri_agent import naukri_jobs
from app.agents.intent_agent import detect_intent
from app.agents.tech_agent import detect_tech
from app.agents.news_agent import get_news
from app.agents.tender_agent import get_tenders
from app.agents.filings_agent import get_filings
from app.agents.research_agent import deep_research
from app.agents.aggregator_agent import aggregate_signals


def extract_company_name(company_url: str):
    return company_url.replace("https://", "").replace("http://", "").split("/")[0].split(".")[0]


async def run_pipeline(task_id: str, company_url: str):
    db = SessionLocal()

    try:
        company = extract_company_name(company_url)

        # 🔥 STEP 1 — JOB SCRAPING (PARALLEL)
        linkedin_task = linkedin_jobs(company_url)
        naukri_task = naukri_jobs(company_url)

        linkedin_data, naukri_data = await asyncio.gather(
            linkedin_task,
            naukri_task
        )

        jobs = linkedin_data + naukri_data

        await manager.send(task_id, {
            "type": "jobs",
            "data": jobs[:5]
        })

        # 🔥 STEP 2 — INTENT (SEQUENTIAL)
        enriched_jobs = []

        for job in jobs:
            try:
                intent = await detect_intent(job.get("description", ""))
                job["intent"] = intent
                enriched_jobs.append(job)

                await manager.send(task_id, {
                    "type": "intent",
                    "data": job
                })

            except Exception as e:
                print("Intent error:", e)

        # 🔥 STEP 3 — PARALLEL SIGNALS (NEWS, TENDERS, FILINGS)
        news_task = get_news(company_url)
        tender_task = get_tenders(company_url)
        filings_task = get_filings(company_url)

        news, tenders, filings = await asyncio.gather(
            news_task,
            tender_task,
            filings_task
        )

        await manager.send(task_id, {"type": "news", "data": news})

        # 🔥 STEP 4 — TECH STACK (USES JOBS)
        tech = await detect_tech(company_url, enriched_jobs)

        await manager.send(task_id, {
            "type": "tech",
            "data": tech
        })

        # 🔥 STEP 5 — DEEP RESEARCH (LLM FUSION)
        research = await deep_research({
            "jobs": enriched_jobs,
            "tech": tech,
            "news": news,
            "tenders": tenders,
            "filings": filings
        })

        await manager.send(task_id, {
            "type": "research",
            "data": research
        })

        # 🔥 STEP 6 — FINAL AGGREGATION
        score = await aggregate_signals(
            jobs=enriched_jobs,
            tech=tech,
            news=news,
            tenders=tenders,
            filings=filings
        )

        final_result = {
            "company": company,
            "jobs": enriched_jobs,
            "tech": tech,
            "news": news,
            "tenders": tenders,
            "filings": filings,
            "research": research,
            "score": score
        }

        # 🔥 SAVE RESULT
        db.add(Result(
            id=str(uuid.uuid4()),
            task_id=task_id,
            data=final_result
        ))

        task = db.query(Task).filter(Task.id == task_id).first()
        task.status = "completed"
        db.commit()

        await manager.send(task_id, {
            "type": "done",
            "data": final_result
        })

    except Exception as e:
        print("Pipeline failed:", e)

        task = db.query(Task).filter(Task.id == task_id).first()
        task.status = "failed"
        db.commit()
