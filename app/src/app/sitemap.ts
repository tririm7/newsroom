import type { MetadataRoute } from "next";

import { listPublishedArticles } from "@/lib/db/queries";
import { getCurrentProject } from "@/lib/project";

// Rendered per-request: DB isn't reachable at `next build` time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const project = await getCurrentProject();
  const base = project.domain === "localhost"
    ? "http://localhost"
    : `https://${project.domain}`;
  const locale = project.primaryLocale;

  const articles = await listPublishedArticles(project.id, 1000);

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/${locale}`, changeFrequency: "hourly", priority: 1.0 },
    { url: `${base}/${locale}/articles`, changeFrequency: "daily", priority: 0.8 },
  ];
  for (const a of articles) {
    entries.push({
      url: `${base}/${locale}/article/${a.slug}`,
      lastModified: a.publishedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }
  return entries;
}
