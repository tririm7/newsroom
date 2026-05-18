import { getTranslations, setRequestLocale } from "next-intl/server";

import { FeedList } from "@/components/public/FeedList";
import { listActiveClustersForFeed } from "@/lib/db/queries";
import { getCurrentProject, isSupportedLocale } from "@/lib/project";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FeedPage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);

  const project = await getCurrentProject();
  const clusters = await listActiveClustersForFeed(project.id, 50);
  const t = await getTranslations({ locale, namespace: "feed" });

  return (
    <FeedList
      clusters={clusters}
      locale={locale}
      emptyLabel={t("empty")}
      sourcesLabel={(count) => t(count === 1 ? "sources_one" : "sources_other", { count })}
      readArticleLabel={t("read_article")}
    />
  );
}
