import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getArticleBySlug } from "@/lib/db/queries";
import { getCurrentProject, isSupportedLocale } from "@/lib/project";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const project = await getCurrentProject();
  const article = await getArticleBySlug(project.id, slug);
  if (!article) return {};
  return {
    title: `${article.title} — ${project.name}`,
    description: article.excerpt ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      type: "article",
      images: article.imageUrl ? [{ url: article.imageUrl }] : undefined,
    },
    twitter: {
      card: article.imageUrl ? "summary_large_image" : "summary",
      title: article.title,
      description: article.excerpt ?? undefined,
    },
  };
}

export default async function ArticlePage({ params }: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);

  const project = await getCurrentProject();
  const article = await getArticleBySlug(project.id, slug);
  if (!article) notFound();

  const t = await getTranslations({ locale, namespace: "article" });

  return (
    <article>
      <Link href={`/${locale}`} className="text-sm text-[var(--meta)] no-underline hover:underline">
        {t("back_to_feed")}
      </Link>
      <h1 className="text-3xl font-semibold leading-tight mt-4 mb-2">{article.title}</h1>
      {article.publishedAt && (
        <time className="block text-sm text-[var(--meta)] mb-6">
          {article.publishedAt.toLocaleString(locale, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </time>
      )}
      <div
        className="prose prose-lg max-w-none [&>p]:mb-4"
        dangerouslySetInnerHTML={{ __html: article.contentHtml }}
      />
    </article>
  );
}
