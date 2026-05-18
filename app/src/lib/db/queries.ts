import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "./client";
import { articles, clusters, items, projects, sources, staticPages } from "./schema";

export type FeedCluster = {
  id: number;
  headline: string;
  description: string | null;
  sourceCount: number;
  lastSourceAddedAt: Date;
  articleSlug: string | null;
  topItems: { title: string; sourceName: string; url: string }[];
};

export type ArchiveItem = {
  id: number;
  slug: string;
  title: string;
  publishedAt: Date;
};

export type FooterPage = { slug: string; title: string; footerPosition: number };

export async function getProjectBySlug(slug: string) {
  const rows = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function listActiveClustersForFeed(
  projectId: number,
  limit = 50,
): Promise<FeedCluster[]> {
  const rows = await db.execute<{
    id: number;
    headline: string;
    description: string | null;
    source_count: number;
    last_source_added_at: Date;
    article_slug: string | null;
    top_items: { title: string; source_name: string; url: string }[];
  }>(sql`
    SELECT c.id,
           c.headline,
           c.description,
           c.source_count,
           c.last_source_added_at,
           a.slug AS article_slug,
           COALESCE(
             (
               SELECT json_agg(
                        json_build_object('title', i2.title, 'source_name', s2.name, 'url', i2.url)
                        ORDER BY i2.published_at DESC
                      )
                 FROM (
                   SELECT id, title, url, source_id, published_at
                     FROM items
                    WHERE cluster_id = c.id
                    ORDER BY published_at DESC
                    LIMIT 5
                 ) i2
                 JOIN sources s2 ON s2.id = i2.source_id
             ),
             '[]'::json
           ) AS top_items
      FROM clusters c
      LEFT JOIN articles a ON a.cluster_id = c.id AND a.status = 'published'
     WHERE c.project_id = ${projectId} AND c.is_active = TRUE
     ORDER BY c.score DESC NULLS LAST, c.last_source_added_at DESC
     LIMIT ${limit}
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    headline: r.headline,
    description: r.description,
    sourceCount: Number(r.source_count),
    lastSourceAddedAt: new Date(r.last_source_added_at),
    articleSlug: r.article_slug,
    topItems: (r.top_items ?? []).map((it) => ({
      title: it.title,
      sourceName: it.source_name,
      url: it.url,
    })),
  }));
}

export async function getArticleBySlug(projectId: number, slug: string) {
  const rows = await db
    .select()
    .from(articles)
    .where(and(
      eq(articles.projectId, projectId),
      eq(articles.slug, slug),
      eq(articles.status, "published"),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPublishedArticles(
  projectId: number,
  limit = 100,
): Promise<ArchiveItem[]> {
  const rows = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(and(
      eq(articles.projectId, projectId),
      eq(articles.status, "published"),
    ))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
  return rows
    .filter((r): r is ArchiveItem => r.publishedAt !== null)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      publishedAt: r.publishedAt!,
    }));
}

export async function getStaticPage(projectId: number, locale: string, slug: string) {
  const rows = await db
    .select()
    .from(staticPages)
    .where(and(
      eq(staticPages.projectId, projectId),
      eq(staticPages.locale, locale),
      eq(staticPages.slug, slug),
      eq(staticPages.isPublished, true),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function listFooterPages(projectId: number, locale: string): Promise<FooterPage[]> {
  const rows = await db
    .select({
      slug: staticPages.slug,
      title: staticPages.title,
      footerPosition: staticPages.footerPosition,
    })
    .from(staticPages)
    .where(and(
      eq(staticPages.projectId, projectId),
      eq(staticPages.locale, locale),
      eq(staticPages.isPublished, true),
    ));
  return rows
    .filter((r): r is FooterPage => r.footerPosition !== null)
    .sort((a, b) => a.footerPosition - b.footerPosition);
}
