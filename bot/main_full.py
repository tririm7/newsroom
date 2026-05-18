"""Full pipeline — fast + LLM clustering for leftovers + article generation.

Runs every 30 min (default crontab). RSS sweep → Jaccard match → LLM
clustering for items Jaccard missed → article writing for clusters that
reached article_min_sources → stale cluster cleanup.

Provider config is loaded from the `projects` row at the start of every
run (admin changes take effect on the next cron tick — no container
restart needed). Env LLM_API_KEY is used only as a fallback when the DB
column is empty (fresh install).
"""
from __future__ import annotations

import logging
import sys

import db
import llm
import settings
from article_writer import write_article
from clustering import cluster_new_items
from keyword_match import best_match, tokenize
from relevance import make_filter
from rss import collect_all
from scoring import compute as compute_score

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("bot.main_full")

JACCARD_THRESHOLD = 0.7
CLUSTER_BATCH_MAX = 40  # cap items sent to LLM per run (cost control)


def _apply_groups(
    project_id: int,
    groups: list[dict],
    known_cluster_ids: set[int],
) -> tuple[int, int]:
    """Returns (touched_count, skipped_off_topic_count)."""
    touched: set[int] = set()
    skipped = 0
    for g in groups:
        item_ids = [int(i) for i in (g.get("item_ids") or [])]
        if not item_ids:
            continue
        if g.get("skip"):
            db.mark_items_skipped(item_ids, reason="off-topic")
            skipped += len(item_ids)
            continue
        cid = g.get("cluster_id")
        if cid is not None:
            if int(cid) not in known_cluster_ids:
                logger.warning("LLM hallucinated cluster_id=%s — treating as NEW", cid)
                cid = None
            else:
                cid = int(cid)
        if cid is None:
            headline = (g.get("headline") or "").strip()
            if not headline:
                logger.warning("new cluster without headline; skipping ids=%s", item_ids)
                continue
            description = (g.get("description") or "").strip() or None
            cid = db.create_cluster(
                project_id,
                headline=headline[:200],
                description=description[:500] if description else None,
            )
        db.assign_items_to_cluster(item_ids, cid)
        db.refresh_cluster_stats(cid)
        touched.add(cid)
    return len(touched), skipped


def main() -> int:
    settings.require_runtime_env()
    project = db.get_project(settings.PROJECT_SLUG)
    project_id = project["id"]
    language = project["primary_locale"]

    # DB is the source of truth for LLM config (admin /admin/settings writes
    # here). Env LLM_API_KEY is the fallback for fresh installs.
    llm_config = llm.from_project(project)
    logger.info(
        "LLM: provider=%s model=%s", llm_config.provider, llm_config.model,
    )

    run_id = db.start_bot_run(project_id, "full")
    errors: list[dict] = []
    items_added = 0
    clusters_touched_total = 0
    articles_created = 0

    try:
        sources = db.get_sources(project_id)
        keywords = db.get_keywords(project_id)
        is_relevant = make_filter(keywords)

        # 1) RSS ingest
        raw = collect_all(sources, project_id, project["max_news_age_hours"], is_relevant)
        existing = db.existing_item_urls(project_id, [r["url"] for r in raw])
        fresh = [r for r in raw if r["url"] not in existing]
        items_added = db.insert_items(fresh)

        # 2) Jaccard pass over unclustered items
        unclustered = db.unclustered_items(project_id, limit=200)
        actives = db.active_clusters_with_items(project_id)
        bags: dict[int, set[str]] = {}
        for c in actives:
            toks = tokenize(c["headline"])
            for it in c.get("items") or []:
                toks |= tokenize(it["title"])
            bags[c["id"]] = toks

        leftover: list[dict] = []
        jaccard_touched: set[int] = set()
        for item in unclustered:
            toks = tokenize(item["title"])
            m = best_match(toks, bags, threshold=JACCARD_THRESHOLD)
            if not m:
                leftover.append(item)
                continue
            cid, score = m
            db.assign_items_to_cluster([item["id"]], cid)
            bags[cid] |= toks
            jaccard_touched.add(cid)
            logger.info("  jaccard: item %d → cluster %d (%.2f)", item["id"], cid, score)
        for cid in jaccard_touched:
            db.refresh_cluster_stats(cid)
        clusters_touched_total += len(jaccard_touched)

        # 3) LLM clustering for leftover
        if leftover:
            sources_by_id = {s["id"]: s for s in sources}
            known = db.active_cluster_ids(project_id)
            try:
                data = cluster_new_items(
                    language=language,
                    new_items=leftover[:CLUSTER_BATCH_MAX],
                    active_clusters=actives,
                    sources_by_id=sources_by_id,
                    llm_config=llm_config,
                )
                touched, skipped = _apply_groups(project_id, data.get("groups", []), known)
                clusters_touched_total += touched
                logger.info("LLM clustering: touched=%d off_topic=%d", touched, skipped)
            except Exception as exc:
                logger.exception("LLM clustering failed; leftover items stay unclustered")
                errors.append({"step": "clustering", "error": str(exc)})

        # 4) Score recompute
        actives = db.active_clusters_with_items(project_id)
        scores = {c["id"]: compute_score(c["source_count"], c["last_source_added_at"]) for c in actives}
        db.update_cluster_scores(scores)

        # 5) Deactivate stale clusters
        stale = db.deactivate_stale_clusters(project_id, project["cluster_inactivity_hours"])
        if stale:
            logger.info("deactivated stale clusters: %d", stale)

        # 6) Article generation
        needing = db.clusters_needing_article(project_id, project["article_min_sources"])
        logger.info("clusters needing article: %d", len(needing))
        for c in needing:
            try:
                if write_article(project_id, language, c, llm_config=llm_config):
                    articles_created += 1
            except Exception as exc:
                logger.exception("article gen failed for cluster %s", c["id"])
                errors.append({"step": "write_article", "cluster_id": c["id"], "error": str(exc)})

        db.finish_bot_run(
            run_id,
            items_added=items_added,
            clusters_updated=clusters_touched_total,
            articles_created=articles_created,
            errors=errors,
            status="success",  # partial errors are non-fatal
        )
        logger.info(
            "full done: items=%d clusters_touched=%d articles=%d errors=%d",
            items_added, clusters_touched_total, articles_created, len(errors),
        )
        return 0
    except Exception as exc:
        logger.exception("full run failed")
        errors.append({"error": str(exc), "at": "main"})
        db.finish_bot_run(
            run_id, items_added=items_added,
            clusters_updated=clusters_touched_total,
            articles_created=articles_created,
            errors=errors, status="failed",
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
