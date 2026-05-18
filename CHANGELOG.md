# Changelog

All notable changes to Newsroom are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added

- M1: core stack containerization. `docker-compose up -d` brings the full stack online — Postgres 16 (with initial schema auto-applied), Next.js 15 app, Caddy reverse proxy, supercronic-driven `bot-cron`, profile-gated one-shot `bot`. Schema migration ships per spec + patches v1.1 (no `sessions` table, `bot_runs.errors` as JSONB). `docs/INSTALL.md` describes the dev flow.

## [v0.1.0-pre] — 2026-05-17

### Added

- M0: repo skeleton — directory structure, MIT license, base documentation stubs.
