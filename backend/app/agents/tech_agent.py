import asyncio
import os

import httpx

from app.agents.utils import company_from_url

SERPAPI_KEY = os.getenv("SERPAPI_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
APIFY_API_KEY = os.getenv("APIFY_API_KEY")


async def detect_tech(company_url: str, job_data: list):
    company = company_from_url(company_url)

    serp_params = {
        "engine": "google_ai_mode",
        "q": f"{company} tech stack cloud tools backend frontend",
        "api_key": SERPAPI_KEY,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        serp_task = client.get("https://serpapi.com/search", params=serp_params)
        crawl_task = client.post(
            f"https://api.apify.com/v2/acts/apify/website-content-crawler/runs?token={APIFY_API_KEY}",
            json={"startUrls": [{"url": company_url}]},
        )

        serp, crawl = await asyncio.gather(serp_task, crawl_task)
        serp_data = serp.json()

        crawl_data = crawl.json()
        dataset_id = ((crawl_data.get("data") or {}).get("defaultDatasetId"))
        website_excerpt = []

        if dataset_id:
            dataset = await client.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_API_KEY}&clean=true"
            )
            website_excerpt = dataset.json()[:5]

        prompt = f"""
        Combine tech signals from jobs and website footprint.

        SERP:
        {serp_data}

        WEBSITE CONTENT:
        {website_excerpt}

        JOB DATA:
        {job_data}

        Return a concise list of technologies and short rationale.
        """

        llm = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "mixtral-8x7b-32768",
                "messages": [{"role": "user", "content": prompt}],
            },
        )

    return llm.json()["choices"][0]["message"]["content"]
