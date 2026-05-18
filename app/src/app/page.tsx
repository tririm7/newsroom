import { redirect } from "next/navigation";

// Middleware redirects / to /<defaultLocale>; this is a defensive fallback
// in case the matcher misses (e.g. odd query strings).
export const dynamic = "force-dynamic";

export default function RootPage() {
  const locale = process.env.PROJECT_DEFAULT_LOCALE || "en";
  redirect(`/${locale}`);
}
