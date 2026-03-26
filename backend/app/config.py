import os


class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")
    ENV = os.getenv("ENV", "dev")
    LINKEDIN_RAPIDAPI_HOST = os.getenv("LINKEDIN_RAPIDAPI_HOST", "linkedin-job-search-api.p.rapidapi.com")
    LINKEDIN_RAPIDAPI_KEY = os.getenv("LINKEDIN_RAPIDAPI_KEY")
    CORS_ALLOW_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOW_ORIGINS",
            "https://hiresense-frontend-on61.onrender.com,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
        ).split(",")
        if origin.strip()
    ]


settings = Settings()
