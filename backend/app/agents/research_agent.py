import httpx
import os

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

async def deep_research(data: dict):
    prompt = f"""
    Analyze company signals:

    {data}

    Provide:
    - Hiring trend
    - Growth signals
    - Tech maturity
    - Risk factors
    """

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "mixtral-8x7b-32768",
                "messages": [{"role": "user", "content": prompt}]
            }
        )

    return res.json()["choices"][0]["message"]["content"]
