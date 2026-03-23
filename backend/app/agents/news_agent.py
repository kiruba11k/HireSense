from app.agents.utils import company_from_url
import httpx
import os

SERPAPI_KEY = os.getenv("SERPAPI_KEY")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY")

async def get_news(company_url: str):
    company = company_from_url(company_url)

    async with httpx.AsyncClient() as client:

        # SerpAPI News
        serp = await client.get("https://serpapi.com/search", params={
            "engine": "google_news",
            "q": company,
            "api_key": SERPAPI_KEY
        })

        # GDELT
        gdelt = await client.get(
            f"https://api.gdeltproject.org/api/v2/doc/doc?query={company}&mode=ArtList&maxrecords=20&format=json"
        )

        # NewsData
        newsdata = await client.get(
            f"https://newsdata.io/api/1/news?apikey={NEWSDATA_API_KEY}&q={company}"
        )

    return {
        "serp": serp.json(),
        "gdelt": gdelt.json(),
        "newsdata": newsdata.json()
    }
