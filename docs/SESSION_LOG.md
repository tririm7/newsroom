# Session log

Per-session notes — what shipped, what's deferred, blockers. Append-only;
newest at the top.

---

## 2026-05-18 — M7 + M8 (v0.2 in progress)

### Shipped

**M7 — provider abstraction core** (commit `4de9ffe`)

- `bot/llm.py` — dispatcher for 8 providers. 7 of them (DeepSeek, OpenAI,
  Anthropic, Gemini, Grok, OpenRouter, custom) go through the official
  `openai` Python SDK with swapped `base_url`. Yandex GPT uses
  `bot/llm_yandex.py`, a thin adapter that mimics the OpenAI SDK's
  `.chat.completions.create()` shape (Api-Key auth; `LLM_MODEL` encoded
  as `<folder_id>/<model>`).
- Anthropic via Anthropic's own OpenAI-compat endpoint — `anthropic`
  SDK retired from `bot/requirements.txt` (replaced with `openai>=1.50`).
- Schema: `projects` gained `llm_provider` (CHECK on all 8 values,
  default `deepseek`), `llm_model` (default `deepseek-chat`),
  `llm_base_url`. Inlined into `0000_initial.sql` — no 0001 migration
  since there are no v0.1 clients to upgrade (user decision).
- `bot/clustering.py` and `bot/article_writer.py` rewritten to call
  `llm.generate(messages, ...)` instead of importing Anthropic SDK
  directly.
- `.env` retired `ANTHROPIC_API_KEY`; new vars `LLM_PROVIDER`,
  `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`. `docker-compose.yml`
  plumbs them to `app`, `bot`, `bot-cron`.
- Tests: **78/78 pass**. 21 new (13 in `test_llm.py`, 4 in
  `test_llm_yandex.py`, rewrites of `test_clustering.py` 5 and
  `test_article_writer.py` 9 to mock `llm.generate`).
- Local smoke test: `docker compose down -v && up -d --build`, fresh
  schema applies, seed inserts project with default LLM config, all 4
  services healthy.

**M8 — wizard + admin UI + PROVIDERS.md** (commit `d30bf56`)

- Bot config moves to **DB as source of truth**.
  - `bot/llm.py` adds `LLMConfig` dataclass + `from_settings()` /
    `from_project(row)` builders. `generate()` and `get_client()` take
    optional `config=` kwarg.
  - `main_full.py` builds config from the loaded project row, threads
    through `cluster_new_items(..., llm_config=...)` and
    `write_article(..., llm_config=...)`.
  - Schema: `projects.llm_api_key TEXT` (plaintext for v0.2; encryption
    is v0.3 roadmap).
- `bot/seed.py` accepts `--llm-provider/--llm-model/--llm-api-key/
  --llm-base-url`. Installer wires the wizard answers through.
- Wizard step "LLM provider" with language-aware default
  (`ru → deepseek`, `es → gemini`, else `openai`), per-provider
  disclosure msgbox, model default, API-key prompt, base-URL only when
  provider=custom.
- Admin UI: `/admin/settings` gains LLM Provider section
  (`LLMProviderForm.tsx`):
  - Provider dropdown (8), model input, API-key field (password+show/
    hide; empty = keep stored), base-URL (custom only), disclosure
    note, "get one here" link per provider.
  - **Test connection** button → POST `/api/admin/llm/test` runs a
    real clustering-shaped request through the chosen provider.
  - **Save** button → POST `/api/admin/llm/save` writes the four
    columns to DB. Empty key means "keep existing".
- `app/src/lib/admin/llm_test.ts` — TS mirror of `bot/llm.py` +
  `bot/llm_yandex.py`. OpenAI SDK for 6 providers; raw `fetch` for
  Yandex. `app/package.json` gains `openai`.
- `docs/PROVIDERS.md` — full per-provider setup guide (URLs, model
  recommendations, region notes, disclosure paragraph).
- Tests: **81/81 pass** (+3 in `test_llm.py`: from_project / env
  fallback / explicit-config-wins).
- Real round-trip verified: DeepSeek Test Connection with a fake key
  returned a genuine 401 from `api.deepseek.com` in 554 ms — proves
  the abstraction dispatches upstream end-to-end.

### Deferred to M9

- Real DeepSeek E2E with the user's free-tier key + write
  `docs/PROVIDER_QUALITY.md` comparing DeepSeek vs Claude output on
  the same prompt.
- Per-provider tuning (temperature, max_tokens) if quality varies.
- Markdown editor (TipTap or similar) for `/admin/articles/[id]` —
  currently plain HTML textarea.
- Force-generate article on a cluster — via DB flag
  (`clusters.force_generate=true`) picked up by next cron tick, not
  docker-socket subprocess (user decision: no privileged socket mount).
- Auto cron-file rewrite + `bot-cron` restart when cron strings change
  in admin Settings.
- Portuguese locale (`pt`): `app/messages/pt.json`, bot prompt files,
  wizard option.
- GitHub Actions `lint.yml` — needs a new fine-grained PAT with
  `workflow` scope.
- Tag `v0.2.0` + GitHub release.

### Blockers on user before M9

1. **DeepSeek free-tier API key** — register at
   <https://platform.deepseek.com> for the real round-trip test.
2. **New PAT with `workflow` scope** — save to
   `~/.secrets/newsroom-pat-workflow.env` (separate from
   `factum-business-pat.env` which lacks `workflow` and is shared with
   factum projects).

### Local state at session close

- `~/newsroom` working tree clean; HEAD = `d30bf56`.
- Docker stack up. Postgres seeded:
  `projects.llm_provider=deepseek`,
  `llm_api_key='sk-test-dummy-key-for-shape'` (after M8 smoke test
  reset). Admin login: `admin` / `test_admin_password_12chars_min`.
- Demo data from M4 (2 clusters, 1 article, 3 static pages) was wiped
  during M7's `docker compose down -v`. Re-add manually next session if
  you want them, or just run `main_full` once with a real key in M9.

### Adjacent project (separate track)

User is preparing **Editoria** — a different product, regional
publisher editorial workflow, translation-based wedge. Vision v3
written by user (`editoria-vision-v3.md`, not in this repo). After
Newsroom v0.2.0 release, the plan is to fork the v0.2 codebase into a
new repo for Editoria MVP. Five vision defaults pending user confirm:
name **Editoria**, wedge translation, license **AGPL**, hosting hybrid,
geo Y1 **RU+СНГ**.

---

## 2026-05-17/18 — M0 through M6 (v0.1.0 release)

Compressed timeline of the seven milestones that landed v0.1.0
(commit `03c131e`, tag `v0.1.0`).

| Milestone | Commit  | Headline                                                              |
|-----------|---------|-----------------------------------------------------------------------|
| M0        | `a7ddd62` | Repo skeleton (MIT, dir tree, docs stubs, no code)                  |
| M1        | `269d3e4` | Core stack containerized: postgres + Next.js app + Caddy + supercronic bot-cron + manual bot |
| M2        | `97f9e74` | Installer wizard (whiptail, 9 questions, 5 niche presets, auto-generated secrets, bcrypt admin via `bot/seed.py`) |
| M3        | `de426f5` | Bot pipeline: RSS ingest, Jaccard pre-cluster, Claude clustering, article writing. 57/57 tests pass |
| M4        | `10aaca3` | Public frontend: feed, article, archive, dynamic static-pages CMS, SEO routes, i18n via next-intl, brand-coloured header |
| M5 v1     | `777dd75` | Admin panel auth + dashboard + sources (with RSS auto-discovery) + articles + change-password |
| M5.1      | `33ec902` | Remaining admin CRUD: keywords, clusters, static-pages CMS, article editor, project settings editor |
| M6 / v0.1.0 | `03c131e` | upgrade.sh, backup.sh, healthcheck.sh, reset-admin-password.sh + 7 filled-out docs + v0.1.0 release |

Full details in commit messages and `CHANGELOG.md`.
