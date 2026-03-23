from app.agents.utils import company_from_url
import httpx
import os

SERPAPI_KEY = os.getenv("SERPAPI_KEY")
FMP_API_KEY = os.getenv("FMP_API_KEY")

async def get_filings(company_url: str):
    company = company_from_url(company_url)

    async with httpx.AsyncClient() as client:

        # Find PDFs
        serp = await client.get("https://serpapi.com/search", params={
            "q": f"{company} annual report pdf investor relations",
            "api_key": SERPAPI_KEY
        })

        # Financial data
        fmp = await client.get(
            f"https://financialmodelingprep.com/api/v3/income-statement/{company}?apikey={FMP_API_KEY}"
        )

    return {
        "reports": serp.json(),
        "financials": fmp.json()
    }
