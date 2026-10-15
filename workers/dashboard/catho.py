"""Catho — listagem remoto/home office (HTML articles).

Uso:
  python -m workers.dashboard.catho SEO
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse

from workers.dashboard.common import clean, get, job, load_env, quote, save

SOURCE = "catho"
SEARCH = "https://www.catho.com.br/vagas/?q={term}&remoto_home_office=true"


def _fetch(url: str) -> str:
    try:
        return get(url, timeout=35)
    except Exception as direct_exc:
        key = os.environ.get("SCRAPINGBEE_API_KEY", "").strip()
        if not key:
            raise RuntimeError(f"Catho direto falhou: {direct_exc}") from direct_exc
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


def fetch_catho(term: str) -> list[dict]:
    url = SEARCH.format(term=quote(term))
    html = _fetch(url)
    parts = re.split(r'data-offer-item="(\d+)"', html, flags=re.I)
    out: list[dict] = []
    seen: set[str] = set()

    for i in range(1, len(parts), 2):
        job_id = parts[i]
        chunk = parts[i + 1] if i + 1 < len(parts) else ""
        href_m = re.search(r'href="(/vagas/[^"/]+/\d+)"', chunk, re.I)
        title_m = re.search(
            r'<h2[^>]*class="[^"]*title_offer[^"]*"[^>]*>[\s\S]*?<a[^>]*>(.*?)</a>',
            chunk,
            re.I,
        )
        if not title_m:
            title_m = re.search(r'title="([^"]+)"[^>]*data-navigation-offer', chunk, re.I)
        company_m = re.search(r'<span class="text-12">([^<]+)</span>', chunk, re.I)
        if not company_m and re.search(r"Empresa Confidencial", chunk, re.I):
            company = "Empresa Confidencial"
        else:
            company = clean(company_m.group(1), 120) if company_m else "Catho"
        loc_m = re.search(r"i_job_location[\s\S]{0,200}?-\s*([^<]+)", chunk, re.I)
        salary_m = re.search(
            r"i_salary[\s\S]{0,120}?<strong>([^<]+)</strong>", chunk, re.I
        )
        posted_m = re.search(r"(?:Publicada|Atualizada)\s+em\s+([^<]+)", chunk, re.I)
        title = clean(title_m.group(1) if title_m else "", 160)
        if not title or job_id in seen:
            continue
        seen.add(job_id)
        href = href_m.group(1) if href_m else None
        salary = clean(salary_m.group(1), 40) if salary_m else None
        mapped = job(
            id=f"catho-{job_id}",
            source=SOURCE,
            title=title,
            company=company,
            location=clean(loc_m.group(1), 80) if loc_m else "Remoto / home office",
            remote=True,
            model="Remoto",
            posted=clean(posted_m.group(1), 40) if posted_m else None,
            url=(
                f"https://www.catho.com.br{href}"
                if href
                else SEARCH.format(term=quote(term))
            ),
            snippet=salary,
        )
        out.append(mapped)

    if not out:
        for m in re.finditer(
            r'href="(/vagas/([^"/]+)/(\d+))"[^>]*title="([^"]+)"', html, re.I
        ):
            path, _slug, job_id, title = m.group(1), m.group(2), m.group(3), m.group(4)
            if job_id in seen:
                continue
            seen.add(job_id)
            out.append(
                job(
                    id=f"catho-{job_id}",
                    source=SOURCE,
                    title=clean(title, 160),
                    company="Catho",
                    location="Remoto / home office",
                    remote=True,
                    url=f"https://www.catho.com.br{path}",
                )
            )
    return out


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Scraper Catho (dashboard)")
    parser.add_argument("term", help="Cargo / termo")
    args = parser.parse_args()
    jobs = fetch_catho(args.term)
    path = save("catho", jobs, meta={"term": args.term})
    print(json.dumps({"count": len(jobs), "path": str(path)}, ensure_ascii=False, indent=2))
    for item in jobs[:5]:
        print(f"- {item['title']} · {item['company']}", file=sys.stderr)


if __name__ == "__main__":
    main()
