"""LLM-driven clustering.

Loads the system prompt from `prompts/clustering_{locale}.txt`. The user
message is a JSON payload with new items + active clusters. The LLM returns
groups describing how items map onto existing clusters, new clusters, or
off-topic skips.

Provider-agnostic: routes through `bot/llm.py`. The `llm_config` kwarg lets
callers (main_full) pass DB-loaded provider config explicitly so admin
changes take effect on the next cron tick without a container restart.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import llm
from jsonparse import parse_lenient

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(language: str) -> str:
    path = PROMPTS_DIR / f"clustering_{language}.txt"
    if not path.exists():
        raise FileNotFoundError(f"clustering prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def _items_for_prompt(items: list[dict], sources_by_id: dict[int, dict]) -> list[dict]:
    return [
        {
            "id": it["id"],
            "title": it["title"],
            "summary": (it.get("summary") or "")[:300],
            "source": sources_by_id.get(it["source_id"], {}).get("name", "?"),
        }
        for it in items
    ]


def _clusters_for_prompt(clusters: list[dict]) -> list[dict]:
    return [
        {
            "id": c["id"],
            "headline": c["headline"],
            "description": c.get("description"),
            "items": [{"title": i["title"]} for i in (c.get("items") or [])[:5]],
        }
        for c in clusters
    ]


def cluster_new_items(
    *,
    language: str,
    new_items: list[dict],
    active_clusters: list[dict],
    sources_by_id: dict[int, dict],
    llm_config: llm.LLMConfig | None = None,
) -> dict:
    """Returns `{"groups": [...]}` where each group is one of:
      - {item_ids: [...], cluster_id: int}                 (attach to existing)
      - {item_ids: [...], headline: str, description: str} (new cluster)
      - {item_ids: [...], skip: true}                      (off-topic)
    """
    if not new_items:
        return {"groups": []}

    system_prompt = _load_prompt(language)
    payload = {
        "new_items": _items_for_prompt(new_items, sources_by_id),
        "active_clusters": _clusters_for_prompt(active_clusters),
    }
    try:
        text = llm.generate(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
            config=llm_config,
            max_tokens=16384,
            temperature=0.7,
        )
    except Exception:
        logger.exception("clustering: LLM call failed")
        raise

    try:
        data = parse_lenient(text)
    except Exception:
        logger.exception("clustering: parse failed; raw=%s", text[:500])
        raise

    groups = data.get("groups") if isinstance(data, dict) else None
    logger.info(
        "clustering: %d items → %d groups (existing_active=%d)",
        len(new_items), len(groups or []), len(active_clusters),
    )
    return data if isinstance(data, dict) else {"groups": []}
