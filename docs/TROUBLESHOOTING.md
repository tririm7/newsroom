# Troubleshooting

A non-exhaustive list of things that go wrong on first install + how to
spot them quickly. Triage entry point:

```bash
cd /opt/newsroom
./scripts/healthcheck.sh
docker compose ps
docker compose logs --tail=50 <service>
```

---

## TLS certificate doesn't issue

**Symptom:** `https://your-domain` hangs or shows a Caddy self-signed
cert. Caddy logs show `tls: no SRV record / failed to obtain certificate`.

**Cause:** DNS A-record doesn't point at this server, or port 80 isn't
reachable from the public internet (Let's Encrypt HTTP-01 challenge
needs it).

**Fix:**

```bash
# 1. Check what DNS resolves to
dig +short your-domain

# 2. Compare to this server's IP
curl -s https://api.ipify.org

# 3. After fixing DNS, ask Caddy to retry
docker compose restart caddy
```

If port 80 is firewalled: `sudo ufw allow 80/tcp; sudo ufw allow 443/tcp`.

---

## Bot never writes articles

**Symptom:** Dashboard shows clusters but `Articles published: 0` even
after several hours.

**Diagnosis steps:**

```bash
# Was the cron firing at all?
docker compose logs --tail=100 bot-cron

# Was a recent run successful?
docker compose exec postgres psql -U newsroom -d newsroom -c \
  "SELECT type, status, started_at, finished_at, items_added, articles_created
   FROM bot_runs ORDER BY id DESC LIMIT 5;"

# Force a run to see fresh stderr/stdout
docker compose --profile manual run --rm bot python -m main_full
```

Common culprits:

- **`ANTHROPIC_API_KEY` empty or invalid** in `.env`. The bot will log
  `AuthenticationError` on clustering / writing.
- **`article_min_sources` set too high** — no cluster ever reaches it.
  Lower it in `/admin/settings`.
- **Sources all returning 4xx** — open `/admin/sources` and look at the
  recent `last_error` column or watch `docker compose logs bot-cron`.
- **Off-topic filter too aggressive** — empty out one keyword to test
  whether the filter is dropping everything.

---

## RSS sources return 403 / 404 in logs

**Symptom:** `WARN HTTP error <source>: 403 Client Error`.

**Cause:** Some publishers block default UAs, paywall their feeds, or
have moved/removed the URL.

**Fix:** Open `/admin/sources`, delete the broken row, add a working URL
(search "&lt;publisher&gt; rss feed" or use the *Discover by domain*
button).

The bot already isolates failures — one bad source never breaks the run.

---

## "Project not found in DB: slug=newsroom"

**Symptom:** Public site or admin returns 500 with
`Project not found in DB: slug=newsroom. Did the installer run seed.py?`

**Cause:** The Docker volume was wiped (e.g. `docker compose down -v`)
without re-running the seed step.

**Fix:**

```bash
# If you still have a .env with ADMIN_PASSWORD set elsewhere — re-run installer
./install.sh --resume
```

Or seed manually with the preset of your choice:

```bash
docker compose --profile manual run --rm \
  -v "$(pwd)/installer/presets:/presets:ro" \
  -e ADMIN_PASSWORD="<your-password>" \
  bot python seed.py \
    --preset-file=/presets/ai-news.yaml \
    --slug=newsroom --name="My News" --domain="news.example.com" \
    --description="…" --locale=en --timezone=America/New_York \
    --brand-name="MY NEWS" --brand-suffix="AI" --brand-color="#1e3a8a"
```

---

## Locked out of admin

```bash
./scripts/reset-admin-password.sh
```

Prompts for a new password (12+ chars), hashes it via the bot container's
bcrypt, updates `users.password_hash`. Works regardless of whether you
remember the old password.

---

## "Failed to fetch RSS — connection refused"

Most likely the source uses IPv6-only DNS or sits behind Cloudflare bot
protection. The bot's User-Agent is `Newsroom Bot/0.1`; some publishers
allowlist by UA. There's no per-source UA override in v0.1 — open an
issue if this becomes a pattern.

---

## Postgres is healthy but app returns 500

```bash
docker compose logs --tail=200 app
```

Look for stack traces. Most common: a schema drift after a manual SQL
edit. Restore from the most recent dump:

```bash
gunzip -c backups/db-<latest>.sql.gz | \
  docker compose exec -T postgres psql -U newsroom -d newsroom
```

---

## Image build OOMs on 1 GB / 2 GB VPS

Next.js build is memory-hungry (~1.2 GB peak). On a 2 GB box add swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Then retry `./upgrade.sh` (or the install). 4 GB VPSes don't need this.

---

## "Container newsroom-postgres-1 is unhealthy"

Postgres healthcheck times out (5 s by default, 20 retries → 100 s grace).
Slow disks (HDD-backed VPS) can hit this on first boot. Either:

- Wait longer (`docker compose ps` will go healthy eventually), or
- Move to SSD storage, or
- Bump the healthcheck `retries` in `docker-compose.yml`.

---

## Reset everything

Last-resort wipe (loses all data — clusters, articles, sources, keywords):

```bash
docker compose down -v
rm -rf backups
sudo rm -rf /opt/newsroom
# Then re-run the curl one-liner installer.
```
