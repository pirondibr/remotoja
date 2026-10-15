"""Merge + dedupe dos JSONs em workers/dashboard/output/."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from workers.dashboard.common import OUTPUT_DIR, normalize_key, save


def load_all() -> list[dict]:
    jobs: list[dict] = []
    if not OUTPUT_DIR.exists():
        return jobs
    for path in sorted(OUTPUT_DIR.glob("*.json")):
        if path.name == "merged.json":
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        jobs.extend(data.get("jobs") or [])
    return jobs


def dedupe(jobs: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for item in jobs:
        key = normalize_key(item.get("title", ""), item.get("company", ""))
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def to_app_format(jobs: list[dict]) -> list[dict]:
    """Formato consumível pelo /app (DemoJob-like)."""
    mapped = []
    for item in jobs:
        mapped.append(
            {
                "title": item.get("title"),
                "company": item.get("company"),
                "location": item.get("location") or "Brasil",
                "source": item.get("source") or "",
                "source_url": item.get("url"),
                "contract_type": item.get("contract"),
                "salary": None,
                "posted": item.get("posted"),
                "job_id": item.get("id"),
                "remote": bool(item.get("remote", True)),
            }
        )
    return mapped


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge scrapers do dashboard")
    parser.add_argument(
        "--write-app",
        action="store_true",
        help="Também grava src/data/dashboard-jobs.json para o Next",
    )
    args = parser.parse_args()

    merged = dedupe(load_all())
    path = save("merged", merged, meta={"deduped": True})
    print(json.dumps({"count": len(merged), "path": str(path)}, ensure_ascii=False, indent=2))

    if args.write_app:
        root = Path(__file__).resolve().parents[2]
        app_path = root / "src" / "data" / "dashboard-jobs.json"
        app_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "count": len(merged),
            "fetched_via": "dashboard_merge",
            "jobs": to_app_format(merged),
        }
        app_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"app: {app_path}")


if __name__ == "__main__":
    main()
