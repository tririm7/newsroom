#!/usr/bin/env bash
# Newsroom upgrader. Backs up Postgres, pulls latest, rebuilds images,
# applies migrations, restarts. On failure: restores DB from the pre-upgrade
# dump and resets the working tree.
#
# Expected downtime: 30 s - 5 min depending on DB size + image build time.
# See docs/UPGRADE.md for the full reasoning.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -f .env ]]; then
    set -a; source .env; set +a
fi

PG_USER=${POSTGRES_USER:-newsroom}
PG_DB=${POSTGRES_DB:-newsroom}

green='\033[0;32m'; red='\033[0;31m'; yellow='\033[0;33m'; bold='\033[1m'; nc='\033[0m'
log()  { printf "%b\n" "$*"; }
ok()   { printf "${green}✓${nc} %s\n" "$*"; }
warn() { printf "${yellow}⚠${nc} %s\n" "$*"; }
err()  { printf "${red}✗${nc} %s\n" "$*" >&2; }
step() { printf "\n${bold}== %s ==${nc}\n" "$*"; }

PREV_HEAD=$(git rev-parse HEAD)
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
BACKUP="backups/pre-upgrade-${STAMP}.sql.gz"

# --- 1/5 backup ---
step "1/5 Backup Postgres → $BACKUP"
mkdir -p backups
docker compose exec -T postgres pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$BACKUP"
ok "wrote $(du -h "$BACKUP" | cut -f1)"

# --- 2/5 git pull ---
step "2/5 Fetch + pull from origin"
git fetch origin
NEW_HEAD=$(git rev-parse "@{u}")
if [[ "$PREV_HEAD" == "$NEW_HEAD" ]]; then
    log "Already at latest revision (${PREV_HEAD:0:7})."
    log "Backup at $BACKUP retained anyway."
    exit 0
fi
log "  ${PREV_HEAD:0:7} → ${NEW_HEAD:0:7}"
git pull --ff-only
ok "code at ${NEW_HEAD:0:7}"

# --- rollback handler ---
# After this point any non-zero exit triggers DB + code rollback.
rollback() {
    err "Upgrade failed — rolling back."
    log "  - resetting code to ${PREV_HEAD:0:7}"
    git reset --hard "$PREV_HEAD" || true
    log "  - restoring DB from $BACKUP"
    if gunzip -c "$BACKUP" \
        | docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
        ok "DB restored"
    else
        err "DB restore failed — investigate $BACKUP manually."
    fi
    log "  - restarting services on prior image"
    docker compose up -d || true
    err "Rollback complete. Investigate logs before re-running."
    exit 1
}
trap rollback ERR

# --- 3/5 build ---
step "3/5 Rebuild images"
docker compose build
ok "images built"

# --- 4/5 migrate ---
step "4/5 Apply migrations"
# v0.1 ships only the initial schema (auto-applied by Postgres on first
# boot via /docker-entrypoint-initdb.d/). When forward migrations land
# in v0.2+ this step will call drizzle-kit:
#   docker compose run --rm app npx drizzle-kit migrate
log "No migrations to run on v0.1.0."

# --- 5/5 restart ---
step "5/5 Restart services"
docker compose up -d
ok "services up"

# Clear trap before final messaging — we made it past the danger zone.
trap - ERR

step "Done"
ok "Upgraded ${PREV_HEAD:0:7} → ${NEW_HEAD:0:7}"
log "Backup retained at: $BACKUP"
log "Hint: run ./scripts/healthcheck.sh in a minute to verify all containers are happy."
