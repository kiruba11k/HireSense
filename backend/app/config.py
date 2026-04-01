import os


class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")
    ENV = os.getenv("ENV", "dev")
    LINKEDIN_APIFY_ACTOR_ID = os.getenv("LINKEDIN_APIFY_ACTOR_ID", "curious_coder~linkedin-jobs-scraper")
    LINKEDIN_APIFY_TOKEN = os.getenv("LINKEDIN_APIFY_TOKEN")
    NAUKRI_APIFY_ACTOR_ID = os.getenv("NAUKRI_APIFY_ACTOR_ID", "memo23~naukri-scraper")
    NAUKRI_APIFY_TOKEN = os.getenv("NAUKRI_APIFY_TOKEN")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "mixtral-8x7b-32768")
    ENABLE_JUDGE = os.getenv("ENABLE_JUDGE", "false")
    CORS_ALLOW_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOW_ORIGINS",
            "https://hiresense-frontend-on61.onrender.com,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
        ).split(",")
        if origin.strip()
    ]
    CORS_ALLOW_ORIGIN_REGEX = os.getenv(
        "CORS_ALLOW_ORIGIN_REGEX",
        r"https://hiresense-frontend.*\.onrender\.com",
    )


settings = Settings()
