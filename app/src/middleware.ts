import createMiddleware from "next-intl/middleware";

// Inlined to keep Edge-runtime middleware free of postgres/Node imports.
const SUPPORTED_LOCALES = ["ru", "en", "es"] as const;

const defaultLocale = (process.env.PROJECT_DEFAULT_LOCALE || "en") as "ru" | "en" | "es";

export default createMiddleware({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale,
  localePrefix: "always",
});

export const config = {
  // Skip /admin (handled by per-page auth check), API, internals,
  // metadata routes (icon, sitemap, robots, ...), and anything with a dot.
  matcher: ["/((?!admin|api|_next|icon|sitemap|robots|apple-icon|manifest|.*\\..*).*)"],
};
