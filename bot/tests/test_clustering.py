"""Contract tests for clustering — LLM mocked, prompts loaded for real."""
from __future__ import annotations

import json
from unittest.mock import patch

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


# ---------- shape tests with mocked llm.generate ----------


def test_cluster_new_items_empty_returns_empty_groups():
    # No new items → no LLM call at all, returns empty.
    result = clustering.cluster_new_items(
        language="en",
        new_items=[],
        active_clusters=[],
        sources_by_id={},
    )
    assert result == {"groups": []}


def test_cluster_new_items_calls_llm_with_messages_and_returns_groups():
    canned = {
        "groups": [
            {"item_ids": [101], "headline": "Nvidia revenue hits record", "description": "Earnings beat."},
            {"item_ids": [102], "cluster_id": 7},
            {"item_ids": [103], "skip": True},
        ]
    }

    new_items = [
        {"id": 101, "title": "Nvidia Q3", "summary": "...", "source_id": 1},
        {"id": 102, "title": "Apple iPhone", "summary": "...", "source_id": 2},
        {"id": 103, "title": "Sports gossip", "summary": "...", "source_id": 3},
    ]
    sources_by_id = {1: {"name": "Bloomberg"}, 2: {"name": "WSJ"}, 3: {"name": "ESPN"}}
    active_clusters = [
        {"id": 7, "headline": "Apple iPhone 18 launch", "description": "", "items": []},
    ]

    with patch.object(clustering.llm, "generate", return_value=json.dumps(canned)) as mock_gen:
        result = clustering.cluster_new_items(
            language="en",
            new_items=new_items,
            active_clusters=active_clusters,
            sources_by_id=sources_by_id,
        )

    assert result == canned
    assert len(result["groups"]) == 3

    # Verify messages shape: system + user with JSON payload
    call_kwargs = mock_gen.call_args.kwargs
    messages = call_kwargs["messages"]
    assert messages[0]["role"] == "system"
    assert "thematic news feed" in messages[0]["content"].lower()
    assert messages[1]["role"] == "user"
    payload = json.loads(messages[1]["content"])
    assert payload["new_items"][0]["id"] == 101
    assert payload["active_clusters"][0]["id"] == 7


def test_cluster_handles_markdown_fenced_response():
    # LLMs often wrap JSON in ```json ... ``` — parse_lenient handles it.
    fenced = '```json\n{"groups": [{"item_ids": [1], "skip": true}]}\n```'

    with patch.object(clustering.llm, "generate", return_value=fenced):
        result = clustering.cluster_new_items(
            language="en",
            new_items=[{"id": 1, "title": "x", "summary": "", "source_id": 1}],
            active_clusters=[],
            sources_by_id={1: {"name": "X"}},
        )

    assert result["groups"][0]["skip"] is True


def test_cluster_recovers_when_response_is_not_dict():
    # If parse_lenient returns a list/string by mistake, cluster_new_items
    # should fall back to {"groups": []} rather than crashing.
    with patch.object(clustering.llm, "generate", return_value="[]"):
        result = clustering.cluster_new_items(
            language="en",
            new_items=[{"id": 1, "title": "x", "summary": "", "source_id": 1}],
            active_clusters=[],
            sources_by_id={1: {"name": "X"}},
        )
    assert result == {"groups": []}
