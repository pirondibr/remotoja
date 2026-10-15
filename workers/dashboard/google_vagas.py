"""Google Vagas (aba empregos) via ScrapingBee — scraper do DASHBOARD.

Não confundir com workers/scraper/google_jobs.py (DataForSEO, demo do funil).

Uso:
  python -m workers.dashboard.google_vagas SEO
  python -m workers.dashboard.google_vagas SEO --scrolls 2
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse

from workers.dashboard.common import RAW_DIR, get, job, load_env, quote, save

SOURCE = "google_vagas"
UULE_BRAZIL = "w+CAIQICIGQnJhemls"


def _build_url(query: str) -> str:
    return (
        "https://www.google.com/search?"
        + urllib.parse.urlencode(
            {
                "q": query,
                "udm": "8",
                "hl": "pt-BR",
                "gl": "br",
                "uule": UULE_BRAZIL,
            }
        )
    )


def _js_scenario(scrolls: int) -> dict:
    instructions: list[dict] = [{"wait": 3000}]
    for _ in range(max(scrolls, 0)):
        instructions.append(
            {
                "evaluate": (
                    "(() => { const cards = document.querySelectorAll('.EimVGf'); "
                    "if (cards.length) cards[cards.length-1].scrollIntoView(); "
                    "window.scrollBy(0, 800); })()"
                )
            }
        )
        instructions.append({"wait": 2500})
    return {"instructions": instructions}


def _fetch_scrapingbee(url: str, *, scrolls: int) -> str:
    key = os.environ.get("SCRAPINGBEE_API_KEY", "").strip()
    if not key:
        raise SystemExit(
            "Defina SCRAPINGBEE_API_KEY no .env para o Google Vagas do dashboard."
        )
    params = {
        "api_key": key,
        "url": url,
        "country_code": "br",
        "custom_google": "true",
        "render_js": "true",
        "stealth_proxy": "true",
        "wait": "5000",
        "js_scenario": json.dumps(_js_scenario(scrolls), separators=(",", ":")),
    }
    api = "https://app.scrapingbee.com/api/v1/?" + urllib.parse.urlencode(params)
    try:
        return get(api, timeout=120)
    except RuntimeError as exc:
        # Não vazar api_key no stderr
        msg = str(exc)
        if key in msg:
            msg = msg.replace(key, "***")
        raise RuntimeError(msg) from None

def _fix_mojibake(text: str) -> str:
    try:
        return text.encode("latin1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def _parse_cards(html: str) -> list[dict]:
    jobs: list[dict] = []
    # Cada card: div.EimVGf (classes Google mudam — revisar se zerar)
    chunks = re.split(r'<div[^>]*class="[^"]*EimVGf[^"]*"[^>]*>', html)
    for chunk in chunks[1:]:
        share = re.search(r'data-share-url="([^"]+)"', chunk)
        title_m = re.search(r'class="[^"]*tNxQIb[^"]*"[^>]*>(.*?)</', chunk, re.I | re.S)
        company_m = re.search(r'class="[^"]*a3jPc[^"]*"[^>]*>(.*?)</', chunk, re.I | re.S)
        meta_m = re.search(r'class="[^"]*FqK3wc[^"]*"[^>]*>(.*?)</', chunk, re.I | re.S)
        if not title_m or not company_m:
            continue
        title = _fix_mojibake(re.sub(r"<[^>]+>", "", title_m.group(1)).strip())
        company = _fix_mojibake(re.sub(r"<[^>]+>", "", company_m.group(1)).strip())
        meta = _fix_mojibake(re.sub(r"<[^>]+>", "", meta_m.group(1)).strip()) if meta_m else ""
        url = share.group(1).replace("&amp;", "&") if share else ""
        htid = ""
        if url:
            m = re.search(r"htidocid=([^&]+)", url)
            htid = m.group(1) if m else quote(title)[:24]
        location = meta.split("•")[0].strip() if meta else "Brasil"
        via = ""
        if "via " in meta.lower():
            via = meta.split("via ")[-1].strip()
        remote = "trabalho de casa" in chunk.lower() or "remoto" in chunk.lower()
        jobs.append(
            job(
                id=f"gjobs-{htid or len(jobs)}",
                source=SOURCE,
                title=title,
                company=company,
                location=location,
                remote=remote,
                model="Remoto" if remote else "—",
                url=url or _build_url(title),
                snippet=f"via {via}" if via else None,
            )
        )
    # dedupe por id
    seen: set[str] = set()
    unique: list[dict] = []
    for item in jobs:
        if item["id"] in seen:
            continue
        seen.add(item["id"])
        unique.append(item)
    return unique


def _fetch_dataforseo(term: str, *, depth: int = 10) -> list[dict]:
    """Fallback estável (mesma API do demo)."""
    from workers.scraper.google_jobs import build_jobs_query, fetch_google_jobs

    keyword = build_jobs_query(term)
    raw = fetch_google_jobs(keyword, depth=depth)
    out: list[dict] = []
    for item in raw:
        out.append(
            job(
                id=f"gjobs-{item.get('job_id') or quote(item.get('title', ''))[:20]}",
                source=SOURCE,
                title=item.get("title") or "",
                company=item.get("company") or "",
                location=item.get("location") or "Brasil",
                remote=bool(item.get("remote", True)),
                model="Remoto",
                contract=item.get("contract_type"),
                posted=(item.get("posted") or None),
                url=item.get("source_url") or _build_url(item.get("title") or term),
                snippet=None,
            )
        )
    return out


def fetch_google_vagas(
    term: str,
    *,
    queries: list[str] | None = None,
    scrolls: int = 3,
    provider: str = "auto",
) -> list[dict]:
    provider = provider.lower()
    if not queries:
        queries = [f"vagas de {term} remoto", f"vagas de {term} home office"]
    all_jobs: list[dict] = []
    seen: set[str] = set()

    if provider in {"auto", "scrapingbee"}:
        for q in queries:
            try:
                url = _build_url(q)
                html = _fetch_scrapingbee(url, scrolls=scrolls)
                RAW_DIR.mkdir(parents=True, exist_ok=True)
                (RAW_DIR / "google_last.html").write_text(html, encoding="utf-8")
                for item in _parse_cards(html):
                    if item["id"] in seen:
                        continue
                    seen.add(item["id"])
                    all_jobs.append(item)
            except Exception as exc:
                print(f"scrapingbee falhou ({q}): {exc}", file=sys.stderr)
        if all_jobs or provider == "scrapingbee":
            return all_jobs

    if provider in {"auto", "dataforseo"}:
        print("→ Google Vagas via DataForSEO (fallback)", file=sys.stderr)
        return _fetch_dataforseo(term)

    return all_jobs


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Google Vagas ScrapingBee (dashboard)")
    parser.add_argument("term", help="Cargo base, ex: SEO")
    parser.add_argument("--scrolls", type=int, default=3)
    parser.add_argument(
        "--provider",
        default="auto",
        choices=["auto", "scrapingbee", "dataforseo"],
    )
    parser.add_argument(
        "--q",
        default="",
        help='Consultas custom separadas por |  ex: "vagas seo remoto|vagas seo home office"',
    )
    args = parser.parse_args()
    queries = [x.strip() for x in args.q.split("|") if x.strip()] or None
    jobs = fetch_google_vagas(
        args.term, queries=queries, scrolls=args.scrolls, provider=args.provider
    )
    path = save(
        "google_vagas",
        jobs,
        meta={
            "term": args.term,
            "scrolls": args.scrolls,
            "queries": queries,
            "provider": args.provider,
        },
    )
    print(json.dumps({"count": len(jobs), "path": str(path)}, ensure_ascii=False, indent=2))
    for item in jobs[:5]:
        print(f"- {item['title']} · {item['company']}", file=sys.stderr)


if __name__ == "__main__":
    main()
