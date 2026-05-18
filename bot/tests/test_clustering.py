"""Contract tests for clustering — Claude mocked, prompts loaded for real."""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

import clustering


# ---------- prompts ----------


@pytest.mark.parametrize("locale", ["ru", "en", "es"])
def test_clustering_prompt_exists_per_locale(locale):
    p = clustering.PROMPTS_DIR / f"clustering_{locale}.txt"
    assert p.exists(), f"prompt missing: {p}"
    text = p.read_text(encoding="utf-8")
    assert len(text) > 100, f"prompt suspiciously short: {p}"


def test_clustering_prompt_load_unknown_locale_raises():
    with pytest.raises(FileNotFoundError):
        clustering._load_prompt("zz")


# ---------- shape tests with mocked Claude ----------


def _fake_claude(response_json: dict) -> MagicMock:
    """Build a MagicMock Anthropic client returning the given JSON as text."""
    block = SimpleNamespace(type="text", text=json.dumps(response_json))
    response = SimpleNamespace(content=[block])
    client = MagicMock()
    client.messages.create.return_value = response
    return client


def test_cluster_new_items_empty_returns_empty_groups():
    # No new items → no Claude call at all, returns empty.
    result = clustering.cluster_new_items(
        language="en",
        new_items=[],
        active_clusters=[],
        sources_by_id={},
    )
    assert result == {"groups": []}


def test_cluster_new_items_calls_claude_and_returns_groups(monkeypatch):
    canned = {
        "groups": [
            {"item_ids": [101], "headline": "Nvidia revenue hits record", "description": "Earnings beat."},
            {"item_ids": [102], "cluster_id": 7},
            {"item_ids": [103], "skip": True},
        ]
    }
    monkeypatch.setattr(clustering, "_claude", lambda: _fake_claude(canned))

    new_items = [
        {"id": 101, "title": "Nvidia Q3", "summary": "...", "source_id": 1},
        {"id": 102, "title": "Apple iPhone", "summary": "...", "source_id": 2},
        {"id": 103, "title": "Sports gossip", "summary": "...", "source_id": 3},
    ]
    sources_by_id = {1: {"name": "Bloomberg"}, 2: {"name": "WSJ"}, 3: {"name": "ESPN"}}
    active_clusters = [
        {"id": 7, "headline": "Apple iPhone 18 launch", "description": "", "items": []},
    ]

    result = clustering.cluster_new_items(
        language="en",
        new_items=new_items,
        active_clusters=active_clusters,
        sources_by_id=sources_by_id,
    )
    assert result == canned
    assert "groups" in result
    assert len(result["groups"]) == 3


def test_cluster_handles_markdown_fenced_response(monkeypatch):
    # Claude often wraps JSON in ```json ... ``` — should parse OK.
    fenced = '```json\n{"groups": [{"item_ids": [1], "skip": true}]}\n```'
    block = SimpleNamespace(type="text", text=fenced)
    response = SimpleNamespace(content=[block])
    client = MagicMock()
    client.messages.create.return_value = response
    monkeypatch.setattr(clustering, "_claude", lambda: client)

    result = clustering.cluster_new_items(
        language="en",
        new_items=[{"id": 1, "title": "x", "summary": "", "source_id": 1}],
        active_clusters=[],
        sources_by_id={1: {"name": "X"}},
    )
    assert result["groups"][0]["skip"] is True
