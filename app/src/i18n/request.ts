import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

import { SUPPORTED_LOCALES } from "@/lib/project";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  if (!locale || !(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    notFound();
  }
  return {
    locale: locale as string,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
