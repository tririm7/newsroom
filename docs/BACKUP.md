# Backup

Postgres is the only durable thing on the box. Everything else (Docker
images, code, `.env`) can be rebuilt from `git pull` + the installer.

## Manual backup

```bash
cd /opt/newsroom
./scripts/backup.sh
```

That writes `backups/db-<UTC-timestamp>.sql.gz` and rotates older files
(default: keep the last 7). Override the retention count with
`BACKUP_KEEP=14 ./scripts/backup.sh`.

## Automated daily backup

Wire into the **host** crontab (not supercronic — `pg_dump` runs via
`docker compose exec` which the bot container can't reach):

```bash
sudo crontab -e
# Add:
0 3 * * *  cd /opt/newsroom && ./scripts/backup.sh >> /var/log/newsroom-backup.log 2>&1
```

`./upgrade.sh` already takes its own pre-upgrade backup (filename prefix
`pre-upgrade-`) so daily + pre-upgrade dumps don't collide.

## Off-server copy

Backups in `backups/` only protect you against accidental drops, not
against losing the VPS. Mirror them somewhere else:

```bash
# rsync to another host (every 15 min, sample line for the host crontab)
*/15 * * * * rsync -aq --delete /opt/newsroom/backups/ backup-host:newsroom-backups/

# rclone to S3-compatible storage (B2, R2, etc.)
0 4 * * * rclone copy /opt/newsroom/backups/ b2:my-newsroom-backups/
```

Either is fine. v0.1 doesn't bundle a built-in off-server uploader (lands
in v0.2 / Managed Tier).

## Restore

```bash
# Stop writers while restoring
docker compose stop bot-cron app

# Pick the backup
ls -1 backups/

# Restore
gunzip -c backups/db-2026-05-18T030000Z.sql.gz | \
  docker compose exec -T postgres psql -U newsroom -d newsroom

# Restart
docker compose up -d
```

A restore overlays into an existing schema; if you need to wipe first:

```bash
docker compose down -v   # destroys the postgres-data volume
docker compose up -d postgres  # re-runs the init script
# Then `psql < dump.sql` as above.
```
