"""Roda a bateria do dashboard e faz merge.

Uso:
  python -m workers.dashboard.run_all SEO
  python -m workers.dashboard.run_all SEO --provider tinyfish --skip-google
"""

from __future__ import annotations

import argparse
import json
import sys

from workers.dashboard import (
    catho,
    google_vagas,
    gupy,
    indeed,
    infojobs,
    linkedin,
    merge,
    programathor,
    remotar,
)
from workers.dashboard.common import load_env, save


def _run(label: str, fn, summary: dict, key: str) -> None:
    print(f"→ {label}", file=sys.stderr)
    try:
        jobs = fn()
        save(key, jobs, meta={"term": summary["term"]})
        summary["sources"][key] = len(jobs)
    except (SystemExit, Exception) as exc:
        print(f"{label} pulado: {exc}", file=sys.stderr)
        summary["sources"][key] = f"skipped: {exc}"


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description="Pipeline scrapers dashboard")
    parser.add_argument("term", help="Cargo, ex: SEO")
    parser.add_argument("--skip-gupy", action="store_true")
    parser.add_argument("--skip-indeed", action="store_true")
    parser.add_argument("--skip-linkedin", action="store_true")
    parser.add_argument("--skip-google", action="store_true")
    parser.add_argument("--skip-remotar", action="store_true")
    parser.add_argument("--skip-programathor", action="store_true")
    parser.add_argument("--skip-infojobs", action="store_true")
    parser.add_argument("--skip-catho", action="store_true")
    parser.add_argument("--provider", default="auto", help="Indeed provider")
    parser.add_argument("--linkedin-provider", default="auto")
    parser.add_argument("--scrolls", type=int, default=2)
    parser.add_argument("--linkedin-pages", type=int, default=2)
    parser.add_argument("--write-app", action="store_true")
    args = parser.parse_args()

    summary: dict = {"term": args.term, "sources": {}}

    if not args.skip_gupy:
        _run(
            "Gupy",
            lambda: gupy.fetch_gupy([args.term], remote_only=True),
            summary,
            "gupy",
        )

    if not args.skip_remotar:
        _run("Remotar", lambda: remotar.fetch_remotar(args.term), summary, "remotar")

    if not args.skip_programathor:
        _run(
            "Programathor",
            lambda: programathor.fetch_programathor(args.term),
            summary,
            "programathor",
        )

    if not args.skip_infojobs:
        _run(
            "InfoJobs",
            lambda: infojobs.fetch_infojobs(args.term),
            summary,
            "infojobs",
        )

    if not args.skip_catho:
        _run("Catho", lambda: catho.fetch_catho(args.term), summary, "catho")

    if not args.skip_indeed:
        _run(
            "Indeed",
            lambda: indeed.fetch_indeed(args.term, provider=args.provider),
            summary,
            "indeed",
        )

    if not args.skip_linkedin:
        _run(
            "LinkedIn",
            lambda: linkedin.fetch_linkedin(
                args.term,
                provider=args.linkedin_provider,
                pages=args.linkedin_pages,
            ),
            summary,
            "linkedin",
        )

    if not args.skip_google:
        _run(
            "Google Vagas",
            lambda: google_vagas.fetch_google_vagas(
                args.term, scrolls=args.scrolls, provider="auto"
            ),
            summary,
            "google_vagas",
        )

    merged = merge.dedupe(merge.load_all())
    save("merged", merged, meta={"deduped": True})
    summary["merged"] = len(merged)

    if args.write_app:
        sys.argv = ["merge", "--write-app"]
        merge.main()

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
