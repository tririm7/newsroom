"""RSS / Atom ingestion via feedparser + requests."""
from __future__ import annotations

import html
import logging
import re
import time
from datetime import datetime, timedelta, timezone

import feedparser
import requests

logger = logging.getLogger(__name__)

USER_AGENT = "Newsroom Bot/0.1 (+https://github.com/tririm7/newsroom)"
FEED_CONNECT_TIMEOUT = 10
FEED_READ_TIMEOUT = 15

_HTML_TAG = re.compile(r"<[^>]+>")
_WHITESPACE = re.compile(r"\s+")


def _strip_html(s: str) -> str:
    s = _HTML_TAG.sub("", s)
    s = html.unescape(s).replace(" ", " ")
    return _WHITESPACE.sub(" ", s).strip()


def _entry_image(entry, link: str) -> str | None:
    """Best-effort image URL extraction."""
    # 1) media:thumbnail / media:content
    media = getattr(entry, "media_thumbnail", None) or getattr(entry, "media_content", None)
    if media:
        for m in media if isinstance(media, list) else [media]:
            if isinstance(m, dict) and m.get("url"):
                return m["url"]
    # 2) enclosures
    for enc in getattr(entry, "enclosures", []) or []:
        if isinstance(enc, dict) and "image" in (enc.get("type") or ""):
            return enc.get("href") or enc.get("url")
    # 3) inline <img> in summary/content
    raw = getattr(entry, "summary", "") or ""
    if not raw:
        c = getattr(entry, "content", None)
        if c and isinstance(c, list) and c[0].get("value"):
            raw = c[0]["value"]
    m = re.search(r"<img[^>]+src=\"([^\"]+)\"", raw, re.IGNORECASE)
    if m:
        return m.group(1)
    return None


def parse_feed(source: dict, max_age_hours: int, is_relevant, project_id: int) -> list[dict]:
    """Fetches + parses a single source. Returns list of item dicts ready for DB."""
    url = source["url"]
    try:
        resp = requests.get(
            url,
            timeout=(FEED_CONNECT_TIMEOUT, FEED_READ_TIMEOUT),
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        logger.warning("timeout %s (%s)", source["name"], url)
        return []
    except requests.exceptions.RequestException as exc:
        logger.warning("HTTP error %s: %s", source["name"], exc)
        return []

    feed = feedparser.parse(resp.content)
    if feed.bozo and not feed.entries:
        logger.warning("parse error %s: %s", source["name"], feed.bozo_exception)
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    items: list[dict] = []
    off_topic = 0

    for entry in feed.entries:
        pub: datetime | None = None
        for field in ("published_parsed", "updated_parsed"):
            pt = getattr(entry, field, None)
            if pt:
                try:
                    pub = datetime(*pt[:6], tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    pass
                break
        if pub and pub < cutoff:
            continue

        title = (getattr(entry, "title", "") or "").strip()
        link = (getattr(entry, "link", "") or "").strip()
        if not title or not link:
            continue

        summary = _strip_html(getattr(entry, "summary", "") or "")
        if len(summary) > 500:
            summary = summary[:500] + "…"

        if not is_relevant(title, summary):
            off_topic += 1
            continue

        items.append({
            "project_id": project_id,
            "source_id": source["id"],
            "title": title,
            "url": link,
            "summary": summary or None,
            "language": source.get("language", "en"),
            "published_at": pub or datetime.now(timezone.utc),
            "image_url": _entry_image(entry, link),
        })

    logger.info("%s: %d fresh items (off-topic filtered: %d)", source["name"], len(items), off_topic)
    return items


def collect_all(sources: list[dict], project_id: int, max_age_hours: int, is_relevant) -> list[dict]:
    """Loops over all active sources, returns flat list of items."""
    out: list[dict] = []
    for s in sources:
        out.extend(parse_feed(s, max_age_hours, is_relevant, project_id))
        time.sleep(0.3)  # be a polite RSS citizen
    logger.info("collect_all: %d raw items from %d sources", len(out), len(sources))
    return out
