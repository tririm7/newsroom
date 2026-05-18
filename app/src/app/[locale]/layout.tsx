import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader } from "@/components/public/SiteHeader";
import { listFooterPages } from "@/lib/db/queries";
import { getCurrentProject, isSupportedLocale } from "@/lib/project";

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const project = await getCurrentProject();
  return {
    title: project.name,
    description: project.description ?? undefined,
    themeColor: project.brandColor,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);

  const project = await getCurrentProject();
  const messages = await getMessages();
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tFooter = await getTranslations({ locale, namespace: "footer" });
  const footerPages = await listFooterPages(project.id, locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div
        lang={locale}
        style={{ ["--brand-accent" as string]: project.brandColor }}
        className="min-h-screen flex flex-col"
      >
        <SiteHeader
          project={project}
          locale={locale}
          t={{ feed: tNav("feed"), articles: tNav("articles"), about: tNav("about") }}
        />
        <main className="flex-1 max-w-3xl mx-auto px-5 py-8 w-full">{children}</main>
        <SiteFooter
          project={project}
          locale={locale}
          footerPages={footerPages}
          madeWithLabel={tFooter("made_with")}
        />
      </div>
    </NextIntlClientProvider>
  );
}
