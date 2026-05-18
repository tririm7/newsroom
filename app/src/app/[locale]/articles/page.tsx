import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { listPublishedArticles } from "@/lib/db/queries";
import { getCurrentProject, isSupportedLocale } from "@/lib/project";

export const dynamic = "force-dynamic";

export default async function ArchivePage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);

  const project = await getCurrentProject();
  const articles = await listPublishedArticles(project.id, 200);
  const t = await getTranslations({ locale, namespace: "archive" });

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-2">{t("title")}</h1>
      <div className="text-sm text-[var(--meta)] mb-6">{t("total", { count: articles.length })}</div>

      {articles.length === 0 ? (
        <div className="py-12 text-center text-[var(--meta)]">{t("empty")}</div>
      ) : (
        <ul className="divide-y divide-[var(--divider)]">
          {articles.map((a) => (
            <li key={a.id} className="py-3 flex gap-4 items-baseline">
              <time className="text-sm text-[var(--meta)] min-w-[140px]">
                {a.publishedAt.toLocaleString(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
              <Link href={`/${locale}/article/${a.slug}`} className="font-semibold no-underline hover:underline">
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
