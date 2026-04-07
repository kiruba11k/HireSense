from __future__ import annotations

import json
import re
import string
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from app.config import settings


class CrawlerAgent:
    def __init__(self):
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        }

    def get_links(self, soup: BeautifulSoup | None, base_url: str) -> list[str]:
        links: set[str] = set()
        if soup is None:
            return []

        for anchor in soup.find_all("a", href=True):
            href = anchor["href"]
            full_url = urljoin(base_url, href)
            if urlparse(full_url).netloc == urlparse(base_url).netloc:
                if any(keyword in href.lower() for keyword in ["contact", "about", "career", "job", "platform"]):
                    links.add(full_url)
        return list(links)[:3]

    def fetch_page_data(self, url: str) -> dict[str, Any]:
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            scripts: list[str] = []
            for script_tag in soup.find_all("script"):
                src = script_tag.get("src")
                if src:
                    scripts.append(urljoin(url, src))
                elif script_tag.string:
                    scripts.append(script_tag.string[:500])

            text = soup.get_text(separator=" ", strip=True)
            return {"scripts": scripts, "text": text, "soup": soup}
        except Exception:
            return {"scripts": [], "text": ""}

    def crawl(self, website: str) -> dict[str, Any]:
        homepage_data = self.fetch_page_data(website)
        if not homepage_data["text"]:
            return {"scripts": [], "text": "Error: Could not reach site"}

        all_scripts = set(homepage_data["scripts"])
        combined_text = [f"URL: {website}\n{homepage_data['text']}"]

        subpages = self.get_links(homepage_data.get("soup"), website)
        for page in subpages:
            page_data = self.fetch_page_data(page)
            all_scripts.update(page_data["scripts"])
            combined_text.append(f"URL: {page}\n{page_data['text']}")

        return {"scripts": list(all_scripts), "text": "\n\n---NEW PAGE---\n\n".join(combined_text)}


class ExtractionAgent:
    def __init__(self, llm_call):
        self.llm_call = llm_call

    def extract_technologies(self, corpus: str) -> list[str]:
        prompt = f"""
        Analyze this text and list all software tools, platforms, and infrastructure.
        Include tools like: WordPress, Google Analytics, AWS, Salesforce, LinkedIn Sales Navigator, etc.

        Return ONLY a JSON list of strings. No prose.
        Example: ["WordPress", "Google Analytics"]

        TEXT:
        {corpus[:15000]}
        """
        response = self.llm_call(prompt)
        try:
            match = re.search(r"\[.*\]", response, re.DOTALL)
            return json.loads(match.group()) if match else []
        except Exception:
            return []


class ValidationAgent:
    def __init__(self, llm_call):
        self.llm_call = llm_call

    def classify_and_validate(self, technologies: list[str], corpus_with_urls: str) -> dict[str, Any]:
        prompt = f"""
You are a Technical Architect. Classify the following technologies into the specific categories provided.

CATEGORIES & DEFINITIONS:
- erp_stack: Enterprise Resource Planning (e.g., SAP, Oracle, NetSuite, Microsoft Dynamics).
- crm_stack: Customer Relationship Management (e.g., Salesforce, HubSpot, Zoho, Pipedrive).
- cloud_stack: Infrastructure & Hosting (e.g., AWS, Azure, GCP, Cloudflare, DigitalOcean).
- data_stack: Analytics, BI, and Data Tools (e.g., Google Analytics, PowerBI, Tableau, LinkedIn Sales Navigator, Snowflake).
- testing_tools: Quality Assurance & Testing (e.g., Selenium, Postman, JMeter).

TECHNOLOGIES TO CLASSIFY: {technologies}

CONTEXT DATA:
{corpus_with_urls[:12000]}

OUTPUT RULES:
1. Return ONLY raw JSON.
2. If a tool's category is unknown, omit it.
3. For 'evidence_sources', use the exact URL provided in the context.

JSON STRUCTURE:
{{
  "erp_stack": [],
  "crm_stack": [],
  "cloud_stack": [],
  "data_stack": [],
  "testing_tools": [],
  "evidence_sources": [
    {{ "tool": "Name", "evidence_sentence": "Full sentence from text", "source_url": "URL" }}
  ]
}}
"""
        response = self.llm_call(prompt)
        try:
            clean_json = response.strip().replace("```json", "").replace("```", "")
            return json.loads(clean_json)
        except Exception:
            return {}


class TechStackAgentSystem:
    _tech_db_cache: dict[str, Any] | None = None

    def __init__(self):
        self.crawler = CrawlerAgent()
        self.extractor = ExtractionAgent(_llm_call)
        self.validator = ValidationAgent(_llm_call)
        self.target_cats = {"2": "crm_stack", "51": "erp_stack", "62": "cloud_stack", "10": "data_stack"}

        if TechStackAgentSystem._tech_db_cache is None:
            TechStackAgentSystem._tech_db_cache = self._load_all_shards()
        self.tech_db = TechStackAgentSystem._tech_db_cache

    def _load_all_shards(self) -> dict[str, Any]:
        base_url = "https://raw.githubusercontent.com/dochne/wappalyzer/main/src/technologies"
        combined: dict[str, Any] = {}
        chars = list(string.ascii_lowercase) + ["_"]

        for char in chars:
            try:
                response = requests.get(f"{base_url}/{char}.json", timeout=10)
                if response.status_code == 200:
                    shard = response.json()
                    for name, info in shard.items():
                        cats = [str(cat) for cat in info.get("cats", [])]
                        if any(cat in self.target_cats for cat in cats):
                            combined[name] = info
            except Exception:
                continue
        return combined

    def fingerprint_check(self, scripts: list[str]) -> dict[str, list[str]]:
        detected = {"erp_stack": [], "crm_stack": [], "cloud_stack": [], "data_stack": []}
        for name, info in self.tech_db.items():
            cats = [str(cat) for cat in info.get("cats", [])]
            target_key = next((self.target_cats[cat] for cat in cats if cat in self.target_cats), None)
            if not target_key:
                continue

            patterns = info.get("scripts", [])
            if isinstance(patterns, str):
                patterns = [patterns]
            if "js" in info:
                patterns.extend(info["js"].keys())

            for script_src in scripts:
                for pattern in patterns:
                    try:
                        clean_pattern = pattern.split("\\;")[0].strip("^$")
                        if re.search(clean_pattern, script_src, re.I) and name not in detected[target_key]:
                            detected[target_key].append(name)
                    except Exception:
                        continue

        return detected

    def run(self, company_name: str, website: str, job_data: str = "") -> dict[str, Any]:
        normalized_website = self._normalize_website(website)
        data = self.crawler.crawl(normalized_website)
        if data.get("text") == "Error: Could not reach site":
            return {
                "company_name": company_name,
                "erp_stack": [],
                "crm_stack": [],
                "cloud_stack": [],
                "data_stack": [],
                "testing_tools": [],
                "evidence_sources": [],
                "error": f"Could not reach site: {normalized_website}",
            }

        fingerprint_hits = self.fingerprint_check(data["scripts"])
        llm_techs = self.extractor.extract_technologies(data["text"] + " " + job_data)

        combined_discovery = list(set(llm_techs + [item for sublist in fingerprint_hits.values() for item in sublist]))
        result = self.validator.classify_and_validate(combined_discovery, data["text"])

        for category, technologies in fingerprint_hits.items():
            if category in result:
                result[category] = list(set(result[category] + technologies))
            else:
                result[category] = technologies

        result.setdefault("testing_tools", [])
        result.setdefault("evidence_sources", [])
        result["company_name"] = company_name
        return result

    @staticmethod
    def _normalize_website(website: str) -> str:
        token = (website or "").strip()
        if not token:
            return token
        if not token.startswith(("http://", "https://")):
            return f"https://{token}"
        return token


def _llm_call(prompt: str) -> str:
    api_key = settings.GROQ_API_KEY
    if not api_key:
        return "[]"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "Return ONLY raw JSON. No conversational text."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
    }

    try:
        response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return content if isinstance(content, str) else "[]"
    except Exception:
        return "[]"
