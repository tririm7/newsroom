#!/usr/bin/env bash
# Input validators. Each returns 0/1; callers use them in `if`.

validate_domain() {
    [[ "$1" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]
}

validate_hex_color() {
    [[ "$1" =~ ^#[0-9a-fA-F]{6}$ ]]
}

validate_password_strength() {
    # min 12 chars
    [[ ${#1} -ge 12 ]]
}

validate_anthropic_key() {
    [[ "$1" =~ ^sk-ant-[A-Za-z0-9_-]{20,}$ ]]
}

validate_brand_suffix() {
    # 1-4 non-space characters
    local s=$1
    [[ -n "$s" ]] && [[ ${#s} -le 4 ]] && [[ ! "$s" =~ [[:space:]] ]]
}

detect_public_ip() {
    curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null \
        || curl -fsS --max-time 5 https://icanhazip.com 2>/dev/null \
        || hostname -I 2>/dev/null | awk '{print $1}' \
        || echo ""
}

check_dns_resolves() {
    # $1 = domain, $2 = expected IP
    local resolved
    if ! command -v dig >/dev/null 2>&1; then
        return 1
    fi
    resolved=$(dig @1.1.1.1 +short +time=3 +tries=1 "$1" 2>/dev/null | tail -n1)
    [[ "$resolved" == "$2" ]]
}
