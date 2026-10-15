"""Remotar — API pública api.remotar.com.br (100% remoto).

Uso:
  python -m workers.dashboard.remotar SEO
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Any

from workers.dashboard.common import get, job, load_env, quote, save

SOURCE = "remotar"
API = "https://api.remotar.com.br/jobs?search={term}"


def _slug(value: str) -> str:
    raw = (
        value.lower()
        .replace("á", "a")
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
    return re.sub(r"[^a-z0-9]+", "-", raw).strip("-")[:80] or "vaga"


def _map_row(row: dict[str, Any]) -> dict | None:
    title = (row.get("title") or "").strip()
    company_obj = row.get("company") or {}
    company = (
        (company_obj.get("name") if isinstance(company_obj, dict) else None)
        or row.get("companyDisplayName")
        or "Remotar"
    ).strip()
    job_id = row.get("id")
    if not title or not job_id:
        return None

    location = ", ".join(p for p in (row.get("city"), row.get("state")) if p) or "Remoto"
    url = row.get("externalLink") or (
        f"https://remotar.com.br/job/{job_id}/{_slug(company)}/{_slug(title)}"
    )
    posted = (row.get("createdAt") or "")[:10] or None

    return job(
        id=f"remotar-{job_id}",
        source=SOURCE,
        title=title,
        company=company,
        location=location,
        remote=True,
        model="Remoto",
        posted=posted,
        url=url,
        snippet=row.get("subtitle") or row.get("description"),
    )


def fetch_remotar(term: str, *, max_pages: int = 3) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    page = 1
    while page <= max_pages:
        url = API.format(term=quote(term))
        if page > 1:
            url = f"{url}&page={page}"
        data = json.loads(get(url))
        rows = data.get("data") or []
        for row in rows:
            mapped = _map_row(row)
            if not mapped or mapped["id"] in seen:
                continue
            seen.add(mapped["id"])
            out.append(mapped)
        meta = data.get("meta") or {}
        last = int(meta.get("last_page") or page)
        if page >= last or not rows:
            break
        page += 1
    return out


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Scraper Remotar (dashboard)")
    parser.add_argument("term", help="Cargo / termo")
    parser.add_argument("--pages", type=int, default=3)
    args = parser.parse_args()
    jobs = fetch_remotar(args.term, max_pages=args.pages)
    path = save("remotar", jobs, meta={"term": args.term, "pages": args.pages})
    print(json.dumps({"count": len(jobs), "path": str(path)}, ensure_ascii=False, indent=2))
    for item in jobs[:5]:
        print(f"- {item['title']} · {item['company']}", file=sys.stderr)


if __name__ == "__main__":
    main()
