from fastapi import APIRouter, HTTPException

from app.services.models import NaukriRunRequest
from app.services.naukri_apify_service import NaukriApifyService

router = APIRouter(prefix="/naukri")


@router.post("/run-agent")
def run_agent(payload: NaukriRunRequest):
    service = NaukriApifyService()

    try:
        result = service.search(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if result["status_code"] >= 400:
        raise HTTPException(status_code=result["status_code"], detail=result["data"])

    rows = result["data"] if isinstance(result["data"], list) else []

    return {
        "status": "completed",
        "count": len(rows),
        "rows": rows,
    }
