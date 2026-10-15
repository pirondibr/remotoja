"""Gupy — portal.gupy.io via __NEXT_DATA__ (sem chave).

Uso:
  python -m workers.dashboard.gupy SEO
  python -m workers.dashboard.gupy "SEO,analista de seo" --todos-modelos
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from typing import Any

from workers.dashboard.common import get, job, load_env, quote, save

SOURCE = "gupy"
BASE = "https://portal.gupy.io/job-search/term={term}&workplaceTypes[]=remote"


def _parse_page(html: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # Tag pode ter nonce e atributos extras
    start = html.find('id="__NEXT_DATA__"')
    if start < 0:
        raise RuntimeError("Gupy: __NEXT_DATA__ não encontrado (layout mudou?)")
    start = html.find(">", start)
    if start < 0:
        raise RuntimeError("Gupy: tag __NEXT_DATA__ inválida")
    start += 1
    end = html.find("</script>", start)
    data = json.loads(html[start:end])
    page_props = data.get("props", {}).get("pageProps", {})
    initial = page_props.get("initialJobList") or {}
    # formatos observados
    rows = initial.get("data") if isinstance(initial, dict) else None
    if rows is None and isinstance(page_props.get("jobs"), list):
        rows = page_props["jobs"]
    if rows is None:
        rows = []
    pagination = initial.get("pagination") if isinstance(initial, dict) else {}
    return rows, pagination or {}


def _map_row(row: dict[str, Any], *, remote_only: bool) -> dict | None:
    workplace = (row.get("workplaceType") or "").lower()
    if remote_only and workplace not in {"remote", "remoto"}:
        return None

    model_map = {
        "remote": "Remoto",
        "hybrid": "Híbrido",
        "on-site": "Presencial",
        "onsite": "Presencial",
    }
    model = model_map.get(workplace, workplace.title() or "Remoto")
    city = row.get("city") or ""
    state = row.get("state") or ""
    country = row.get("country") or ""
    location = ", ".join(p for p in (city, state, country) if p)
    job_id = str(row.get("id") or "")
    url = row.get("jobUrl") or f"https://portal.gupy.io/job/{job_id}"
    posted = (row.get("publishedDate") or "")[:10] or None

    return job(
        id=f"gupy-{job_id}",
        source=SOURCE,
        title=row.get("name") or "",
        company=row.get("careerPageName") or "",
        location=location or "Brasil",
        remote=workplace in {"remote", "remoto"},
        model=model,
        contract=row.get("type"),
        posted=posted,
        url=url,
        snippet=row.get("description"),
    )


def fetch_gupy(terms: list[str], *, remote_only: bool = True) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []

    for term in terms:
        term = term.strip()
        if not term:
            continue
        offset = 0
        while True:
            url = BASE.format(term=quote(term))
            if offset:
                url = f"{url}&offset={offset}"
            html = get(url)
            rows, pagination = _parse_page(html)
            for row in rows:
                mapped = _map_row(row, remote_only=remote_only)
                if not mapped or not mapped["title"] or not mapped["company"]:
                    continue
                if mapped["id"] in seen:
                    continue
                seen.add(mapped["id"])
                out.append(mapped)

            total = int(pagination.get("total") or 0)
            limit = int(pagination.get("limit") or 12)
            offset = int(pagination.get("offset") or 0) + limit
            if offset >= total or not rows:
                break
            time.sleep(1)

    return out


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Scraper Gupy (dashboard)")
    parser.add_argument(
        "terms",
        help='Termo ou lista: SEO  |  "SEO,analista de seo"',
    )
    parser.add_argument(
        "--todos-modelos",
        action="store_true",
        help="Inclui híbrido/presencial (padrão: só remoto)",
    )
    args = parser.parse_args()
    terms = [t.strip() for t in args.terms.split(",") if t.strip()]
    jobs = fetch_gupy(terms, remote_only=not args.todos_modelos)
    path = save(
        "gupy",
        jobs,
        meta={"terms": terms, "remote_only": not args.todos_modelos},
    )
    print(json.dumps({"count": len(jobs), "path": str(path)}, ensure_ascii=False, indent=2))
    for item in jobs[:5]:
        print(f"- {item['title']} · {item['company']}", file=sys.stderr)


if __name__ == "__main__":
    main()
