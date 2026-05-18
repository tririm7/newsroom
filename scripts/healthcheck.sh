#!/usr/bin/env bash
# Quick health probe. Useful as the body of an uptime alert or as a manual
# triage step ("./scripts/healthcheck.sh" → see what's broken). Exits non-zero
# if any container is missing, the DB doesn't accept connections, or the
# front door doesn't return 2xx within 5 s.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [[ -f .env ]]; then
    set -a; source .env; set +a
fi

PG_USER=${POSTGRES_USER:-newsroom}
PG_DB=${POSTGRES_DB:-newsroom}
EXIT=0

green='\033[0;32m'; red='\033[0;31m'; yellow='\033[0;33m'; nc='\033[0m'
ok()   { printf "${green}✓${nc} %s\n" "$*"; }
bad()  { printf "${red}✗${nc} %s\n" "$*"; EXIT=1; }
warn() { printf "${yellow}⚠${nc} %s\n" "$*"; }

# 1. Compose services
for svc in postgres app caddy bot-cron; do
    if docker compose ps "$svc" --status running --quiet 2>/dev/null | grep -q .; then
        ok "$svc container running"
    else
        bad "$svc container NOT running"
    fi
done

# 2. Postgres pg_isready
if docker compose exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    ok "postgres accepts connections"
else
    bad "postgres pg_isready failed"
fi

# 3. HTTP front door
if curl -fsSL --max-time 5 -o /dev/null http://localhost/ 2>/dev/null; then
    ok "HTTP / returns 2xx"
else
    bad "HTTP / did not return 2xx within 5 s"
fi

# 4. Last successful bot run age (informational)
LAST_AGE=$(docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -tAc \
    "SELECT extract(epoch FROM now() - finished_at)::int FROM bot_runs WHERE status='success' ORDER BY id DESC LIMIT 1" \
    2>/dev/null | tr -d '[:space:]' || echo "")
if [[ -z "$LAST_AGE" ]]; then
    warn "No successful bot run recorded yet (fresh install?)"
elif (( LAST_AGE < 3600 )); then
    ok "Last successful bot run: ${LAST_AGE}s ago"
else
    warn "Last successful bot run: ${LAST_AGE}s ago (> 1h — check 'docker compose logs bot-cron')"
fi

exit $EXIT
