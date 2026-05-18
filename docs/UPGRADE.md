# Upgrade

To upgrade an installed Newsroom instance:

```bash
cd /opt/newsroom
./upgrade.sh
```

## What `./upgrade.sh` does

| Step | Action                                                          | Failure handling      |
|------|-----------------------------------------------------------------|------------------------|
| 1    | `pg_dump` → `backups/pre-upgrade-<UTC>.sql.gz`                 | Aborts before changes  |
| 2    | `git fetch origin` + `git pull --ff-only`                       | Already-up-to-date exits early |
| 3    | `docker compose build` (app + bot images)                       | Triggers rollback      |
| 4    | Apply drizzle-kit migrations (no-op on v0.1.0)                  | Triggers rollback      |
| 5    | `docker compose up -d` (recreate containers)                    | Triggers rollback      |

## Rollback

If any step from 3 onward fails, `./upgrade.sh` automatically:

1. `git reset --hard <pre-upgrade-sha>` — reverts the working tree.
2. Restores Postgres from the pre-upgrade dump (`psql < backup.sql`).
3. `docker compose up -d` — brings the prior version back online.

You'll see a `Rollback complete` message and exit code `1`.

## Honest about downtime

The pipeline is **not zero-downtime**. Expected service interruption:

- **30 s** if there are no schema changes and images cache hits.
- **2–5 min** for a fresh build + restart on a 2 vCPU VPS.
- **+30 s to several minutes** on the restore path, scaling with DB size.

**Pick a low-traffic window** for upgrades. There is no rolling-deploy
mode in v0.1.

## Caveats

- **Writes during the upgrade window are lost on rollback.** The
  `pg_dump` is taken at step 1; any rows inserted between that moment
  and a rollback are gone. Cron-driven bot runs continue until step 5
  recreates the containers — pause the bot if you're paranoid:
  `docker compose stop bot-cron && ./upgrade.sh && docker compose start bot-cron`.
- **The pre-upgrade dump is not encrypted.** Stored alongside the repo
  (`backups/`). Treat it like a credential when you mirror it off-box.
- **Forward-only migration discipline** (Drizzle add-column-with-default,
  new-table) is a v0.2 norm. v0.1 keeps the safe-but-slow restore-on-fail
  path.

## Manual rollback (if you need it after the script "succeeded")

```bash
# Pick the backup
ls -1 backups/pre-upgrade-*.sql.gz

# Revert code
git reset --hard <sha-from-before-upgrade>

# Restore DB
gunzip -c backups/pre-upgrade-<stamp>.sql.gz | \
  docker compose exec -T postgres psql -U newsroom -d newsroom

# Restart
docker compose up -d
```
