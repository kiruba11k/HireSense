import httpx
import os

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

async def detect_intent(description: str):
    prompt = f"""
    Analyze hiring intent:

    Description:
    {description}

    Return ONLY:
    high_intent / medium_intent / low_intent
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

    return res.json()["choices"][0]["message"]["content"].strip()
