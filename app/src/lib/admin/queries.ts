/**
 * Admin-only DB helpers. Auth check is at the API-route boundary; these
 * functions assume the caller is authenticated.
 */
import { hash } from "bcryptjs";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../db/client";
import { articles, botRuns, clusters, items, keywords, projects, sources, staticPages, users } from "../db/schema";

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

// ---------- keywords ----------

export async function listAllKeywords(projectId: number) {
  return db
    .select()
    .from(keywords)
    .where(eq(keywords.projectId, projectId))
    .orderBy(keywords.category, keywords.id);
}

export async function createKeyword(projectId: number, data: {
  pattern: string; category: string; isRegex: boolean; isActive: boolean;
}) {
  const rows = await db
    .insert(keywords)
    .values({ ...data, projectId })
    .returning({ id: keywords.id });
  return rows[0]?.id ?? null;
}

export async function updateKeyword(projectId: number, id: number, patch: Partial<{
  pattern: string; category: string; isRegex: boolean; isActive: boolean;
}>) {
  await db
    .update(keywords)
    .set(patch)
    .where(and(eq(keywords.projectId, projectId), eq(keywords.id, id)));
}

export async function deleteKeyword(projectId: number, id: number) {
  await db
    .delete(keywords)
    .where(and(eq(keywords.projectId, projectId), eq(keywords.id, id)));
}

// ---------- clusters ----------

export async function listClustersForAdmin(projectId: number, limit = 200) {
  const rows = await db.execute<{
    id: number;
    headline: string;
    description: string | null;
    source_count: number;
    score: number;
    is_active: boolean;
    last_source_added_at: Date;
    article_id: number | null;
    article_slug: string | null;
  }>(sql`
    SELECT c.id, c.headline, c.description, c.source_count, c.score,
           c.is_active, c.last_source_added_at,
           a.id AS article_id, a.slug AS article_slug
      FROM clusters c
      LEFT JOIN articles a ON a.cluster_id = c.id AND a.status = 'published'
     WHERE c.project_id = ${projectId}
     ORDER BY c.is_active DESC, c.score DESC NULLS LAST, c.last_source_added_at DESC
     LIMIT ${limit}
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    headline: r.headline,
    description: r.description,
    sourceCount: Number(r.source_count),
    score: Number(r.score),
    isActive: r.is_active,
    lastSourceAddedAt: new Date(r.last_source_added_at),
    articleId: r.article_id ? Number(r.article_id) : null,
    articleSlug: r.article_slug,
  }));
}

export async function deactivateCluster(projectId: number, id: number) {
  await db
    .update(clusters)
    .set({ isActive: false })
    .where(and(eq(clusters.projectId, projectId), eq(clusters.id, id)));
}

export async function reactivateCluster(projectId: number, id: number) {
  await db
    .update(clusters)
    .set({ isActive: true })
    .where(and(eq(clusters.projectId, projectId), eq(clusters.id, id)));
}

// ---------- static_pages ----------

export async function listAllStaticPages(projectId: number) {
  return db
    .select()
    .from(staticPages)
    .where(eq(staticPages.projectId, projectId))
    .orderBy(staticPages.locale, staticPages.slug);
}

export async function getStaticPageByIdForAdmin(projectId: number, id: number) {
  const rows = await db
    .select()
    .from(staticPages)
    .where(and(eq(staticPages.projectId, projectId), eq(staticPages.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createStaticPage(projectId: number, data: {
  slug: string; title: string; contentMarkdown: string; contentHtml: string;
  isPublished: boolean; footerPosition: number | null; locale: string;
}) {
  const rows = await db
    .insert(staticPages)
    .values({ ...data, projectId })
    .returning({ id: staticPages.id });
  return rows[0]?.id ?? null;
}

export async function updateStaticPage(projectId: number, id: number, patch: Partial<{
  slug: string; title: string; contentMarkdown: string; contentHtml: string;
  isPublished: boolean; footerPosition: number | null; locale: string;
}>) {
  await db
    .update(staticPages)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(staticPages.projectId, projectId), eq(staticPages.id, id)));
}

export async function deleteStaticPage(projectId: number, id: number) {
  await db
    .delete(staticPages)
    .where(and(eq(staticPages.projectId, projectId), eq(staticPages.id, id)));
}

// ---------- article edit ----------

export async function getArticleByIdForAdmin(projectId: number, id: number) {
  const rows = await db
    .select()
    .from(articles)
    .where(and(eq(articles.projectId, projectId), eq(articles.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateArticle(projectId: number, id: number, patch: Partial<{
  title: string; slug: string; excerpt: string | null; contentHtml: string;
  imageUrl: string | null; status: string;
}>) {
  await db
    .update(articles)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(articles.projectId, projectId), eq(articles.id, id)));
}

// ---------- project settings ----------

export async function updateProject(projectId: number, patch: Partial<{
  name: string; description: string | null; brandName: string;
  brandSuffix: string; brandColor: string; brandColorHover: string | null;
  primaryLocale: string; timezone: string;
  autoPublish: boolean; articleMinSources: number;
  maxNewsAgeHours: number; clusterInactivityHours: number;
  ingestionCron: string; generationCron: string;
}>) {
  await db
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

export async function updateProjectLLM(projectId: number, patch: {
  llmProvider: string;
  llmModel: string;
  llmApiKey: string | null;
  llmBaseUrl: string | null;
}) {
  await db
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}
