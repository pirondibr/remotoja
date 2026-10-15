"""Google Vagas (Jobs) via DataForSEO — fonte estável para o Brasil.

Uso:
  set DATAFORSEO_USER=...
  set DATAFORSEO_PASS=...
  python -m workers.scraper.google_jobs --keyword "vagas de seo home office"

Saídas:
  data/demo_jobs.json
  src/data/demo-jobs.json  (consumido pela landing Next.js)
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API_POST = "https://api.dataforseo.com/v3/serp/google/jobs/task_post"
API_GET = "https://api.dataforseo.com/v3/serp/google/jobs/task_get/advanced"


def _load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _auth_header() -> str:
    user = os.environ.get("DATAFORSEO_USER", "").strip()
    password = os.environ.get("DATAFORSEO_PASS", "").strip()
    if not user or not password:
        raise SystemExit(
            "Defina DATAFORSEO_USER e DATAFORSEO_PASS no ambiente ou no arquivo .env"
        )
    token = base64.b64encode(f"{user}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def _request(method: str, url: str, payload: object | None = None) -> dict:
    headers = {"Authorization": _auth_header(), "Content-Type": "application/json"}
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {exc.code} em {url}: {body}") from exc


def _is_remote(title: str, location: str) -> bool:
    blob = f"{title} {location}".lower()
    markers = (
        "remoto",
        "remote",
        "home office",
        "qualquer lugar",
        "work from home",
        "brasil",
    )
    return any(marker in blob for marker in markers)


def normalize_item(item: dict) -> dict | None:
    if item.get("type") != "google_jobs_item":
        return None
    title = (item.get("title") or "").strip()
    company = (item.get("employer_name") or "").strip()
    if not title or not company:
        return None
    source = (item.get("source_name") or "").replace("via ", "").strip() or "Google Vagas"
    location = (item.get("location") or "Brasil").strip()
    return {
        "title": title,
        "company": company,
        "location": location,
        "source": source,
        "source_url": item.get("source_url"),
        "contract_type": item.get("contract_type"),
        "salary": item.get("salary"),
        "posted": item.get("time_ago"),
        "job_id": item.get("job_id"),
        "remote": _is_remote(title, location),
    }


def fetch_google_jobs(
    keyword: str,
    *,
    location_code: int = 2076,
    language_code: str = "pt",
    depth: int = 10,
    poll_seconds: int = 3,
    max_polls: int = 30,
) -> list[dict]:
    created = _request(
        "POST",
        API_POST,
        [
            {
                "keyword": keyword,
                "location_code": location_code,
                "language_code": language_code,
                "depth": depth,
            }
        ],
    )
    task = created["tasks"][0]
    if task.get("status_code") not in (20000, 20100):
        raise SystemExit(f"Falha ao criar task: {task.get('status_message')}")

    task_id = task["id"]
    print(f"task criada: {task_id}", file=sys.stderr)

    for attempt in range(1, max_polls + 1):
        time.sleep(poll_seconds)
        data = _request("GET", f"{API_GET}/{task_id}")
        status = data["tasks"][0].get("status_code")
        message = data["tasks"][0].get("status_message")
        print(f"poll {attempt}: {status} {message}", file=sys.stderr)
        if status == 20000:
            result = (data["tasks"][0].get("result") or [{}])[0]
            items = result.get("items") or []
            jobs = [job for item in items if (job := normalize_item(item))]
            return jobs
        if status not in (20100, 40601, 40602):
            raise SystemExit(f"Task falhou: {status} {message}")

    raise SystemExit("Timeout aguardando Google Jobs no DataForSEO")


def write_outputs(keyword: str, jobs: list[dict]) -> None:
    payload = {
        "query": keyword,
        "location": "Brazil",
        "fetched_via": "dataforseo_google_jobs",
        "count": len(jobs),
        "jobs": jobs,
    }
    targets = [
        ROOT / "data" / "demo_jobs.json",
        ROOT / "src" / "data" / "demo-jobs.json",
    ]
    for path in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"salvo: {path}", file=sys.stderr)


def main() -> None:
    _load_dotenv()
    parser = argparse.ArgumentParser(description="Scraper Google Vagas via DataForSEO")
    parser.add_argument(
        "--keyword",
        default="vagas de seo home office",
        help="Termo de busca no Google Vagas",
    )
    parser.add_argument("--depth", type=int, default=10)
    parser.add_argument("--location-code", type=int, default=2076, help="2076 = Brazil")
    args = parser.parse_args()

    jobs = fetch_google_jobs(
        args.keyword,
        location_code=args.location_code,
        depth=args.depth,
    )
    write_outputs(args.keyword, jobs)
    print(json.dumps({"count": len(jobs), "jobs": jobs[:5]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
