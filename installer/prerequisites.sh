#!/usr/bin/env bash
# Pre-flight checks: OS, RAM, disk, root; install whiptail + Docker if missing.
# Assumes lib/colors.sh is already sourced by the caller.

ensure_root() {
    if [[ "$(id -u)" -ne 0 ]]; then
        log_error "Run as root or via sudo."
        exit 1
    fi
}

ensure_os() {
    if [[ ! -f /etc/os-release ]]; then
        log_error "Cannot detect OS — /etc/os-release missing."
        exit 1
    fi
    # shellcheck source=/dev/null
    source /etc/os-release
    local maj
    case "${ID:-}" in
        ubuntu)
            maj=${VERSION_ID%%.*}
            if (( maj < 22 )); then
                log_error "Ubuntu ${VERSION_ID} is too old; need 22.04+."
                exit 1
            fi
            log_ok "OS: ${PRETTY_NAME}"
            ;;
        debian)
            maj=${VERSION_ID%%.*}
            if (( maj < 12 )); then
                log_error "Debian ${VERSION_ID} is too old; need 12+."
                exit 1
            fi
            log_ok "OS: ${PRETTY_NAME}"
            ;;
        *)
            log_warn "Untested OS: ${PRETTY_NAME:-unknown}. Proceeding but YMMV."
            ;;
    esac
}

ensure_ram() {
    local ram_mb
    ram_mb=$(awk '/MemTotal:/ {print int($2/1024)}' /proc/meminfo)
    if (( ram_mb < 1800 )); then
        if ! prompt_yesno "Low RAM" "Detected ${ram_mb} MB RAM — recommended minimum is 2 GB. Continue anyway?"; then
            exit 1
        fi
    else
        log_ok "RAM: ${ram_mb} MB"
    fi
}

ensure_disk() {
    local free_gb
    free_gb=$(df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}')
    if (( free_gb < 20 )); then
        log_warn "Free disk on /: ${free_gb} GB — recommended minimum is 20 GB."
    else
        log_ok "Free disk: ${free_gb} GB"
    fi
}

ensure_whiptail() {
    if command -v whiptail >/dev/null 2>&1; then
        log_ok "whiptail present"
        return
    fi
    log_info "Installing whiptail..."
    apt-get update -qq
    apt-get install -y whiptail
    # Reload prompts.sh state so HAS_WHIPTAIL flips
    HAS_WHIPTAIL=1
    log_ok "whiptail installed"
}

ensure_docker() {
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        log_ok "Docker + Compose v2 present ($(docker --version | awk '{print $3}' | tr -d ,))"
        return
    fi
    if [[ "${DOCKER_INSTALL:-1}" != "1" ]]; then
        log_error "Docker missing and --skip-docker was passed."
        exit 1
    fi
    log_info "Installing Docker via get.docker.com (this takes ~2 min)..."
    curl -fsSL https://get.docker.com | sh
    log_ok "Docker installed: $(docker --version)"
}

ensure_tools() {
    # Tools needed beyond Docker: openssl (secret gen), dig (DNS check), curl (already present)
    local missing=()
    for t in openssl dig; do
        command -v "$t" >/dev/null 2>&1 || missing+=("$t")
    done
    if (( ${#missing[@]} > 0 )); then
        log_info "Installing missing tools: ${missing[*]}"
        apt-get update -qq
        # 'dig' lives in dnsutils on Debian/Ubuntu
        local pkgs=()
        for t in "${missing[@]}"; do
            case "$t" in
                dig) pkgs+=("dnsutils") ;;
                *)   pkgs+=("$t") ;;
            esac
        done
        apt-get install -y "${pkgs[@]}"
    fi
    log_ok "openssl + dig present"
}

run_prerequisites() {
    log_step "Pre-flight checks"
    ensure_root
    ensure_os
    ensure_whiptail
    ensure_ram
    ensure_disk
    ensure_tools
    ensure_docker
}
