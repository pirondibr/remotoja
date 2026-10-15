"""Utilitários e schema normalizado dos scrapers do dashboard."""

from __future__ import annotations

import json
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DASH_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = DASH_DIR / "output"
RAW_DIR = DASH_DIR / "raw"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)


def load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def job(
    *,
    id: str,
    source: str,
    title: str,
    company: str,
    url: str,
    location: str = "",
    remote: bool = True,
    model: str = "Remoto",
    contract: str | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
    currency: str | None = "BRL",
    salary_period: str | None = None,
    posted: str | None = None,
    snippet: str | None = None,
) -> dict[str, Any]:
    return {
        "id": id,
        "source": source,
        "title": title.strip(),
        "company": company.strip(),
        "location": location.strip(),
        "remote": remote,
        "model": model,
        "contract": contract,
        "salary_min": salary_min,
        "salary_max": salary_max,
        "currency": currency,
        "salary_period": salary_period,
        "posted": posted,
        "url": url,
        "snippet": clean(snippet or "", 300),
        "captured_at": datetime.now(timezone.utc).isoformat(),
    }


def clean(text: str, limit: int = 300) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", text or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def get(url: str, *, headers: dict[str, str] | None = None, timeout: int = 45) -> str:
    req_headers = {
        "User-Agent": UA,
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        safe_url = re.sub(r"(api_key|X-API-Key)=[^&]+", r"\1=***", url, flags=re.I)
        raise RuntimeError(f"HTTP {exc.code} em {safe_url}: {body[:300]}") from exc


def save(name: str, jobs: list[dict], *, meta: dict | None = None) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{name}.json"
    payload = {
        "meta": {
            "source": name,
            "count": len(jobs),
            "saved_at": datetime.now(timezone.utc).isoformat(),
            **(meta or {}),
        },
        "jobs": jobs,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def normalize_key(title: str, company: str) -> str:
    raw = f"{title} {company}".lower()
    raw = (
        raw.replace("á", "a")
        .replace("à", "a")
        .replace("ã", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
    )
    return re.sub(r"[^a-z0-9]+", "", raw)


def quote(value: str) -> str:
    return urllib.parse.quote(value, safe="")
