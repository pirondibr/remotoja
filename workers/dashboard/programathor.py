"""Programathor — HTML cell-list (filtro remoto).

Uso:
  python -m workers.dashboard.programathor SEO
  python -m workers.dashboard.programathor "full stack" --sem-filtro-termo
"""

from __future__ import annotations

import argparse
import json
import re
import sys

from workers.dashboard.common import clean, get, job, load_env, quote, save

SOURCE = "programathor"
SEARCH = (
    "https://programathor.com.br/jobs?locale=en&q={term}&worktype=remoto"
)


def _term_matches(title: str, term: str) -> bool:
    t = term.strip().lower()
    if not t:
        return True
    hay = title.lower()
    if t in hay:
        return True
    parts = [p for p in t.split() if p]
    return len(parts) > 1 and all(p in hay for p in parts)


def fetch_programathor(term: str, *, filter_term: bool = True) -> list[dict]:
    html = get(SEARCH.format(term=quote(term)))
    blocks = re.split(r'<div class="cell-list\s*">', html)
    out: list[dict] = []
    seen: set[str] = set()

    for block in blocks[1:]:
        href_m = re.search(r'href="(/jobs/(\d+)-[^"]+)"', block)
        if not href_m:
            continue
        href, job_id = href_m.group(1), href_m.group(2)
        title_m = re.search(r"<h[1-4][^>]*>(.*?)</h[1-4]>", block, re.I | re.S)
        title = clean(title_m.group(1) if title_m else "", 160)
        company_m = re.search(r"fa-briefcase'></i>([^<]+)", block)
        if not company_m:
            company_m = re.search(r'img alt="([^"]+)"', block)
        company = clean(company_m.group(1) if company_m else "Programathor", 120)
        loc_m = re.search(r"fa-map-marker-alt'></i>([^<]+)", block)
        location = clean(loc_m.group(1) if loc_m else "Remoto", 80)

        if not title or job_id in seen:
            continue
        if "híbrido" in location.lower() or "hibrido" in location.lower():
            if "remoto" not in location.lower():
                continue
        if filter_term and not _term_matches(title, term) and not _term_matches(company, term):
            continue

        seen.add(job_id)
        out.append(
            job(
                id=f"programathor-{job_id}",
                source=SOURCE,
                title=title,
                company=company,
                location=location,
                remote=True,
                model="Remoto",
                url=f"https://programathor.com.br{href}",
            )
        )
    return out


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Scraper Programathor (dashboard)")
    parser.add_argument("term", help="Cargo / termo")
    parser.add_argument(
        "--sem-filtro-termo",
        action="store_true",
        help="Não filtra títulos pelo termo (o site às vezes ignora q=)",
    )
    args = parser.parse_args()
    jobs = fetch_programathor(args.term, filter_term=not args.sem_filtro_termo)
    path = save("programathor", jobs, meta={"term": args.term})
    print(json.dumps({"count": len(jobs), "path": str(path)}, ensure_ascii=False, indent=2))
    for item in jobs[:5]:
        print(f"- {item['title']} · {item['company']}", file=sys.stderr)


if __name__ == "__main__":
    main()
