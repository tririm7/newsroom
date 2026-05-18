"""RSS parsing test — HTTP stubbed via monkeypatch, real feedparser."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import rss


SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com/</link>
    <description>Test</description>
    <item>
      <title>Nvidia hits record revenue</title>
      <link>https://example.com/news/nvidia-record</link>
      <description>Q3 beat expectations.</description>
      <pubDate>{pub_recent}</pubDate>
    </item>
    <item>
      <title>Old news that should be filtered</title>
      <link>https://example.com/news/old</link>
      <description>From way back.</description>
      <pubDate>Tue, 01 Jan 2020 12:00:00 +0000</pubDate>
    </item>
    <item>
      <title>Sports gossip</title>
      <link>https://example.com/news/sports</link>
      <description>Some team won.</description>
      <pubDate>{pub_recent}</pubDate>
    </item>
  </channel>
</rss>
"""


def _make_response(body: bytes) -> SimpleNamespace:
    return SimpleNamespace(
        content=body,
        raise_for_status=lambda: None,
    )


@pytest.fixture
def stub_get(monkeypatch):
    """Replace requests.get inside rss.py to return our sample RSS."""
    recent_date = (datetime.now(timezone.utc) - timedelta(hours=2)).strftime("%a, %d %b %Y %H:%M:%S +0000")
    body = SAMPLE_RSS.format(pub_recent=recent_date).encode("utf-8")
    monkeypatch.setattr(rss.requests, "get", lambda *a, **kw: _make_response(body))


def test_parse_feed_returns_recent_items(stub_get):
    source = {"id": 1, "name": "Test", "url": "https://example.com/feed", "language": "en"}
    items = rss.parse_feed(source, max_age_hours=24, is_relevant=lambda *t: True, project_id=1)
    # 2 recent items pass (old one is past cutoff)
    assert len(items) == 2
    titles = {i["title"] for i in items}
    assert "Nvidia hits record revenue" in titles
    assert "Sports gossip" in titles


def test_parse_feed_applies_relevance_filter(stub_get):
    source = {"id": 1, "name": "Test", "url": "https://example.com/feed", "language": "en"}
    # Filter accepts only Nvidia-mentioning items
    items = rss.parse_feed(
        source, max_age_hours=24,
        is_relevant=lambda *texts: any("nvidia" in (t or "").lower() for t in texts),
        project_id=1,
    )
    assert len(items) == 1
    assert items[0]["title"] == "Nvidia hits record revenue"


def test_parse_feed_drops_items_older_than_cutoff(stub_get):
    source = {"id": 1, "name": "Test", "url": "https://example.com/feed", "language": "en"}
    items = rss.parse_feed(source, max_age_hours=24, is_relevant=lambda *t: True, project_id=1)
    # The 2020 item must be excluded
    assert all(i["url"] != "https://example.com/news/old" for i in items)


def test_parse_feed_item_shape(stub_get):
    source = {"id": 7, "name": "Test", "url": "https://example.com/feed", "language": "en"}
    items = rss.parse_feed(source, max_age_hours=24, is_relevant=lambda *t: True, project_id=42)
    it = items[0]
    assert it["project_id"] == 42
    assert it["source_id"] == 7
    assert it["language"] == "en"
    assert isinstance(it["published_at"], datetime)
    assert it["url"].startswith("https://")


def test_parse_feed_handles_http_error(monkeypatch):
    def boom(*a, **kw):
        raise rss.requests.exceptions.Timeout("simulated")
    monkeypatch.setattr(rss.requests, "get", boom)
    source = {"id": 1, "name": "T", "url": "https://x/feed", "language": "en"}
    items = rss.parse_feed(source, max_age_hours=24, is_relevant=lambda *t: True, project_id=1)
    assert items == []


def test_strip_html_removes_tags_and_collapses_whitespace():
    assert rss._strip_html("<p>Hello <b>world</b>.</p>\n\n\n") == "Hello world."


def test_strip_html_unescapes_entities():
    assert rss._strip_html("AT&amp;T &quot;deal&quot;") == 'AT&T "deal"'
