from __future__ import annotations

import csv
import io
from typing import Any

REQUIRED_COLUMNS = {"job_title", "job_description", "company_name", "historical_job_count"}


def parse_intent_csv(content: bytes) -> list[dict[str, Any]]:
    text = content.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        raise ValueError("CSV file is missing headers")

    missing = REQUIRED_COLUMNS - set(reader.fieldnames)
    if missing:
        raise ValueError(f"CSV missing required columns: {', '.join(sorted(missing))}")

    rows: list[dict[str, Any]] = []
    for row in reader:
        rows.append(
            {
                "job_title": (row.get("job_title") or "").strip(),
                "job_description": (row.get("job_description") or "").strip(),
                "company_name": (row.get("company_name") or "").strip(),
                "historical_job_count": _to_int(row.get("historical_job_count")),
            }
        )

    return rows


def _to_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0
