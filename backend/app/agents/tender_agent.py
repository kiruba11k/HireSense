import httpx
import os

SERPAPI_KEY = os.getenv("SERPAPI_KEY")

async def get_tenders(company_url: str):
    company = company_url.split("/")[-1]

    async with httpx.AsyncClient() as client:
        serp = await client.get("https://serpapi.com/search", params={
            "q": f"{company} tender OR RFP OR procurement",
            "api_key": SERPAPI_KEY
        })

    return serp.json()
