"""Fast pipeline — RSS ingest + Jaccard match. No LLM calls.

Runs every 5 min (default crontab). Keeps the live feed fresh; the heavier
Claude clustering + article generation runs in main_full.
"""
from __future__ import annotations

import logging
import sys

import db
import settings
from keyword_match import best_match, tokenize
from relevance import make_filter
from rss import collect_all
from scoring import compute as compute_score

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("bot.main_fast")

JACCARD_THRESHOLD = 0.7


def _cluster_token_bags(actives: list[dict]) -> dict[int, set[str]]:
    bags: dict[int, set[str]] = {}
    for c in actives:
        toks = tokenize(c["headline"])
        for it in c.get("items") or []:
            toks |= tokenize(it["title"])
        bags[c["id"]] = toks
    return bags


def main() -> int:
    settings.require_runtime_env()
    project = db.get_project(settings.PROJECT_SLUG)
    project_id = project["id"]

    run_id = db.start_bot_run(project_id, "fast")
    errors: list[dict] = []
    items_added = 0
    touched: set[int] = set()
    matched = 0

    try:
        sources = db.get_sources(project_id)
        keywords = db.get_keywords(project_id)
        is_relevant = make_filter(keywords)

        raw = collect_all(sources, project_id, project["max_news_age_hours"], is_relevant)
        existing = db.existing_item_urls(project_id, [r["url"] for r in raw])
        fresh = [r for r in raw if r["url"] not in existing]
        items_added = db.insert_items(fresh)

        unclustered = db.unclustered_items(project_id, limit=200)
        bags = _cluster_token_bags(db.active_clusters_with_items(project_id)) if unclustered else {}

        for item in unclustered:
            toks = tokenize(item["title"])
            m = best_match(toks, bags, threshold=JACCARD_THRESHOLD)
            if not m:
                continue
            cid, score = m
            db.assign_items_to_cluster([item["id"]], cid)
            bags[cid] |= toks
            touched.add(cid)
            matched += 1
            logger.info("  jaccard: item %d → cluster %d (%.2f)", item["id"], cid, score)

        for cid in touched:
            db.refresh_cluster_stats(cid)

        if touched:
            actives = db.active_clusters_with_items(project_id)
            scores = {c["id"]: compute_score(c["source_count"], c["last_source_added_at"]) for c in actives}
            db.update_cluster_scores(scores)

        db.finish_bot_run(
            run_id,
            items_added=items_added,
            clusters_updated=len(touched),
            articles_created=0,
            status="success",
        )
        logger.info(
            "fast done: items_added=%d matched=%d clusters_touched=%d",
            items_added, matched, len(touched),
        )
        return 0
    except Exception as exc:
        logger.exception("fast run failed")
        errors.append({"error": str(exc), "at": "main"})
        db.finish_bot_run(
            run_id, items_added=items_added,
            clusters_updated=len(touched), articles_created=0,
            errors=errors, status="failed",
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
