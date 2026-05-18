#!/usr/bin/env bash
# ANSI color helpers + log functions. Sourced by installer scripts.

if [[ -t 1 ]]; then
    NC=$'\033[0m'
    RED=$'\033[0;31m'
    GREEN=$'\033[0;32m'
    YELLOW=$'\033[0;33m'
    CYAN=$'\033[0;36m'
    BOLD=$'\033[1m'
else
    NC='' RED='' GREEN='' YELLOW='' CYAN='' BOLD=''
fi

log_info()  { printf "%s[INFO]%s %s\n"  "$CYAN"   "$NC" "$*"; }
log_ok()    { printf "%s[ OK ]%s %s\n"  "$GREEN"  "$NC" "$*"; }
log_warn()  { printf "%s[WARN]%s %s\n"  "$YELLOW" "$NC" "$*" >&2; }
log_error() { printf "%s[ERR ]%s %s\n"  "$RED"    "$NC" "$*" >&2; }
log_step()  { printf "\n%s== %s ==%s\n" "$BOLD"   "$*" "$NC"; }
