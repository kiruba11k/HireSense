import os


class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL")
    ENV = os.getenv("ENV", "dev")
    LINKEDIN_RAPIDAPI_HOST = os.getenv("LINKEDIN_RAPIDAPI_HOST", "linkedin-job-search-api.p.rapidapi.com")
    LINKEDIN_RAPIDAPI_KEY = os.getenv("LINKEDIN_RAPIDAPI_KEY")


settings = Settings()
