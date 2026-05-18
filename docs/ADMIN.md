# Admin panel

The admin lives at `/admin`. First login uses the username `admin` plus the
password you set during installation. Sessions are JWT cookies; there's no
"forgot password" flow — use `./scripts/reset-admin-password.sh` if you lock
yourself out.

## Sections

### Dashboard (`/admin`)

Cards summarising:

- **Sources** — active / total source count.
- **Items (24h)** — new RSS items ingested in the last 24 hours.
- **Active clusters** — clusters currently competing for article generation.
- **Articles** — total published + how many landed in the last 24 hours.
- **Last bot run** — type (`fast` / `full`), status, finish time.

Below the cards: a short cheat-sheet of useful host commands (live log
streaming, manual bot run).

### Sources (`/admin/sources`)

Two ways to add a source:

1. **By domain** — type a hostname, click *Discover*. The app fetches the
   homepage, scans for `<link rel="alternate">` feed declarations, and
   probes common paths (`/feed`, `/rss.xml`, ...). Found feeds are shown
   inline — click *+ Add* to adopt one.
2. **By URL** — paste the feed URL directly with a name and language.

Each row has a 🟢/⚪ active toggle and a *delete* action. Deleting a source
cascades to its items (FK `ON DELETE CASCADE`).

### Keywords (`/admin/keywords`)

The relevance filter the bot applies before inserting an RSS item. Each row
is either a literal substring (matched with `\b<word>\b`) or a raw regex
(check the *regex* checkbox when adding). Keywords are grouped by
*category* in the table; categories are free-form labels — invent your own
as the niche grows.

An empty keyword list means **no filter** — everything passes through
(noisy; tighten it).

### Clusters (`/admin/clusters`)

Read-only insight into what the bot is grouping. Two sections:

- **Active** — clusters competing for article generation (when their
  source count reaches `article_min_sources`, the next `main_full` run
  writes a Claude article for them).
- **Deactivated** — collapsed by default. Clusters age out automatically
  after `cluster_inactivity_hours` of no new sources, or you can
  *deactivate* manually to ignore a topic.

There's no "force-generate article" yet — for now run
`docker compose --profile manual run --rm bot python -m main_full` to trigger
an immediate pipeline pass. The button arrives in v0.2.

### Articles (`/admin/articles`)

List of every article (drafts included). Each row:

- *edit* — opens the full editor (title, slug, excerpt, content HTML,
  image URL, status). Preview link opens the public page.
- *→ draft* / *→ publish* — toggles `status` (drafts are hidden from feed
  and sitemap).
- *delete* — permanent removal.

### Pages (`/admin/pages`)

CMS for static pages rendered at `/[locale]/[slug]`. Common slugs:
`about`, `privacy`, `terms`. Set *footer position* to a number to surface
the page in the public footer (lower = leftmost). Leave blank to keep the
page accessible by URL but hidden from the footer.

The content field is raw HTML — `<p>`, `<h2>`, `<ul>`, `<a>` all render
unchanged on the public side. v0.1 does not auto-convert markdown; paste
what you want shown.

### Settings (`/admin/settings`)

Editable project knobs:

- **Identity** — site name, SEO description.
- **Branding** — header brand name, suffix character(s), brand color
  (native browser color picker).
- **Locale + timezone** — primary site language and IANA timezone.
- **Pipeline thresholds** — `article_min_sources`,
  `max_news_age_hours`, `cluster_inactivity_hours`, *auto-publish* toggle.
- **Cron strings** — supercronic-format schedules for `main_fast` and
  `main_full`. **Note:** v0.1 stores these in the DB only; the live
  `crontab.template` mounted into the `bot-cron` container is not
  auto-rewritten. After changing cron, edit `crontab.template` to match
  and run `docker compose restart bot-cron`. Automated sync lands in v0.2.

Separate "Change admin password" form below the project section — verifies
the current password before bcrypt-rehashing the new one (cost 12).

## Re-running the bot manually

```bash
# Fast pipeline (RSS only, no Claude calls)
docker compose --profile manual run --rm bot python -m main_fast

# Full pipeline (RSS + Claude clustering + article generation)
docker compose --profile manual run --rm bot python -m main_full
```

Both end with a one-line summary and write a row to `bot_runs` (visible on
the dashboard as *Last bot run*).
