from pydantic import BaseModel
from typing import List, Optional

class NaukriRunRequest(BaseModel):

    keywords: List[str] = []
    locations: List[str] = []
    experience: Optional[str] = None
    max_pages: int = 2
