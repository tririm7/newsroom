#!/usr/bin/env bash
# Reset the admin password from the host (when you've locked yourself out
# and can't use the in-admin "Change password" form). bcrypt hash is
# generated inside the bot container so we don't need bcrypt on the host.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [[ -f .env ]]; then
    set -a; source .env; set +a
fi

PG_USER=${POSTGRES_USER:-newsroom}
PG_DB=${POSTGRES_DB:-newsroom}
USERNAME=${1:-admin}

echo "Reset password for user '${USERNAME}'."

# Read new password interactively (no echo)
read -rsp "New password (min 12 chars): " NEW
echo
if [[ ${#NEW} -lt 12 ]]; then
    echo "ERROR: password must be at least 12 characters." >&2
    exit 1
fi
read -rsp "Confirm:                     " NEW2
echo
if [[ "$NEW" != "$NEW2" ]]; then
    echo "ERROR: passwords don't match." >&2
    exit 1
fi

# Hash inside the bot container (bcrypt cost 12). Password flows via env
# variable so it never lands in argv (which would be visible in `ps`).
HASH=$(docker compose --profile manual run --rm -T -e _PW="$NEW" bot python -c '
import os, bcrypt
print(bcrypt.hashpw(os.environ["_PW"].encode("utf-8"), bcrypt.gensalt(rounds=12)).decode())
' | tail -n 1)

if [[ -z "$HASH" || ! "$HASH" =~ ^\$2 ]]; then
    echo "ERROR: bcrypt hash generation failed." >&2
    exit 1
fi

# Update via psql variable :'hash' so the bcrypt $ symbols don't need escaping
ROWS=$(docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" \
    -v hash="$HASH" -v username="$USERNAME" -tAc \
    "UPDATE users SET password_hash = :'hash' WHERE username = :'username' RETURNING id;" \
    | tr -d '[:space:]')

if [[ -z "$ROWS" ]]; then
    echo "ERROR: user '${USERNAME}' not found." >&2
    exit 1
fi

echo "✓ Password updated for user '${USERNAME}' (id=${ROWS})."
