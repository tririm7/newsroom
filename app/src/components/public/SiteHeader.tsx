import Link from "next/link";

import type { Project } from "@/lib/db/schema";

export function SiteHeader({ project, locale, t }: {
  project: Project;
  locale: string;
  t: { feed: string; articles: string; about: string };
}) {
  return (
    <header className="border-b border-[var(--divider)]">
      <div className="max-w-3xl mx-auto px-5 pt-6 pb-4 flex items-baseline justify-between gap-4">
        <Link href={`/${locale}`} className="inline-flex items-baseline gap-1 no-underline">
          <span className="font-semibold tracking-tight text-2xl">
            {project.brandName}
          </span>
          <span
            className="text-white text-xs px-1.5 py-0.5 font-semibold uppercase"
            style={{ backgroundColor: project.brandColor }}
          >
            {project.brandSuffix}
          </span>
        </Link>
      </div>
      <nav className="max-w-3xl mx-auto px-5 pb-3 flex gap-5 text-sm uppercase tracking-wide">
        <Link href={`/${locale}`}>{t.feed}</Link>
        <Link href={`/${locale}/articles`}>{t.articles}</Link>
        <Link href={`/${locale}/about`}>{t.about}</Link>
      </nav>
    </header>
  );
}
