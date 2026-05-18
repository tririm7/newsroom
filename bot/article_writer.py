"""Claude-driven article writer.

Loads the system prompt from `prompts/article_{locale}.txt`. User message
is a JSON payload with the cluster headline + source items. Claude returns
{title, slug, excerpt, content_html} which we sanitize and insert into the
articles table.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import anthropic

import db
import settings
from jsonparse import parse_lenient

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"

_SLUG_NON_ALNUM = re.compile(r"[^a-z0-9-]+")


def _claude() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _load_prompt(language: str) -> str:
    path = PROMPTS_DIR / f"article_{language}.txt"
    if not path.exists():
        raise FileNotFoundError(f"article prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def _sanitize_slug(slug: str, cluster_id: int) -> str:
    s = slug.lower().strip()
    s = _SLUG_NON_ALNUM.sub("-", s).strip("-")
    if not s:
        s = f"cluster-{cluster_id}"
    return s[:60].rstrip("-") or f"cluster-{cluster_id}"


def write_article(project_id: int, language: str, cluster: dict) -> dict | None:
    items = cluster.get("items") or []
    if not items:
        logger.warning("cluster %s has no items, skipping article gen", cluster["id"])
        return None

    system = _load_prompt(language)
    payload = {
        "headline": cluster["headline"],
        "description": cluster.get("description"),
        "items": [
            {
                "source_name": it["source_name"],
                "title": it["title"],
                "summary": (it.get("summary") or "")[:400],
                "url": it["url"],
            }
            for it in items
        ],
    }

    client = _claude()
    resp = client.messages.create(
        model=settings.CLAUDE_MODEL_WRITE,
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    try:
        data = parse_lenient(text)
    except Exception:
        logger.exception("article writer: parse failed; raw=%s", text[:500])
        return None

    if not isinstance(data, dict):
        logger.error("article writer: parsed result is not a dict (%s)", type(data).__name__)
        return None
    missing = {"title", "slug", "excerpt", "content_html"} - set(data)
    if missing:
        logger.error("article writer: missing keys %s", missing)
        return None

    slug = _sanitize_slug(str(data["slug"]), cluster["id"])
    article_id = db.save_article(
        project_id=project_id,
        cluster_id=cluster["id"],
        slug=slug,
        title=str(data["title"])[:200],
        excerpt=str(data.get("excerpt") or "")[:500] or None,
        content_html=str(data["content_html"]),
        language=language,
    )
    if article_id == 0:
        logger.warning("cluster %s: slug conflict, article skipped", cluster["id"])
        return None
    logger.info("article id=%d slug=%s cluster=%s", article_id, slug, cluster["id"])
    return {"id": article_id, "slug": slug, "title": data["title"]}
