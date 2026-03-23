from urllib.parse import urlparse


def company_from_url(company_url: str) -> str:
    """Return a normalized company token from any URL/input string."""
    if not company_url:
        return ""

    normalized = company_url.strip()
    if not normalized.startswith(("http://", "https://")):
        normalized = f"https://{normalized}"

    parsed = urlparse(normalized)
    host = (parsed.netloc or parsed.path).lower().replace("www.", "")

    if host:
        return host.split(".")[0]

    return company_url.strip()
