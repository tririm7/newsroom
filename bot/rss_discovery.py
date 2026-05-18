"""Discover RSS / Atom feed URLs for a given domain.

Used by the admin "Add source by domain" UX (M5). Strategy:
  1. GET the domain root, scan for `<link rel="alternate" type="application/rss+xml">`
     and similar atom variants.
  2. If none found, probe common paths (/feed, /rss.xml, /atom.xml, ...).

No LLM, no external services beyond the target site itself.
"""
from __future__ import annotations

import logging
import re
from urllib.parse import urljoin

import requests

logger = logging.getLogger(__name__)

USER_AGENT = "Newsroom Bot/0.1 (+https://github.com/tririm7/newsroom)"

COMMON_PATHS: tuple[str, ...] = (
    "/feed", "/feed/", "/rss", "/rss.xml", "/atom.xml",
    "/feed.atom", "/index.xml", "/feeds/posts/default",
)

_LINK_TAG_RE = re.compile(r"<link\b[^>]*>", re.IGNORECASE)
_REL_ALT_RE = re.compile(r'rel\s*=\s*["\']alternate["\']', re.IGNORECASE)
_HREF_RE = re.compile(r'href\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
_TYPE_RE = re.compile(r'type\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
_TITLE_RE = re.compile(r'title\s*=\s*["\']([^"\']*)["\']', re.IGNORECASE)


def _feed_type(mime: str) -> str | None:
    m = mime.lower()
    if "atom" in m:
        return "atom"
    if "rss" in m or "rdf" in m:
        return "rss"
    return None


def extract_links_from_html(html: str, base_url: str) -> list[dict]:
    """Parse a single HTML document, return feed candidates from <link rel=alternate>."""
    found: list[dict] = []
    seen: set[str] = set()
    for tag in _LINK_TAG_RE.findall(html):
        if not _REL_ALT_RE.search(tag):
            continue
        type_m = _TYPE_RE.search(tag)
        href_m = _HREF_RE.search(tag)
        if not type_m or not href_m:
            continue
        ft = _feed_type(type_m.group(1))
        if not ft:
            continue
        url = urljoin(base_url, href_m.group(1))
        if url in seen:
            continue
        seen.add(url)
        title_m = _TITLE_RE.search(tag)
        found.append({
            "url": url,
            "type": ft,
            "title": title_m.group(1) if title_m else None,
        })
    return found


def discover_feeds(domain: str, *, timeout: int = 10) -> list[dict]:
    """Return [{url, type, title}, ...] for feeds discovered on the domain."""
    base = domain if domain.startswith("http") else f"https://{domain}"
    headers = {"User-Agent": USER_AGENT}

    try:
        resp = requests.get(base, headers=headers, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        found = extract_links_from_html(resp.text, resp.url)
    except requests.exceptions.RequestException as exc:
        logger.warning("discover %s: HTML fetch failed: %s", base, exc)
        found = []

    if found:
        return found

    # Fallback: probe common feed paths
    for path in COMMON_PATHS:
        probe = urljoin(base, path)
        try:
            r = requests.get(probe, headers=headers, timeout=5, allow_redirects=True)
        except requests.exceptions.RequestException:
            continue
        if r.status_code != 200:
            continue
        ctype = (r.headers.get("content-type") or "").lower()
        body_start = r.text.lstrip()[:200].lower()
        if "xml" in ctype or body_start.startswith("<?xml") or "<rss" in body_start or "<feed" in body_start:
            return [{"url": r.url, "type": "atom" if "atom" in body_start else "rss", "title": None}]

    return []
