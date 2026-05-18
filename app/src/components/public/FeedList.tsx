import Link from "next/link";

import type { FeedCluster } from "@/lib/db/queries";

export function FeedList({
  clusters,
  locale,
  emptyLabel,
  sourcesLabel,
  readArticleLabel,
}: {
  clusters: FeedCluster[];
  locale: string;
  emptyLabel: string;
  sourcesLabel: (count: number) => string;
  readArticleLabel: string;
}) {
  if (clusters.length === 0) {
    return <div className="py-16 text-center text-[var(--meta)]">{emptyLabel}</div>;
  }
  return (
    <ul className="divide-y divide-[var(--divider)]">
      {clusters.map((c) => (
        <li key={c.id} className="py-5">
          <article>
            <h2 className="font-semibold text-lg leading-snug mb-1">{c.headline}</h2>
            {c.description && (
              <p className="text-[var(--meta)] mb-2 leading-snug">{c.description}</p>
            )}
            {c.topItems.length > 0 && (
              <p className="text-sm text-[var(--meta)] mb-2">
                <span className="font-medium">{sourcesLabel(c.sourceCount)}</span>
                {": "}
                {c.topItems.map((it, i) => (
                  <span key={it.url}>
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={it.title}
                      className="no-underline hover:underline"
                    >
                      {it.sourceName}
                    </a>
                    {i < c.topItems.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            )}
            {c.articleSlug && (
              <Link
                href={`/${locale}/article/${c.articleSlug}`}
                className="text-sm uppercase tracking-wide no-underline hover:underline"
                style={{ color: "var(--brand-accent)" }}
              >
                {readArticleLabel}
              </Link>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}
