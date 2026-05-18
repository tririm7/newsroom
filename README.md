# Newsroom

Self-hosted AI news aggregator with admin panel. Like Ghost — but for thematic news feeds in the style of Techmeme.

**Status:** v0.1.0 (first public release — 2026-05-18). See [CHANGELOG.md](CHANGELOG.md).

One VPS, one `./install.sh`, and you get:

- AI-curated news feed in your niche (business / AI / crypto / science / custom)
- Auto-generated articles via Anthropic Claude
- Admin panel for sources, keywords, articles, static pages, branding
- Multi-language UI and content (Russian / English / Spanish)
- Auto-TLS via Caddy
- One-command upgrade

## Stack

Next.js 15 · PostgreSQL 16 · Python 3.11 · Anthropic Claude · Docker · Caddy

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Installation](docs/INSTALL.md)
- [Admin panel](docs/ADMIN.md)
- [Configuration](docs/CONFIGURATION.md)
- [Upgrade](docs/UPGRADE.md)
- [Backup](docs/BACKUP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## License

MIT — see [LICENSE](LICENSE).
