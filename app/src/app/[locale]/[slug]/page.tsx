import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getStaticPage } from "@/lib/db/queries";
import { getCurrentProject, isSupportedLocale } from "@/lib/project";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const project = await getCurrentProject();
  const page = await getStaticPage(project.id, locale, slug);
  if (!page) return {};
  return { title: `${page.title} — ${project.name}` };
}

export default async function StaticPage({ params }: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);

  const project = await getCurrentProject();
  const page = await getStaticPage(project.id, locale, slug);
  if (!page) notFound();

  return (
    <article>
      <h1 className="text-2xl font-semibold mb-4">{page.title}</h1>
      <div
        className="[&>p]:mb-3 [&>h2]:font-semibold [&>h2]:mt-6 [&>h2]:mb-2 [&>ul]:list-disc [&>ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: page.contentHtml }}
      />
    </article>
  );
}
