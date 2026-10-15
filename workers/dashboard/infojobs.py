"""InfoJobs BR — listagem home office (HTML cards).

Uso:
  python -m workers.dashboard.infojobs SEO
"""

from __future__ import annotations

import argparse
import json
import re
import sys

from workers.dashboard.common import clean, get, job, load_env, quote, save

SOURCE = "infojobs"


def _slug(term: str) -> str:
    raw = (
        term.lower()
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
    return re.sub(r"[^a-z0-9]+", "-", raw).strip("-") or "emprego"


def fetch_infojobs(term: str) -> list[dict]:
    slug = _slug(term)
    urls = [
        f"https://www.infojobs.com.br/vagas-de-emprego-{slug}-trabalho-home-office.aspx",
        f"https://www.infojobs.com.br/vagas-de-emprego-{slug}.aspx",
    ]
    html = ""
    for url in urls:
        try:
            html = get(url)
            if html:
                break
        except Exception as exc:
            print(f"InfoJobs {url}: {exc}", file=sys.stderr)
    if not html:
        raise RuntimeError("InfoJobs: nenhuma URL respondeu")

    parts = re.split(r'<div[^>]+class="[^"]*card[^"]*js_rowCard[^"]*"', html, flags=re.I)
    out: list[dict] = []
    seen: set[str] = set()

    for part in parts[1:]:
        href_m = re.search(r'data-href="([^"]+)"', part, re.I)
        if not href_m:
            href_m = re.search(r'href="(/vaga-de-[^"]+\.aspx)"', part, re.I)
        title_m = re.search(r"<h2[^>]*>(.*?)</h2>", part, re.I | re.S)
        if not href_m or not title_m:
            continue
        href = href_m.group(1)
        title = clean(title_m.group(1), 160)

        company = "InfoJobs"
        slug_m = re.search(r"/empresa-([^_\"]+)__", part, re.I)
        if slug_m:
            company = clean(slug_m.group(1).replace("-", " ").title(), 120)
        else:
            company_m = re.search(
                r'href="https?://www\.infojobs\.com\.br/empresa-[^"]+"[^>]*>(.*?)</a>',
                part,
                re.I | re.S,
            )
            if company_m:
                raw = re.split(r"Este selo", company_m.group(1), flags=re.I)[0]
                company = clean(raw, 120) or company
            elif re.search(r"Empresa\s+confidencial", part, re.I):
                company = "Empresa confidencial"

        loc_m = re.search(
            r"(Todo Brasil|Home Office|[A-ZÁÉÍÓÚ][^|<]{2,40}\s-\s[A-Z]{2})",
            part,
            re.I,
        )
        location = clean(loc_m.group(1), 80) if loc_m else "Home office"

        id_m = re.search(r"__(\d+)\.aspx", href)
        job_id = id_m.group(1) if id_m else quote(title)[:24]
        if job_id in seen or not title:
            continue
        seen.add(job_id)
        url = href if href.startswith("http") else f"https://www.infojobs.com.br{href}"
        out.append(
            job(
                id=f"infojobs-{job_id}",
                source=SOURCE,
                title=title,
                company=company,
                location=location,
                remote=True,
                model="Remoto",
                url=url,
            )
        )
    return out


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Scraper InfoJobs (dashboard)")
    parser.add_argument("term", help="Cargo / termo")
    args = parser.parse_args()
    jobs = fetch_infojobs(args.term)
    path = save("infojobs", jobs, meta={"term": args.term})
    print(json.dumps({"count": len(jobs), "path": str(path)}, ensure_ascii=False, indent=2))
    for item in jobs[:5]:
        print(f"- {item['title']} · {item['company']}", file=sys.stderr)


if __name__ == "__main__":
    main()
