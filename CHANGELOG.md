# Changelog

All notable changes to Newsroom are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added

- M2: installer wizard. `./install.sh` (or curl one-liner) walks the user through domain / language / timezone / branding / preset / admin-password / Anthropic-key prompts via whiptail, generates `POSTGRES_PASSWORD` + `NEXTAUTH_SECRET` automatically (patches v1.1 #3), writes `.env`, builds images, starts Postgres, seeds the project (project row + bcrypt-hashed admin user + sources + keywords from preset), starts app/Caddy/bot-cron, waits for Let's Encrypt. Five starter presets: `ai-news`, `business`, `crypto`, `science`, `custom`. `--resume` flag replays post-wizard steps after fixing a failure. Idempotency guard: re-seeding an existing slug fails with exit 2. Validated locally: bash syntax (`bash -n`), validator unit tests (14/14 pass), seed.py against running Postgres.

- M1: core stack containerization. `docker-compose up -d` brings the full stack online — Postgres 16 (with initial schema auto-applied), Next.js 15 app, Caddy reverse proxy, supercronic-driven `bot-cron`, profile-gated one-shot `bot`. Schema migration ships per spec + patches v1.1 (no `sessions` table, `bot_runs.errors` as JSONB). `docs/INSTALL.md` describes the dev flow.

## [v0.1.0-pre] — 2026-05-17

### Added

- M0: repo skeleton — directory structure, MIT license, base documentation stubs.
