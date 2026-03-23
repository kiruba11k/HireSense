from app.agents.utils import company_from_url
import httpx
import os
import asyncio

APIFY_API_KEY = os.getenv("APIFY_API_KEY")

ACTOR = "apify/linkedin-jobs-scraper"

async def linkedin_jobs(company_url: str):
    """
    Extract company name from URL → scrape jobs
    """

    company = company_from_url(company_url)

    async with httpx.AsyncClient(timeout=60) as client:
        run = await client.post(
            f"https://api.apify.com/v2/acts/{ACTOR}/runs?token={APIFY_API_KEY}",
            json={
                "keywords": company,
                "maxItems": 20,
            }
        )

        data = run.json()
        dataset_id = data["data"]["defaultDatasetId"]

        await asyncio.sleep(5)

        res = await client.get(
            f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_API_KEY}"
        )

        items = res.json()

    return [
        {
            "title": i.get("title"),
            "company": i.get("companyName"),
            "description": i.get("descriptionText", ""),
            "location": i.get("location"),
            "source": "linkedin"
        }
        for i in items
    ]
