/**
 * Admin-only DB helpers. Auth check is at the API-route boundary; these
 * functions assume the caller is authenticated.
 */
import { hash } from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../db/client";
import { articles, botRuns, clusters, items, sources, users } from "../db/schema";

// ---------- dashboard ----------

export async function getDashboardStats(projectId: number) {
  const [counts] = await db.execute<{
    sources_total: number;
    sources_active: number;
    items_24h: number;
    clusters_active: number;
    articles_total: number;
    articles_24h: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM sources WHERE project_id = ${projectId}) AS sources_total,
      (SELECT count(*)::int FROM sources WHERE project_id = ${projectId} AND is_active) AS sources_active,
      (SELECT count(*)::int FROM items WHERE project_id = ${projectId} AND published_at > now() - interval '24 hours') AS items_24h,
      (SELECT count(*)::int FROM clusters WHERE project_id = ${projectId} AND is_active) AS clusters_active,
      (SELECT count(*)::int FROM articles WHERE project_id = ${projectId} AND status = 'published') AS articles_total,
      (SELECT count(*)::int FROM articles WHERE project_id = ${projectId} AND published_at > now() - interval '24 hours') AS articles_24h
  `);
  return counts ?? {
    sources_total: 0, sources_active: 0,
    items_24h: 0, clusters_active: 0,
    articles_total: 0, articles_24h: 0,
  };
}

export async function getLastBotRun(projectId: number) {
  const rows = await db
    .select()
    .from(botRuns)
    .where(eq(botRuns.projectId, projectId))
    .orderBy(desc(botRuns.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

// ---------- sources ----------

export async function listAllSources(projectId: number) {
  return db
    .select()
    .from(sources)
    .where(eq(sources.projectId, projectId))
    .orderBy(sources.id);
}

export async function createSource(projectId: number, data: {
  name: string; url: string; type: string; language: string; tier: number; isActive: boolean;
}) {
  const rows = await db
    .insert(sources)
    .values({ ...data, projectId })
    .returning({ id: sources.id });
  return rows[0]?.id ?? null;
}

export async function updateSource(projectId: number, id: number, patch: Partial<{
  name: string; url: string; type: string; language: string; tier: number; isActive: boolean;
}>) {
  await db
    .update(sources)
    .set(patch)
    .where(and(eq(sources.projectId, projectId), eq(sources.id, id)));
}

export async function deleteSource(projectId: number, id: number) {
  await db
    .delete(sources)
    .where(and(eq(sources.projectId, projectId), eq(sources.id, id)));
}

// ---------- articles ----------

export async function listAllArticles(projectId: number, limit = 200) {
  return db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      status: articles.status,
      publishedAt: articles.publishedAt,
      isManual: articles.isManual,
      language: articles.language,
    })
    .from(articles)
    .where(eq(articles.projectId, projectId))
    .orderBy(desc(articles.publishedAt), desc(articles.createdAt))
    .limit(limit);
}

export async function toggleArticleStatus(projectId: number, id: number) {
  const rows = await db
    .select({ status: articles.status })
    .from(articles)
    .where(and(eq(articles.projectId, projectId), eq(articles.id, id)))
    .limit(1);
  if (!rows[0]) return null;
  const next = rows[0].status === "published" ? "draft" : "published";
  await db
    .update(articles)
    .set({ status: next, updatedAt: new Date() })
    .where(and(eq(articles.projectId, projectId), eq(articles.id, id)));
  return next;
}

export async function deleteArticle(projectId: number, id: number) {
  await db
    .delete(articles)
    .where(and(eq(articles.projectId, projectId), eq(articles.id, id)));
}

// ---------- users / password ----------

export async function getUserByIdForProject(projectId: number, id: number) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.projectId, projectId), eq(users.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateUserPasswordHash(userId: number, newHash: string) {
  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, userId));
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 12);
}
