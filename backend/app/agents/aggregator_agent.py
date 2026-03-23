import httpx
import os
import json

GROQ_API_KEY = os.getenv("GROQ_API_KEY")


async def aggregate_signals(jobs, tech, news, tenders=None, filings=None):
    """
    Hybrid intelligent aggregator:
    - Extracts structured metrics
    - Uses LLM for reasoning
    - Produces dynamic score + explanation
    """

    # 🔹 1. STRUCTURED FEATURES (deterministic layer)
    features = {
        "job_count": len(jobs),
        "has_ai": "ai" in str(tech).lower(),
        "has_cloud": "aws" in str(tech).lower() or "cloud" in str(tech).lower(),
        "news_mentions": len(str(news)),
        "tender_presence": bool(tenders),
        "filings_presence": bool(filings)
    }

    # 🔹 2. LLM REASONING
    prompt = f"""
    You are a SaaS intelligence scoring engine.

    INPUT:
    Jobs: {jobs[:5]}
    Tech: {tech}
    News: {news}
    Tenders: {tenders}
    Filings: {filings}

    Structured Signals:
    {features}

    TASK:
    1. Analyze company growth, hiring intent, tech maturity
    2. Assign a score from 0 to 100
    3. Classify:
       - High Opportunity
       - Medium Opportunity
       - Low Opportunity

    OUTPUT FORMAT (STRICT JSON):
    {{
        "score": number,
        "classification": "...",
        "reason": "...",
        "signals": {{
            "hiring_trend": "...",
            "tech_strength": "...",
            "market_activity": "..."
        }}
    }}
    """

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": "mixtral-8x7b-32768",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3
            }
        )

    content = res.json()["choices"][0]["message"]["content"]

    # 🔹 3. SAFE PARSING (IMPORTANT)
    try:
        llm_output = json.loads(content)
    except:
        llm_output = {
            "score": 50,
            "classification": "Unknown",
            "reason": content
        }

    # 🔹 4. FINAL HYBRID SCORE (CONTROLLED)
    final_score = min(
        100,
        int(llm_output.get("score", 50)) +
        features["job_count"] * 2 +
        (10 if features["has_ai"] else 0)
    )

    return {
        "final_score": final_score,
        "llm_score": llm_output.get("score"),
        "classification": llm_output.get("classification"),
        "reason": llm_output.get("reason"),
        "features": features,
        "signals": llm_output.get("signals", {})
    }
