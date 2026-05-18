-- Newsroom initial schema migration.
-- Applied automatically by postgres on first start via /docker-entrypoint-initdb.d/.
-- Multi-tenant ready: every table carries project_id (Newsroom Open uses project_id = 1).
-- Per patches v1.1: no `sessions` table (JWT-only auth), bot_runs.errors is JSONB.
-- Per v0.2 spec: projects carries llm_provider / llm_model / llm_base_url.

-- ============================================================================
-- projects: site metadata + behavior knobs (single row in Newsroom Open)
-- ============================================================================
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    description TEXT,

    primary_locale TEXT NOT NULL DEFAULT 'ru' CHECK (primary_locale IN ('ru','en','es')),
    timezone TEXT NOT NULL DEFAULT 'America/New_York',

    brand_name TEXT NOT NULL,
    brand_suffix TEXT NOT NULL,
    brand_color TEXT NOT NULL,
    brand_color_hover TEXT,
    logo_url TEXT,
    favicon_url TEXT,

    auto_publish BOOLEAN NOT NULL DEFAULT true,
    article_min_sources INT NOT NULL DEFAULT 2 CHECK (article_min_sources BETWEEN 1 AND 10),
    max_news_age_hours INT NOT NULL DEFAULT 24,
    cluster_inactivity_hours INT NOT NULL DEFAULT 24,

    ingestion_cron TEXT NOT NULL DEFAULT '*/5 * * * *',
    generation_cron TEXT NOT NULL DEFAULT '15,45 * * * *',

    -- LLM provider config. Mirrored in .env (runtime) so the bot can read it
    -- without a DB round-trip per request. The admin UI keeps both in sync.
    llm_provider TEXT NOT NULL DEFAULT 'deepseek'
        CHECK (llm_provider IN ('deepseek','openai','anthropic','gemini','grok','yandex','openrouter','custom')),
    llm_model TEXT NOT NULL DEFAULT 'deepseek-chat',
    llm_api_key TEXT,    -- stored plaintext (same perimeter as .env). Encryption is v0.3.
    llm_base_url TEXT,   -- only for provider=custom

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- users: admin accounts (NextAuth v5 JWT strategy — no sessions table)
-- ============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','editor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, username)
);

-- ============================================================================
-- sources: RSS / Atom / Google News feeds
-- ============================================================================
CREATE TABLE sources (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'rss' CHECK (type IN ('rss','atom','gnews')),
    language TEXT NOT NULL DEFAULT 'en',
    tier INT NOT NULL DEFAULT 3 CHECK (tier BETWEEN 1 AND 5),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_fetched_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, url)
);

-- ============================================================================
-- keywords: relevance filter patterns (substring or regex)
-- ============================================================================
CREATE TABLE keywords (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pattern TEXT NOT NULL,
    is_regex BOOLEAN NOT NULL DEFAULT false,
    category TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- items: raw RSS entries after parse
-- cluster_id FK added after clusters table exists (circular reference)
-- ============================================================================
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_id INT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    summary TEXT,
    image_url TEXT,
    language TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    cluster_id INT,
    skipped_at TIMESTAMPTZ,
    skipped_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, url)
);

-- ============================================================================
-- clusters: items grouped by topic by the LLM
-- ============================================================================
CREATE TABLE clusters (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    description TEXT,
    source_count INT NOT NULL DEFAULT 0,
    score FLOAT NOT NULL DEFAULT 0,
    previous_score FLOAT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_source_added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ,
    deactivated_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE items ADD CONSTRAINT fk_items_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE SET NULL;

-- ============================================================================
-- articles: LLM-generated articles
-- ============================================================================
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    cluster_id INT REFERENCES clusters(id) ON DELETE SET NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content_html TEXT NOT NULL,
    content_markdown TEXT,
    image_url TEXT,
    language TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
    views_count INT NOT NULL DEFAULT 0,
    is_manual BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, slug)
);

-- ============================================================================
-- static_pages: CMS for custom pages (Privacy / Terms / About / etc.)
-- ============================================================================
CREATE TABLE static_pages (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    content_html TEXT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT false,
    footer_position INT,
    locale TEXT NOT NULL DEFAULT 'ru',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, locale, slug)
);

-- ============================================================================
-- bot_runs: bot execution log for dashboard / debugging
-- errors is JSONB (patches v1.1 #5): [{source, error, at}, ...]
-- ============================================================================
CREATE TABLE bot_runs (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('fast','full','manual')),
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    items_added INT DEFAULT 0,
    clusters_updated INT DEFAULT 0,
    articles_created INT DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed'))
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX idx_items_project_published ON items(project_id, published_at DESC);
CREATE INDEX idx_items_cluster ON items(cluster_id) WHERE cluster_id IS NOT NULL;
CREATE INDEX idx_clusters_project_active ON clusters(project_id, is_active, score DESC);
CREATE INDEX idx_articles_project_published ON articles(project_id, status, published_at DESC);
CREATE INDEX idx_articles_cluster ON articles(cluster_id);
