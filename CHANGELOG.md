# Changelog

All notable changes to Newsroom are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added

- M5: admin panel (v1 — auth, dashboard, sources, articles, settings).
  NextAuth v5 with JWT-only sessions (patches v1.1 #1), Credentials
  provider verifying bcrypt hashes against `users.password_hash`.
  /admin/login + /admin/(authed)/{dashboard,sources,articles,settings}
  via route-group layout — `(authed)/layout.tsx` calls `auth()` and
  redirects to login when no session. Sources page supports add-by-URL,
  add-by-discovery (TypeScript port of `bot/rss_discovery.py` at
  `src/lib/admin/discover.ts` — no shell-out to bot container needed),
  active/inactive toggle, delete. Articles page supports publish/draft
  toggle + delete. Settings page shows project metadata + change-password
  form. Every `/api/admin/*` endpoint guards with `await auth()` returning
  401 on no session. Dashboard pulls counts via a single CTE-style query
  (`getDashboardStats`). Middleware matcher excludes `/admin` so the
  i18n middleware doesn't fight the auth flow. Verified locally with the
  M2 seed admin credentials: full curl-based login round trip (CSRF →
  signin → authjs.session-token cookie → 200 on /admin and JSON on
  /api/admin/sources), discovery endpoint correctly resolves
  techcrunch.com → /feed/, wrong-password sign-in returns no
  session-token. Deferred to M5.1: keywords UI, clusters UI
  (force-generate, deactivate), static-pages CMS, cron / branding
  settings (still SQL-editable for v0.1).

- M4: public frontend. Next.js 15 App Router under `app/src/app/[locale]/`
  with feed (`/`), article page (`/article/[slug]`), archive (`/articles`),
  and dynamic static-page renderer (`/[slug]` — reads from `static_pages`
  table). Tailwind CSS 4 (CSS-first config), next-intl 3 for UI strings
  in ru/en/es. Brand color from `projects.brand_color` injected as
  `--brand-accent` CSS var on the locale layout. Drizzle ORM schema
  mirroring `drizzle/0000_initial.sql`; `postgres` driver. SEO routes
  (patches v1.1 #7): dynamic `app/sitemap.ts` (lists all published
  articles), `app/robots.ts`, dynamic `app/icon.tsx` (PNG generated from
  brand_color via `next/og`). Custom middleware via `next-intl` redirects
  `/` to `/<PROJECT_DEFAULT_LOCALE>`; matcher skips Next internals + icon
  + sitemap + robots so they stay locale-agnostic. Installer writes
  `PROJECT_DEFAULT_LOCALE` from the wizard's `--locale` answer; compose
  passes it through to the app container. Verified locally against the
  M2 seed + 2 demo clusters + 1 demo article + 3 demo static pages:
  all five route types return 200 with correct content, sitemap.xml
  lists articles, /icon serves a 64×64 PNG.

- M3: bot pipeline. `bot/main_fast.py` (RSS ingest + Jaccard match, no LLM)
  and `bot/main_full.py` (fast + Claude clustering for leftovers + article
  generation + stale cluster cleanup) wire up the full automation path.
  Modules: `rss.py`, `relevance.py` (regex from keywords table),
  `keyword_match.py` (Jaccard token similarity for fast pre-cluster),
  `clustering.py` + `article_writer.py` (Anthropic SDK calls), `scoring.py`
  (source_count / (hours + 2)^1.5), `db.py` (psycopg helpers — get_project,
  insert_items, cluster CRUD, article save, bot_runs telemetry),
  `jsonparse.py` (markdown-fence stripping + json_repair fallback),
  `rss_discovery.py` (HTML <link rel=alternate> parser + common-path
  fallback, for admin "add source by domain" in M5). Six prompt templates
  (`prompts/{clustering,article}_{ru,en,es}.txt`); language picked from
  `projects.primary_locale`. Telemetry rows in `bot_runs` with JSONB error
  array (patch v1.1 #5). 57 unit tests pass (`pytest`): jsonparse,
  relevance, scoring, keyword_match, rss (HTTP stubbed, real feedparser),
  rss_discovery, clustering + article_writer (Claude + DB mocked).
  main_fast verified E2E against the live local Postgres — 3 items
  ingested from a real TechCrunch AI feed, off-topic filter applied,
  bot_runs row recorded.

- M2: installer wizard. `./install.sh` (or curl one-liner) walks the user through domain / language / timezone / branding / preset / admin-password / Anthropic-key prompts via whiptail, generates `POSTGRES_PASSWORD` + `NEXTAUTH_SECRET` automatically (patches v1.1 #3), writes `.env`, builds images, starts Postgres, seeds the project (project row + bcrypt-hashed admin user + sources + keywords from preset), starts app/Caddy/bot-cron, waits for Let's Encrypt. Five starter presets: `ai-news`, `business`, `crypto`, `science`, `custom`. `--resume` flag replays post-wizard steps after fixing a failure. Idempotency guard: re-seeding an existing slug fails with exit 2. Validated locally: bash syntax (`bash -n`), validator unit tests (14/14 pass), seed.py against running Postgres.

- M1: core stack containerization. `docker-compose up -d` brings the full stack online — Postgres 16 (with initial schema auto-applied), Next.js 15 app, Caddy reverse proxy, supercronic-driven `bot-cron`, profile-gated one-shot `bot`. Schema migration ships per spec + patches v1.1 (no `sessions` table, `bot_runs.errors` as JSONB). `docs/INSTALL.md` describes the dev flow.

## [v0.1.0-pre] — 2026-05-17

### Added

- M0: repo skeleton — directory structure, MIT license, base documentation stubs.
