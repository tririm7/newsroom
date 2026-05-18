#!/usr/bin/env bash
# Daily DB backup. Dumps Postgres via `docker compose exec`, gzips, rotates
# to keep the last N backups. Run manually or wire into host cron:
#
#   0 3 * * *  cd /opt/newsroom && ./scripts/backup.sh >> /var/log/newsroom-backup.log 2>&1
#
# For pre-upgrade backups use ./upgrade.sh instead (which calls into this
# logic but tags the file `pre-upgrade-*`).

set -euo pipefail

# Resolve repo root regardless of where this is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load .env if present (POSTGRES_USER / POSTGRES_DB)
if [[ -f .env ]]; then
    set -a
    # shellcheck source=/dev/null
    source .env
    set +a
fi

PG_USER=${POSTGRES_USER:-newsroom}
PG_DB=${POSTGRES_DB:-newsroom}
KEEP=${BACKUP_KEEP:-7}

mkdir -p backups
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
OUT="backups/db-${STAMP}.sql.gz"

echo "==> dumping ${PG_DB}@postgres → ${OUT}"
docker compose exec -T postgres pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$OUT"
SIZE=$(du -h "$OUT" | cut -f1)
echo "    wrote $OUT (${SIZE})"

# Rotate — keep last $KEEP daily backups
COUNT=$(find backups -maxdepth 1 -name 'db-*.sql.gz' -type f | wc -l | tr -d ' ')
if (( COUNT > KEEP )); then
    REMOVE=$(( COUNT - KEEP ))
    find backups -maxdepth 1 -name 'db-*.sql.gz' -type f -print0 \
        | xargs -0 ls -1t \
        | tail -n "$REMOVE" \
        | xargs rm -f --
    echo "    rotated: removed $REMOVE older backups"
fi
echo "    retained: $(find backups -maxdepth 1 -name 'db-*.sql.gz' -type f | wc -l | tr -d ' ')"
