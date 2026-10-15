"""Indeed Brasil — ScrapingBee / TinyFish (Cloudflare bloqueia direto).

Uso:
  python -m workers.dashboard.indeed SEO --provider tinyfish
  python -m workers.dashboard.indeed SEO --provider scrapingbee
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from typing import Any

from workers.dashboard.common import RAW_DIR, get, job, load_env, quote, save

SOURCE = "indeed"
SEARCH_URL = "https://br.indeed.com/jobs?q={q}&l=Remoto&sort=date"


def _fetch_scrapingbee(url: str) -> str:
    key = os.environ.get("SCRAPINGBEE_API_KEY", "").strip()
    if not key:
        raise SystemExit("Defina SCRAPINGBEE_API_KEY no .env")
    api = (
        "https://app.scrapingbee.com/api/v1/?"
        + urllib.parse.urlencode(
            {
                "api_key": key,
                "url": url,
                "country_code": "br",
                "premium_proxy": "true",
                "render_js": "true",
            }
        )
    )
    return get(api, timeout=90)


def _fetch_tinyfish(url: str) -> str:
    key = os.environ.get("TINYFISH_API_KEY", "").strip()
    if not key:
        raise SystemExit("Defina TINYFISH_API_KEY no .env")
    payload = json.dumps({"urls": [url], "format": "markdown"}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.fetch.tinyfish.ai",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-API-Key": key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    # Formatos possíveis da API
    if isinstance(data, list) and data:
        first = data[0]
        return first.get("text") or first.get("markdown") or first.get("content") or ""
    if isinstance(data, dict):
        results = data.get("results") or data.get("data") or []
        if results:
            first = results[0]
            return first.get("text") or first.get("markdown") or ""
        return data.get("text") or data.get("markdown") or ""
    return ""


def _parse_mosaic_html(html: str) -> list[dict]:
    """Parse JSON embutido no HTML do Indeed (mosaic job cards)."""
    marker = 'window.mosaic.providerData["mosaic-provider-jobcards"]='
    idx = html.find(marker)
    if idx < 0:
        # fallback: procurar o model
        m = re.search(
            r'"mosaicProviderJobCardsModel"\s*:\s*(\{.*?\})\s*,\s*"',
            html,
            re.DOTALL,
        )
        if not m:
            return []
        try:
            model = json.loads(m.group(1))
        except json.JSONDecodeError:
            return []
    else:
        start = idx + len(marker)
        # objeto até o próximo ;\n
        depth = 0
        end = start
        for i, ch in enumerate(html[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        try:
            blob = json.loads(html[start:end])
        except json.JSONDecodeError:
            return []
        model = (
            blob.get("metaData", {})
            .get("mosaicProviderJobCardsModel", {})
        )

    results = model.get("results") or []
    jobs: list[dict] = []
    for row in results:
        jk = row.get("jobkey") or row.get("jobKey") or ""
        title = row.get("title") or ""
        company = (
            row.get("company")
            or (row.get("companyName") if isinstance(row.get("companyName"), str) else "")
            or ""
        )
        if isinstance(row.get("company"), dict):
            company = row["company"].get("name") or company
        if not title or not jk:
            continue
        salary = row.get("extractedSalary") or {}
        jobs.append(
            job(
                id=f"indeed-{jk}",
                source=SOURCE,
                title=title,
                company=company or "Indeed",
                location=row.get("formattedLocation") or "Remoto",
                remote=bool(row.get("remoteLocation", True)),
                model="Remoto",
                contract=", ".join(row.get("jobTypes") or []) or None,
                salary_min=salary.get("min"),
                salary_max=salary.get("max"),
                salary_period=salary.get("type"),
                url=f"https://br.indeed.com/viewjob?jk={jk}",
                snippet=row.get("snippet"),
            )
        )
    return jobs


def _parse_tinyfish_markdown(md: str, search_url: str) -> list[dict]:
    """Parse frágil de markdown TinyFish — sem link individual confiável."""
    jobs: list[dict] = []
    for line in md.splitlines():
        if "|" not in line or len(line) < 20:
            continue
        # heurística: Título  Empresa  Local
        parts = re.split(r"\s{2,}", line.strip(" |"))
        if len(parts) < 2:
            continue
        title, company = parts[0], parts[1]
        if len(title) < 4 or title.lower() in {"title", "título"}:
            continue
        loc = parts[2] if len(parts) > 2 else "Remoto"
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:40]
        jobs.append(
            job(
                id=f"indeed-md-{slug}",
                source=SOURCE,
                title=title,
                company=company,
                location=loc,
                remote=True,
                url=search_url,
                snippet="Indeed (via TinyFish markdown — link genérico da busca)",
            )
        )
    return jobs


def fetch_indeed(term: str, *, provider: str = "auto") -> list[dict]:
    url = SEARCH_URL.format(q=quote(term))
    provider = provider.lower()

    if provider == "auto":
        try:
            html = get(url)
            if "Security Check" in html or "cf-browser-verification" in html:
                raise RuntimeError("Cloudflare")
            jobs = _parse_mosaic_html(html)
            if jobs:
                return jobs
        except Exception:
            pass
        if os.environ.get("SCRAPINGBEE_API_KEY"):
            provider = "scrapingbee"
        elif os.environ.get("TINYFISH_API_KEY"):
            provider = "tinyfish"
        else:
            raise SystemExit(
                "Indeed bloqueou acesso direto. Configure SCRAPINGBEE_API_KEY ou TINYFISH_API_KEY."
            )

    if provider == "scrapingbee":
        html = _fetch_scrapingbee(url)
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        (RAW_DIR / "indeed_last.html").write_text(html, encoding="utf-8")
        return _parse_mosaic_html(html)

    if provider == "tinyfish":
        md = _fetch_tinyfish(url)
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        (RAW_DIR / "indeed_last.md").write_text(md, encoding="utf-8")
        return _parse_tinyfish_markdown(md, url)

    raise SystemExit(f"Provider desconhecido: {provider}")


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Scraper Indeed BR (dashboard)")
    parser.add_argument("term", help="Cargo / termo")
    parser.add_argument(
        "--provider",
        default="auto",
        choices=["auto", "scrapingbee", "tinyfish"],
    )
    args = parser.parse_args()
    jobs = fetch_indeed(args.term, provider=args.provider)
    path = save("indeed", jobs, meta={"term": args.term, "provider": args.provider})
    print(json.dumps({"count": len(jobs), "path": str(path)}, ensure_ascii=False, indent=2))
    for item in jobs[:5]:
        print(f"- {item['title']} · {item['company']}", file=sys.stderr)


if __name__ == "__main__":
    main()
