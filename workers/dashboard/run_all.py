"""Roda a bateria do dashboard: gupy → indeed → google_vagas → merge.

Uso:
  python -m workers.dashboard.run_all SEO
  python -m workers.dashboard.run_all SEO --skip-google --provider tinyfish
"""

from __future__ import annotations

import argparse
import json
import sys

from workers.dashboard import gupy, indeed, google_vagas, merge
from workers.dashboard.common import load_env


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Pipeline scrapers dashboard")
    parser.add_argument("term", help="Cargo, ex: SEO")
    parser.add_argument("--skip-gupy", action="store_true")
    parser.add_argument("--skip-indeed", action="store_true")
    parser.add_argument("--skip-google", action="store_true")
    parser.add_argument("--provider", default="auto", help="Indeed provider")
    parser.add_argument("--scrolls", type=int, default=2)
    parser.add_argument("--write-app", action="store_true")
    args = parser.parse_args()

    summary: dict = {"term": args.term, "sources": {}}

    if not args.skip_gupy:
        print("→ Gupy", file=sys.stderr)
        jobs = gupy.fetch_gupy([args.term], remote_only=True)
        from workers.dashboard.common import save

        save("gupy", jobs, meta={"term": args.term})
        summary["sources"]["gupy"] = len(jobs)

    if not args.skip_indeed:
        print("→ Indeed", file=sys.stderr)
        try:
            jobs = indeed.fetch_indeed(args.term, provider=args.provider)
            from workers.dashboard.common import save

            save("indeed", jobs, meta={"term": args.term, "provider": args.provider})
            summary["sources"]["indeed"] = len(jobs)
        except SystemExit as exc:
            print(f"Indeed pulado: {exc}", file=sys.stderr)
            summary["sources"]["indeed"] = f"skipped: {exc}"

    if not args.skip_google:
        print("→ Google Vagas (ScrapingBee)", file=sys.stderr)
        try:
            jobs = google_vagas.fetch_google_vagas(args.term, scrolls=args.scrolls)
            from workers.dashboard.common import save

            save("google_vagas", jobs, meta={"term": args.term})
            summary["sources"]["google_vagas"] = len(jobs)
        except SystemExit as exc:
            print(f"Google Vagas pulado: {exc}", file=sys.stderr)
            summary["sources"]["google_vagas"] = f"skipped: {exc}"

    merged = merge.dedupe(merge.load_all())
    from workers.dashboard.common import save

    save("merged", merged, meta={"deduped": True})
    summary["merged"] = len(merged)

    if args.write_app:
        sys.argv = ["merge", "--write-app"]
        merge.main()

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
