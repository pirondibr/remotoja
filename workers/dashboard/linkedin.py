"""LinkedIn Jobs (Brasil / remoto) — guest API + fallback ScrapingBee.

Uso:
  python -m workers.dashboard.linkedin SEO
  python -m workers.dashboard.linkedin SEO --provider scrapingbee
  python -m workers.dashboard.linkedin SEO --pages 3
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from html import unescape
from typing import Any

from workers.dashboard.common import RAW_DIR, UA, get, job, load_env, quote, save

SOURCE = "linkedin"
# geoId Brasil (LinkedIn)
GEO_BRAZIL = "106057199"
# f_WT=2 → Remote
GUEST_API = (
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
    "?keywords={kw}&location=Brazil&geoId={geo}&f_WT=2&start={start}"
)
SEARCH_PAGE = (
    "https://www.linkedin.com/jobs/search/"
    "?keywords={kw}&location=Brazil&geoId={geo}&f_WT=2&position=1&pageNum=0"
)


def clean_text(html: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", html or ""))
    return re.sub(r"\s+", " ", text).strip()


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
                "render_js": "true",
                "premium_proxy": "true",
                "wait": "3000",
            }
        )
    )
    return get(api, timeout=90)


def _fetch_guest(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _parse_job_cards(html: str) -> list[dict[str, Any]]:
    """Parse cards do HTML guest / search (base-card / job-search-card)."""
    jobs: list[dict] = []
    # Cada card costuma ser <div class="base-card ..."> ou <li>
    parts = re.split(r'<div[^>]+class="[^"]*base-card[^"]*"[^>]*>', html)
    if len(parts) < 2:
        parts = re.split(r'<li[^>]+class="[^"]*jobs-search-results__list-item[^"]*"[^>]*>', html)

    for chunk in parts[1:]:
        link_m = re.search(
            r'href="(https://[a-z.]*linkedin\.com/jobs/view/[^"?]+)',
            chunk,
        )
        if not link_m:
            link_m = re.search(r'href="(/jobs/view/[^"?]+)', chunk)
        title_m = re.search(
            r'class="[^"]*base-search-card__title[^"]*"[^>]*>(.*?)</',
            chunk,
            re.I | re.S,
        )
        if not title_m:
            title_m = re.search(
                r'class="[^"]*job-card-list__title[^"]*"[^>]*>(.*?)</',
                chunk,
                re.I | re.S,
            )
        company_m = re.search(
            r'class="[^"]*base-search-card__subtitle[^"]*"[^>]*>(.*?)</',
            chunk,
            re.I | re.S,
        )
        if not company_m:
            company_m = re.search(
                r'class="[^"]*job-card-container__primary-description[^"]*"[^>]*>(.*?)</',
                chunk,
                re.I | re.S,
            )
        loc_m = re.search(
            r'class="[^"]*job-search-card__location[^"]*"[^>]*>(.*?)</',
            chunk,
            re.I | re.S,
        )
        time_m = re.search(r"<time[^>]*datetime=\"([^\"]+)\"", chunk)

        if not title_m:
            continue
        title = clean_text(title_m.group(1))
        company = clean_text(company_m.group(1)) if company_m else "LinkedIn"
        if not title:
            continue

        href = link_m.group(1) if link_m else ""
        if href.startswith("/"):
            href = "https://www.linkedin.com" + href
        # normaliza URL sem tracking
        href = href.split("?")[0]

        job_id = ""
        id_m = re.search(r"/jobs/view/[^/]*?(\d+)", href)
        if id_m:
            job_id = id_m.group(1)
        else:
            job_id = quote(title)[:32]

        posted = None
        if time_m:
            posted = time_m.group(1)[:10]

        jobs.append(
            job(
                id=f"linkedin-{job_id}",
                source=SOURCE,
                title=title,
                company=company,
                location=clean_text(loc_m.group(1)) if loc_m else "Brasil · Remoto",
                remote=True,
                model="Remoto",
                posted=posted,
                url=href or SEARCH_PAGE.format(kw=quote(title), geo=GEO_BRAZIL),
            )
        )

    # fallback: JSON embutido
    if not jobs:
        for m in re.finditer(
            r'"title"\s*:\s*"([^"]+)".{0,400}?"companyName"\s*:\s*"([^"]+)".{0,400}?"jobPostingUrl"\s*:\s*"([^"]+)"',
            html,
            re.S,
        ):
            title, company, url = m.group(1), m.group(2), m.group(3).replace("\\u002d", "-")
            jid = re.search(r"(\d{8,})", url)
            jobs.append(
                job(
                    id=f"linkedin-{jid.group(1) if jid else quote(title)[:20]}",
                    source=SOURCE,
                    title=title,
                    company=company,
                    location="Brasil · Remoto",
                    remote=True,
                    url=url.split("?")[0],
                )
            )

    seen: set[str] = set()
    unique: list[dict] = []
    for item in jobs:
        if item["id"] in seen:
            continue
        seen.add(item["id"])
        unique.append(item)
    return unique


def fetch_linkedin(
    term: str,
    *,
    provider: str = "auto",
    pages: int = 2,
) -> list[dict]:
    provider = provider.lower()
    all_jobs: list[dict] = []
    seen: set[str] = set()

    def add(batch: list[dict]) -> None:
        for item in batch:
            if item["id"] in seen:
                continue
            seen.add(item["id"])
            all_jobs.append(item)

    if provider in {"auto", "guest"}:
        for page in range(pages):
            start = page * 25
            url = GUEST_API.format(kw=quote(term), geo=GEO_BRAZIL, start=start)
            try:
                html = _fetch_guest(url)
                RAW_DIR.mkdir(parents=True, exist_ok=True)
                (RAW_DIR / f"linkedin_guest_{start}.html").write_text(
                    html, encoding="utf-8"
                )
                batch = _parse_job_cards(html)
                if not batch:
                    break
                add(batch)
                time.sleep(0.8)
            except Exception as exc:
                print(f"guest page {page} falhou: {exc}", file=sys.stderr)
                break
        if all_jobs and provider == "guest":
            return all_jobs
        if all_jobs and provider == "auto":
            return all_jobs

    # ScrapingBee na página de busca
    if provider in {"auto", "scrapingbee"}:
        url = SEARCH_PAGE.format(kw=quote(term), geo=GEO_BRAZIL)
        html = _fetch_scrapingbee(url)
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        (RAW_DIR / "linkedin_search.html").write_text(html, encoding="utf-8")
        add(_parse_job_cards(html))

    return all_jobs


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Scraper LinkedIn Jobs BR remoto")
    parser.add_argument("term", help="Cargo, ex: SEO")
    parser.add_argument(
        "--provider",
        default="auto",
        choices=["auto", "guest", "scrapingbee"],
    )
    parser.add_argument("--pages", type=int, default=2, help="Páginas guest (25/vaga)")
    args = parser.parse_args()

    jobs = fetch_linkedin(args.term, provider=args.provider, pages=args.pages)
    path = save(
        "linkedin",
        jobs,
        meta={"term": args.term, "provider": args.provider, "pages": args.pages},
    )
    print(json.dumps({"count": len(jobs), "path": str(path)}, ensure_ascii=False, indent=2))
    for item in jobs[:5]:
        print(f"- {item['title']} · {item['company']}", file=sys.stderr)


if __name__ == "__main__":
    main()
