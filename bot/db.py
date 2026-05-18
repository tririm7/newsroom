"""Postgres helpers for the bot.

Connection per call (cron-driven, short-lived). All queries scoped by
project_id so the same code runs unchanged when Layer 2 SaaS multi-tenant
arrives. In Newsroom Open project_id is always 1.
"""
from __future__ import annotations

import contextlib
import json
import logging
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

import settings

logger = logging.getLogger(__name__)


@contextlib.contextmanager
def conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(settings.DATABASE_URL, row_factory=dict_row) as c:
        yield c


# ---------- project / sources / keywords ----------


def get_project(slug: str) -> dict[str, Any]:
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT * FROM projects WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"project not found: slug={slug}")
        return dict(row)


def get_sources(project_id: int, active_only: bool = True) -> list[dict]:
    sql = "SELECT * FROM sources WHERE project_id = %s"
    params: list[Any] = [project_id]
    if active_only:
        sql += " AND is_active = TRUE"
    sql += " ORDER BY id"
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, tuple(params))
        return [dict(r) for r in cur.fetchall()]


def get_keywords(project_id: int, active_only: bool = True) -> list[dict]:
    sql = "SELECT * FROM keywords WHERE project_id = %s"
    params: list[Any] = [project_id]
    if active_only:
        sql += " AND is_active = TRUE"
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, tuple(params))
        return [dict(r) for r in cur.fetchall()]


# ---------- items ----------


def existing_item_urls(project_id: int, urls: list[str]) -> set[str]:
    if not urls:
        return set()
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT url FROM items WHERE project_id = %s AND url = ANY(%s)",
            (project_id, urls),
        )
        return {r["url"] for r in cur.fetchall()}


def insert_items(items: list[dict]) -> int:
    if not items:
        return 0
    with conn() as c, c.cursor() as cur:
        for it in items:
            cur.execute(
                """INSERT INTO items
                     (project_id, source_id, title, url, summary, image_url,
                      language, published_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (project_id, url) DO NOTHING""",
                (
                    it["project_id"], it["source_id"], it["title"], it["url"],
                    it.get("summary"), it.get("image_url"),
                    it.get("language"), it["published_at"],
                ),
            )
        c.commit()
    return len(items)


def unclustered_items(project_id: int, limit: int = 200) -> list[dict]:
    """Recent items without a cluster and not skipped — candidates for matching."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """SELECT id, source_id, title, summary, url, language, published_at
                 FROM items
                WHERE project_id = %s
                  AND cluster_id IS NULL
                  AND skipped_at IS NULL
                ORDER BY published_at DESC
                LIMIT %s""",
            (project_id, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def assign_items_to_cluster(item_ids: list[int], cluster_id: int) -> None:
    if not item_ids:
        return
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "UPDATE items SET cluster_id = %s WHERE id = ANY(%s)",
            (cluster_id, item_ids),
        )
        c.commit()


def mark_items_skipped(item_ids: list[int], reason: str = "off-topic") -> None:
    if not item_ids:
        return
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "UPDATE items SET skipped_at = now(), skipped_reason = %s WHERE id = ANY(%s)",
            (reason, item_ids),
        )
        c.commit()


# ---------- clusters ----------


def active_clusters_with_items(project_id: int) -> list[dict]:
    """Active clusters with their member-item titles (for prompt context)."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """SELECT c.id, c.headline, c.description, c.source_count, c.last_source_added_at,
                      COALESCE(
                        json_agg(json_build_object('id', i.id, 'title', i.title))
                          FILTER (WHERE i.id IS NOT NULL),
                        '[]'::json
                      ) AS items
                 FROM clusters c
                 LEFT JOIN items i ON i.cluster_id = c.id
                WHERE c.project_id = %s AND c.is_active
                GROUP BY c.id
                ORDER BY c.score DESC""",
            (project_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def active_cluster_ids(project_id: int) -> set[int]:
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT id FROM clusters WHERE project_id = %s AND is_active",
            (project_id,),
        )
        return {r["id"] for r in cur.fetchall()}


def create_cluster(project_id: int, headline: str, description: str | None) -> int:
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """INSERT INTO clusters (project_id, headline, description, source_count)
               VALUES (%s, %s, %s, 0) RETURNING id""",
            (project_id, headline, description),
        )
        cid = cur.fetchone()["id"]
        c.commit()
        return cid


def refresh_cluster_stats(cluster_id: int) -> None:
    """Recount distinct sources for cluster, refresh last_source_added_at."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """UPDATE clusters SET
                  source_count = sub.cnt,
                  last_source_added_at = sub.last_at
               FROM (
                  SELECT COUNT(DISTINCT source_id) AS cnt,
                         MAX(published_at) AS last_at
                    FROM items WHERE cluster_id = %s
               ) sub
               WHERE id = %s""",
            (cluster_id, cluster_id),
        )
        c.commit()


def update_cluster_scores(scores: dict[int, float]) -> None:
    if not scores:
        return
    with conn() as c, c.cursor() as cur:
        for cid, score in scores.items():
            cur.execute(
                """UPDATE clusters SET
                      previous_score = score, score = %s
                   WHERE id = %s""",
                (score, cid),
            )
        c.commit()


def deactivate_stale_clusters(project_id: int, hours: int) -> int:
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """UPDATE clusters SET
                  is_active = FALSE,
                  deactivated_at = now(),
                  deactivated_reason = 'stale'
               WHERE project_id = %s
                 AND is_active
                 AND last_source_added_at < now() - make_interval(hours => %s)""",
            (project_id, hours),
        )
        n = cur.rowcount
        c.commit()
        return n


def clusters_needing_article(project_id: int, min_sources: int) -> list[dict]:
    """Active clusters with ≥ min_sources and no article yet, with their items."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """SELECT c.id, c.headline, c.description, c.source_count,
                      json_agg(json_build_object(
                          'id', i.id,
                          'title', i.title,
                          'summary', i.summary,
                          'url', i.url,
                          'source_name', s.name
                      ) ORDER BY i.published_at DESC) AS items
                 FROM clusters c
                 JOIN items i ON i.cluster_id = c.id
                 JOIN sources s ON s.id = i.source_id
                LEFT JOIN articles a ON a.cluster_id = c.id
                WHERE c.project_id = %s
                  AND c.is_active
                  AND c.source_count >= %s
                  AND a.id IS NULL
                GROUP BY c.id
                ORDER BY c.score DESC""",
            (project_id, min_sources),
        )
        return [dict(r) for r in cur.fetchall()]


# ---------- articles ----------


def save_article(
    project_id: int,
    cluster_id: int,
    slug: str,
    title: str,
    excerpt: str | None,
    content_html: str,
    language: str,
) -> int:
    """Insert article. Returns id or 0 on slug-conflict (treated as race)."""
    with conn() as c, c.cursor() as cur:
        try:
            cur.execute(
                """INSERT INTO articles
                     (project_id, cluster_id, slug, title, excerpt, content_html,
                      language, status, published_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, 'published', now())
                   RETURNING id""",
                (project_id, cluster_id, slug, title, excerpt, content_html, language),
            )
            aid = cur.fetchone()["id"]
            c.commit()
            return aid
        except psycopg.errors.UniqueViolation:
            c.rollback()
            return 0


# ---------- bot_runs (telemetry) ----------


def start_bot_run(project_id: int, run_type: str) -> int:
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """INSERT INTO bot_runs (project_id, type, started_at, status)
               VALUES (%s, %s, now(), 'running') RETURNING id""",
            (project_id, run_type),
        )
        rid = cur.fetchone()["id"]
        c.commit()
        return rid


def finish_bot_run(
    run_id: int,
    *,
    items_added: int = 0,
    clusters_updated: int = 0,
    articles_created: int = 0,
    errors: list[dict] | None = None,
    status: str = "success",
) -> None:
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """UPDATE bot_runs SET
                  finished_at = now(),
                  items_added = %s,
                  clusters_updated = %s,
                  articles_created = %s,
                  errors = %s::jsonb,
                  status = %s
               WHERE id = %s""",
            (items_added, clusters_updated, articles_created,
             json.dumps(errors or []), status, run_id),
        )
        c.commit()
