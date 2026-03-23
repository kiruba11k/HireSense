import httpx
import os

SERPAPI_KEY = os.getenv("SERPAPI_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

async def detect_tech(company_url: str, job_data: list):
    company = company_url.split("/")[-1]

    # 🔹 SERP AI MODE
    serp_params = {
        "engine": "google_ai_mode",
        "q": f"{company} tech stack cloud tools backend frontend",
        "api_key": SERPAPI_KEY
    }

    async with httpx.AsyncClient() as client:
        serp = await client.get("https://serpapi.com/search", params=serp_params)
        serp_data = serp.json()

    # 🔹 WEBSITE SCRAPE (Apify)
    web = await client.post(
        f"https://api.apify.com/v2/acts/apify/website-content-crawler/runs?token={os.getenv('APIFY_API_KEY')}",
        json={"startUrls": [{"url": company_url}]}
    )

    # 🔹 LLM COMBINE
    prompt = f"""
    Combine tech signals:

    SERP:
    {serp_data}

    JOB DATA:
    {job_data}

    Extract tech stack list
    """

    llm = await client.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": "mixtral-8x7b-32768",
            "messages": [{"role": "user", "content": prompt}]
        }
    )

    return llm.json()["choices"][0]["message"]["content"]
