# Newsroom — repo memory

Snapshot of what's done, what's in flight, and what's blocked on user
action. Append-only at the top; oldest at the bottom. Detailed per-session
notes live in [docs/SESSION_LOG.md](docs/SESSION_LOG.md).

---

## Current state — 2026-05-18 (evening)

**v0.1.0 — RELEASED** (commit `03c131e`, tag `v0.1.0`)
Seven milestones M0–M6 complete. 140 files. End-to-end installer →
admin → bot → public site working. Release notes:
<https://github.com/tririm7/newsroom/releases/tag/v0.1.0>

**v0.2 — IN PROGRESS**

| Milestone | Status | Commit  | Summary                                                                                       |
|-----------|--------|---------|-----------------------------------------------------------------------------------------------|
| M7        | done   | `4de9ffe` | Provider abstraction. 8 providers via OpenAI SDK + Yandex adapter. 78/78 tests pass.        |
| M8        | done   | `d30bf56` | Wizard provider step + admin LLM section + Test Connection (real upstream call) + PROVIDERS.md. 81/81 tests pass. |
| M9        | pending | —      | Real DeepSeek E2E, Markdown editor (TipTap), force-generate via DB flag, cron auto-sync, pt locale, GitHub Actions lint, v0.2.0 release tag. |

### Before M9 — user prerequisites
1. Register at <https://platform.deepseek.com> and grab the free-tier API key
   (5 M tokens). For the real round-trip test in M9.
2. Create a new GitHub fine-grained PAT with `workflow` scope and save to
   `~/.secrets/newsroom-pat-workflow.env` on the Mac. Required to push
   `.github/workflows/lint.yml`. Current `factum-business-pat.env` lacks
   the workflow scope — keep it separate, don't overwrite.

---

## Second product — Editoria (parallel track)

Different product, not Newsroom. Editorial workflow tool for regional
publishers; translation-based wedge. Vision v3 is on the user's side
(`editoria-vision-v3.md`).

Five defaults from vision waiting on user confirmation:
1. Name: **Editoria** (drop "AI" from naming)
2. Wedge: **translation-based editorial workflow**
3. License: **AGPL** (vs MIT for Newsroom OSS)
4. Hosting: **hybrid** (self-host + managed)
5. Geo Y1: **RU + СНГ**

Once Newsroom v0.2.0 ships, the plan is:
- User finalises Editoria technical spec
- Code starts Editoria MVP as a **fork of Newsroom v0.2** (separate repo)
- Newsroom continues as the OSS upstream

---

## Operational notes

- **Local dev stack**: `cd ~/newsroom && docker compose up -d`. Wipe via
  `docker compose down -v`. Seeded admin = `admin` /
  `test_admin_password_12chars_min`.
- **Local Postgres state**: `projects.llm_provider=deepseek`,
  `llm_api_key='sk-test-dummy-key-for-shape'` (after M8 smoke test reset).
  Wipe + reseed before next session if you want a clean state.
- **GitHub repo**: <https://github.com/tririm7/newsroom> (public, MIT).
- **PAT used so far**: `~/.secrets/factum-business-pat.env` on hetzner
  (works for newsroom commits + tag + release, no `workflow` scope).
- **No legacy v0.1 → v0.2 migration shim** — user confirmed no v0.1
  clients in the wild; bot reads LLM config from DB columns (not env)
  per M8 refactor. `.env`'s `LLM_API_KEY` is bootstrap-only.

---

## Process reminders

- Spec discipline: each milestone has a written prompt + acceptance test.
  Don't skip ahead.
- Real LLM E2E test costs cents — DeepSeek free tier covers it.
- `git push` uses the hetzner-stored PAT (see `~/.secrets/`); no PAT
  ever lands in chat or commits.
- After v0.2.0 release the next stop is a landing page (separate session).
