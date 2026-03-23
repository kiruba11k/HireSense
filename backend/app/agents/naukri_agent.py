import httpx
import os

SERPAPI_KEY = os.getenv("SERPAPI_KEY")

async def naukri_jobs(company_url: str):
    company = company_url.split("/")[-1]

    params = {
        "engine": "google_jobs",
        "q": f"{company} jobs India",
        "api_key": SERPAPI_KEY
    }

    async with httpx.AsyncClient() as client:
        res = await client.get("https://serpapi.com/search", params=params)
        data = res.json()

    jobs = []

    for job in data.get("jobs_results", []):
        jobs.append({
            "title": job.get("title"),
            "company": job.get("company_name"),
            "location": job.get("location"),
            "description": job.get("description", ""),
            "source": "google_jobs"
        })

    return jobs
