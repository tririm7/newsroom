"""Newsroom seed script.

Inserts the initial project row, admin user (bcrypt-hashed password), and the
preset's sources + keywords. Run via installer (M2):

    docker compose --profile manual run --rm \\
        -v "$REPO_DIR/installer/presets:/presets:ro" \\
        -e ADMIN_PASSWORD="..." \\
        bot python seed.py --preset-file=/presets/ai-news.yaml \\
            --slug=newsroom --name="..." --domain="..." \\
            --locale=ru --timezone=America/New_York \\
            --brand-name="..." --brand-suffix="AI" --brand-color="#1e3a8a"

Password is read from ADMIN_PASSWORD env var (not argv) so it can't leak via `ps`.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import bcrypt
import psycopg
import yaml


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--preset-file", required=True, help="Path to preset YAML")
    ap.add_argument("--slug", required=True, help="Project slug (multi-tenant key, 'newsroom' in Open)")
    ap.add_argument("--name", required=True, help="Project display name")
    ap.add_argument("--domain", required=True, help="Public domain or 'localhost'")
    ap.add_argument("--description", default="", help="SEO description")
    ap.add_argument("--locale", required=True, choices=["ru", "en", "es"])
    ap.add_argument("--timezone", required=True, help="IANA timezone")
    ap.add_argument("--brand-name", required=True)
    ap.add_argument("--brand-suffix", required=True)
    ap.add_argument("--brand-color", required=True, help="Hex #rrggbb")
    ap.add_argument("--brand-color-hover", default=None)
    ap.add_argument("--admin-username", default="admin")
    ap.add_argument("--llm-provider", default="deepseek",
                    choices=["deepseek", "openai", "anthropic", "gemini",
                             "grok", "yandex", "openrouter", "custom"])
    ap.add_argument("--llm-model", default="deepseek-chat")
    ap.add_argument("--llm-api-key", default="")
    ap.add_argument("--llm-base-url", default=None)
    return ap.parse_args()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def main() -> int:
    args = parse_args()

    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        print("ADMIN_PASSWORD env var must be set", file=sys.stderr)
        return 1

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL env var must be set", file=sys.stderr)
        return 1

    preset_path = Path(args.preset_file)
    if not preset_path.exists():
        print(f"Preset file not found: {preset_path}", file=sys.stderr)
        return 1

    preset = yaml.safe_load(preset_path.read_text(encoding="utf-8")) or {}
    sources = preset.get("sources", []) or []
    keywords = preset.get("keywords", []) or []

    password_hash = hash_password(admin_password)

    with psycopg.connect(database_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM projects WHERE slug = %s", (args.slug,))
            existing = cur.fetchone()
            if existing:
                print(
                    f"ERROR: project '{args.slug}' already exists (id={existing[0]}). "
                    f"Re-running seed is not supported — wipe the database first "
                    f"('docker compose down -v') or use the admin panel for further edits.",
                    file=sys.stderr,
                )
                return 2

            cur.execute(
                """
                INSERT INTO projects (
                    slug, name, domain, description,
                    primary_locale, timezone,
                    brand_name, brand_suffix, brand_color, brand_color_hover,
                    llm_provider, llm_model, llm_api_key, llm_base_url
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    args.slug, args.name, args.domain, args.description,
                    args.locale, args.timezone,
                    args.brand_name, args.brand_suffix,
                    args.brand_color, args.brand_color_hover,
                    args.llm_provider, args.llm_model,
                    args.llm_api_key or None, args.llm_base_url,
                ),
            )
            project_id = cur.fetchone()[0]
            print(f"  + project id={project_id} slug={args.slug}"
                  f" (llm={args.llm_provider}/{args.llm_model})")

            cur.execute(
                "INSERT INTO users (project_id, username, password_hash) VALUES (%s, %s, %s)",
                (project_id, args.admin_username, password_hash),
            )
            print(f"  + admin user '{args.admin_username}'")

            for s in sources:
                cur.execute(
                    """
                    INSERT INTO sources (project_id, name, url, type, language, tier, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        project_id,
                        s["name"], s["url"],
                        s.get("type", "rss"),
                        s.get("language", "en"),
                        int(s.get("tier", 3)),
                        bool(s.get("is_active", True)),
                    ),
                )
            print(f"  + {len(sources)} sources")

            for k in keywords:
                cur.execute(
                    """
                    INSERT INTO keywords (project_id, pattern, is_regex, category, is_active)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        project_id,
                        k["pattern"],
                        bool(k.get("is_regex", False)),
                        k.get("category", "general"),
                        bool(k.get("is_active", True)),
                    ),
                )
            print(f"  + {len(keywords)} keywords")
        conn.commit()

    return 0


if __name__ == "__main__":
    sys.exit(main())
