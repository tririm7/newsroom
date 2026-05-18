"""Contract tests for article_writer — LLM + DB mocked, prompts real."""
from __future__ import annotations

import json
from unittest.mock import patch

import pytest

import article_writer


# ---------- prompts ----------


@pytest.mark.parametrize("locale", ["ru", "en", "es"])
def test_article_prompt_exists_per_locale(locale):
    p = article_writer.PROMPTS_DIR / f"article_{locale}.txt"
    assert p.exists(), f"prompt missing: {p}"
    text = p.read_text(encoding="utf-8")
    assert len(text) > 100


def test_article_prompt_load_unknown_locale_raises():
    with pytest.raises(FileNotFoundError):
        article_writer._load_prompt("zz")


# ---------- slug sanitizer ----------


def test_sanitize_slug_basic():
    assert article_writer._sanitize_slug("Nvidia Q3 earnings", 5) == "nvidia-q3-earnings"


def test_sanitize_slug_strips_non_alnum():
    assert article_writer._sanitize_slug("OpenAI: GPT-5 Launch!!!", 5) == "openai-gpt-5-launch"


def test_sanitize_slug_truncates_at_60():
    long = "a" * 100
    assert len(article_writer._sanitize_slug(long, 5)) <= 60


def test_sanitize_slug_fallback_when_empty():
    assert article_writer._sanitize_slug("", 42) == "cluster-42"
    assert article_writer._sanitize_slug("!!!", 42) == "cluster-42"


# ---------- contract test with mocked LLM + DB ----------


def test_write_article_no_items_returns_none():
    result = article_writer.write_article(
        project_id=1, language="en",
        cluster={"id": 5, "headline": "X", "items": []},
    )
    assert result is None


def test_write_article_happy_path():
    llm_response = json.dumps({
        "title": "Nvidia hits record revenue",
        "slug": "nvidia-record-revenue",
        "excerpt": "Q3 results crushed expectations.",
        "content_html": "<p>Para 1.</p><p>Para 2.</p>",
    })
    saved = {}

    def fake_save_article(**kwargs):
        saved.update(kwargs)
        return 42  # article_id

    cluster = {
        "id": 5,
        "headline": "Nvidia earnings",
        "description": "Q3 beat",
        "items": [
            {"source_name": "Bloomberg", "title": "Nvidia Q3", "summary": "Beat", "url": "https://x"},
        ],
    }

    with patch.object(article_writer.llm, "generate", return_value=llm_response), \
         patch.object(article_writer.db, "save_article", fake_save_article):
        result = article_writer.write_article(project_id=1, language="en", cluster=cluster)

    assert result is not None
    assert result["id"] == 42
    assert result["slug"] == "nvidia-record-revenue"
    assert saved["project_id"] == 1
    assert saved["cluster_id"] == 5
    assert saved["title"] == "Nvidia hits record revenue"
    assert saved["content_html"] == "<p>Para 1.</p><p>Para 2.</p>"
    assert saved["language"] == "en"


def test_write_article_missing_keys_returns_none():
    # Article writer rejects responses lacking required keys (here: content_html)
    bad_response = json.dumps({"title": "x", "slug": "x", "excerpt": "x"})
    with patch.object(article_writer.llm, "generate", return_value=bad_response):
        result = article_writer.write_article(
            project_id=1, language="en",
            cluster={
                "id": 5, "headline": "X",
                "items": [{"source_name": "s", "title": "t", "summary": "", "url": "u"}],
            },
        )
    assert result is None


def test_write_article_slug_conflict_returns_none():
    ok_response = json.dumps({
        "title": "x", "slug": "x", "excerpt": "x", "content_html": "<p>x</p>",
    })
    with patch.object(article_writer.llm, "generate", return_value=ok_response), \
         patch.object(article_writer.db, "save_article", lambda **kw: 0):  # 0 → slug conflict
        result = article_writer.write_article(
            project_id=1, language="en",
            cluster={
                "id": 5, "headline": "X",
                "items": [{"source_name": "s", "title": "t", "summary": "", "url": "u"}],
            },
        )
    assert result is None


def test_write_article_llm_call_failure_returns_none():
    # If llm.generate raises, write_article logs and returns None (one bad
    # cluster shouldn't crash the whole main_full run).
    with patch.object(article_writer.llm, "generate", side_effect=RuntimeError("boom")):
        result = article_writer.write_article(
            project_id=1, language="en",
            cluster={
                "id": 5, "headline": "X",
                "items": [{"source_name": "s", "title": "t", "summary": "", "url": "u"}],
            },
        )
    assert result is None
