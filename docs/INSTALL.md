# Installation

## Production (one-liner installer)

Available since M2. Runs an interactive wizard on a fresh Ubuntu 22.04+ / Debian 12+ VPS.

### Prerequisites

- Fresh Ubuntu 22.04+ or Debian 12+
- Root access (or sudo)
- A domain with an A-record pointing at the server (for auto-TLS)
- An Anthropic API key (`sk-ant-...`)

### One-liner (curl)

```bash
curl -fsSL https://raw.githubusercontent.com/tririm7/newsroom/main/install.sh | sudo bash
```

This clones the repo into `/opt/newsroom`, installs Docker + Compose + whiptail if missing, then drops you into the wizard.

### Two-step (git clone)

```bash
git clone https://github.com/tririm7/newsroom.git /opt/newsroom
cd /opt/newsroom
sudo ./install.sh
```

### What the wizard asks

1. **Domain** — your site URL (or `localhost` for local-only)
2. **Language** — Russian / English / Spanish
3. **Timezone** — IANA name (default depends on language)
4. **Site name + description** — header + SEO meta
5. **Branding** — hex color + 1–4 char suffix (the bit after the brand name in a colored box)
6. **Preset** — starter pack of sources + keywords:
   - `ai-news` — OpenAI, Anthropic, MIT TR, Stratechery, ... (13 sources, 28 keywords)
   - `business` — Bloomberg, Reuters, WSJ, FT, CNBC, ... (13 / 29)
   - `crypto` — CoinDesk, The Block, Decrypt, ... (10 / 28)
   - `science` — Nature, Quanta, MIT TR, Ars Technica, ... (10 / 26)
   - `custom` — empty; you add sources via admin
7. **Admin password** — minimum 12 characters
8. **Anthropic API key**

### What the installer does (post-wizard)

| Step | What                                                          | Duration   |
|------|---------------------------------------------------------------|------------|
| 0    | Generate `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, `DATABASE_URL` | < 1 s     |
| 1    | Write `.env` (mode 0600)                                       | < 1 s     |
| 2    | `docker compose build` — both images                           | ~3–5 min   |
| 3    | Start Postgres, schema auto-applies via init-script            | ~30 s      |
| 4    | Seed project + admin user + sources + keywords                 | ~10 s      |
| 5    | Start app + Caddy + bot-cron                                   | ~30 s      |
| 6    | Wait for Let's Encrypt cert (skipped if `domain=localhost`)    | ~1–2 min   |

End result: `https://your-domain` shows the site; `https://your-domain/admin` lets you log in as `admin`.

### Resume after failure

If any post-wizard step fails, fix the underlying issue (DNS, disk, API quota) and re-run:

```bash
sudo /opt/newsroom/install.sh --resume
```

This skips the wizard (answers saved in `/tmp/newsroom-wizard.env`) and replays the build/seed/start chain.

### Useful flags

- `--skip-docker` — assume Docker is already installed
- `--resume` — skip wizard, reuse saved answers
- `--help` — show all flags

---

## Development (manual Docker Compose)

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
