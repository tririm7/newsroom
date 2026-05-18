#!/usr/bin/env bash
# Newsroom — one-liner installer entry point.
#
# Two ways to invoke:
#   1) curl -fsSL https://raw.githubusercontent.com/tririm7/newsroom/main/install.sh | sudo bash
#      → clones the repo into /opt/newsroom and runs the full installer
#   2) git clone https://github.com/tririm7/newsroom.git && cd newsroom && sudo ./install.sh
#      → runs the installer in-place

set -euo pipefail

INSTALL_DIR=${NEWSROOM_DIR:-/opt/newsroom}
REPO_URL=${NEWSROOM_REPO:-https://github.com/tririm7/newsroom.git}

# Detect mode: piped (curl|bash) vs in-repo
SOURCE_DIR=""
if [[ "${BASH_SOURCE[0]:-}" ]] && [[ -f "${BASH_SOURCE[0]}" ]]; then
    SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [[ -n "$SOURCE_DIR" ]] && [[ -f "$SOURCE_DIR/installer/install.sh" ]]; then
    # Running from a cloned repo
    exec bash "$SOURCE_DIR/installer/install.sh" "$@"
fi

# --- Curled mode: clone repo, then re-exec ---

if [[ "$(id -u)" -ne 0 ]]; then
    echo "ERROR: run as root or via sudo." >&2
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    echo "Installing git..."
    apt-get update -qq
    apt-get install -y git
fi

if [[ -d "$INSTALL_DIR/.git" ]]; then
    echo "Repo already at $INSTALL_DIR — pulling latest"
    cd "$INSTALL_DIR"
    git pull --ff-only
else
    echo "Cloning Newsroom into $INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

exec bash "$INSTALL_DIR/installer/install.sh" "$@"
