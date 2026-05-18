import type { MetadataRoute } from "next";

import { getCurrentProject } from "@/lib/project";

// Rendered per-request: DB isn't reachable at `next build` time.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const project = await getCurrentProject();
  const base = project.domain === "localhost"
    ? "http://localhost"
    : `https://${project.domain}`;
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${base}/sitemap.xml`,
  };
}
