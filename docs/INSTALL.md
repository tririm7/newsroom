# Installation

## Production (one-liner installer)

TBD — written during M2 once the wizard is functional. Will cover VPS requirements, the `curl … | bash` one-liner, DNS prerequisites, and post-install verification.

## Development (manual Docker Compose)

Available since M1. Stands up the full stack locally on Docker Desktop / Linux Docker.

### Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose` subcommand)
- ~2 GB free disk for images + Postgres volume
- Free host ports 80 and 443

### Steps

```bash
git clone https://github.com/tririm7/newsroom.git
cd newsroom
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, DATABASE_URL (match the password), NEXTAUTH_SECRET.
# Generate strong values with:
#   POSTGRES_PASSWORD=$(openssl rand -base64 32)
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
docker compose up -d --build
```

Open http://localhost — you should see the M1 landing page.

### Optional: expose app/postgres directly to host

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
docker compose up -d
```

This exposes `app` on `127.0.0.1:3000` (bypassing Caddy) and Postgres on `127.0.0.1:5433` so local tooling (`psql`, `drizzle-kit`) can connect.

### Stop / wipe

```bash
docker compose down            # stop containers, keep volumes
docker compose down -v         # stop containers, wipe Postgres data (re-runs initial migration on next up)
```

### What runs

| Service     | Image                   | Role                                                     |
|-------------|-------------------------|----------------------------------------------------------|
| `postgres`  | `postgres:16-alpine`    | Database. Runs `0000_initial.sql` on first start.        |
| `app`       | `newsroom-app:latest`   | Next.js 15 standalone. Listens on `:3000` inside network.|
| `caddy`     | `caddy:2-alpine`        | Reverse proxy on host ports 80/443. Auto-TLS in prod.    |
| `bot-cron`  | `newsroom-bot:latest`   | Long-running supercronic scheduler. Reads `crontab.template`. |
| `bot`       | `newsroom-bot:latest`   | One-shot manual runs. Gated by `manual` profile.         |

One-shot manual bot run (when bot code lands in M3):

```bash
docker compose --profile manual run --rm bot python -m main_full
```
