import createMiddleware from "next-intl/middleware";

// Inlined to keep the Edge-runtime middleware free of postgres/Node imports.
// Must stay in sync with SUPPORTED_LOCALES in src/lib/project.ts.
const SUPPORTED_LOCALES = ["ru", "en", "es"] as const;

// Default locale for redirects when user hits "/". Installer writes this
// from the wizard's --locale choice; falls back to "en" in dev.
const defaultLocale = (process.env.PROJECT_DEFAULT_LOCALE || "en") as "ru" | "en" | "es";

export default createMiddleware({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale,
  localePrefix: "always",
});

export const config = {
  // Skip static assets, Next internals, and locale-agnostic metadata routes
  // (icon, sitemap, robots, apple-icon, opensearch, manifest).
  matcher: ["/((?!api|_next|icon|sitemap|robots|apple-icon|manifest|.*\\..*).*)"],
};
