#!/usr/bin/env bash
# Interactive wizard. Collects answers, writes to $ANSWERS_FILE.
# Assumes lib/colors.sh, lib/prompts.sh, lib/validators.sh are sourced.

set -euo pipefail

ANSWERS_FILE=${ANSWERS_FILE:-/tmp/newsroom-wizard.env}

run_wizard() {
    log_step "Welcome"
    prompt_msgbox "Newsroom installer" \
"Welcome to Newsroom. Setup takes 20-30 minutes.

You'll need:
  - A domain pointed at this server (or 'localhost' for local-only)
  - An Anthropic API key (sk-ant-...)
  - 5 minutes to answer questions"

    # --- Domain ---
    log_step "Domain"
    local domain server_ip
    while :; do
        domain=$(prompt_input "Domain" "Enter your site domain (e.g. news.example.com).\n\nFor local-only deployments enter: localhost" "localhost")
        if [[ "$domain" == "localhost" ]] || validate_domain "$domain"; then
            break
        fi
        prompt_msgbox "Invalid domain" "'$domain' is not a valid domain."
    done

    if [[ "$domain" != "localhost" ]]; then
        server_ip=$(detect_public_ip)
        if [[ -n "$server_ip" ]] && check_dns_resolves "$domain" "$server_ip"; then
            log_ok "DNS A-record for $domain points at this server ($server_ip)"
        else
            if ! prompt_yesno "DNS not configured" \
"$domain does not currently resolve to this server ($server_ip).

Installation will proceed but Let's Encrypt won't issue a TLS cert until DNS is fixed. Continue?"; then
                log_error "Aborting. Fix the A-record and re-run with: ./install.sh --resume"
                exit 1
            fi
        fi
    fi

    # --- Language ---
    log_step "Site language"
    local locale
    locale=$(prompt_menu "Language" "Primary language for the site (UI + generated articles):" \
        "ru" "Русский" \
        "en" "English" \
        "es" "Español")

    # --- Timezone ---
    log_step "Timezone"
    local tz_default tz
    case "$locale" in
        ru) tz_default="Europe/Moscow" ;;
        es) tz_default="Europe/Madrid" ;;
        *)  tz_default="America/New_York" ;;
    esac
    tz=$(prompt_input "Timezone" "IANA timezone (e.g. America/New_York, Europe/Moscow):" "$tz_default")

    # --- Site identity ---
    log_step "Site identity"
    local site_name site_desc
    site_name=$(prompt_input "Site name" "Site name (header + tab title):" "Newsroom")
    site_desc=$(prompt_input "Description" "Short SEO description (1-2 sentences):" "AI-curated news")

    # --- Branding ---
    log_step "Branding"
    local brand_color brand_suffix
    while :; do
        brand_color=$(prompt_input "Brand color" "Brand color (hex #rrggbb):" "#1e3a8a")
        validate_hex_color "$brand_color" && break
        prompt_msgbox "Invalid color" "'$brand_color' is not a valid hex color (#rrggbb)."
    done
    while :; do
        brand_suffix=$(prompt_input "Brand suffix" "Symbol in the colored box after site name (1-4 chars, e.g. \$, AI, ₿):" "AI")
        validate_brand_suffix "$brand_suffix" && break
        prompt_msgbox "Invalid suffix" "Must be 1-4 non-space characters."
    done

    # --- Preset ---
    log_step "Content preset"
    local preset
    preset=$(prompt_menu "Preset" "Starter pack of sources + keywords:" \
        "ai-news"  "AI news (OpenAI, Anthropic, MIT TR, Stratechery, ...)" \
        "business" "Business (Bloomberg, Reuters, WSJ, FT, CNBC, ...)" \
        "crypto"   "Crypto (CoinDesk, The Block, Decrypt, Cointelegraph, ...)" \
        "science"  "Science (Nature, Quanta, MIT TR, Ars Technica, ...)" \
        "custom"   "Custom (empty — fill in via admin)")

    # --- Admin password ---
    log_step "Admin account"
    local admin_pw admin_pw_confirm
    while :; do
        admin_pw=$(prompt_password "Admin password" "Pick a password for the admin user (min 12 chars):")
        if ! validate_password_strength "$admin_pw"; then
            prompt_msgbox "Too short" "Password must be at least 12 characters."
            continue
        fi
        admin_pw_confirm=$(prompt_password "Confirm password" "Type it again:")
        if [[ "$admin_pw" != "$admin_pw_confirm" ]]; then
            prompt_msgbox "Mismatch" "Passwords don't match."
            continue
        fi
        break
    done

    # --- Anthropic key ---
    log_step "Anthropic API key"
    local api_key
    while :; do
        api_key=$(prompt_password "Anthropic API key" "Anthropic API key (sk-ant-...):")
        if validate_anthropic_key "$api_key"; then
            break
        fi
        if prompt_yesno "Invalid key format" \
"'$(echo "$api_key" | cut -c1-12)...' does not match the expected sk-ant-... format.

Continue anyway? (Bot can't write articles until a valid key is set.)"; then
            break
        fi
    done

    # --- Summary ---
    log_step "Summary"
    local addr
    if [[ "$domain" == "localhost" ]]; then
        addr="localhost (HTTP)"
    else
        addr="$domain (auto-TLS)"
    fi
    if ! prompt_yesno "Review" \
"Address:  $addr
Language: $locale
Timezone: $tz
Site:     $site_name
Brand:    $brand_color, suffix '$brand_suffix'
Preset:   $preset

Start installation?"; then
        log_error "Aborted by user."
        exit 1
    fi

    # --- Persist ---
    umask 077
    {
        printf 'WIZ_DOMAIN=%q\n'         "$domain"
        printf 'WIZ_LOCALE=%q\n'         "$locale"
        printf 'WIZ_TIMEZONE=%q\n'       "$tz"
        printf 'WIZ_SITE_NAME=%q\n'      "$site_name"
        printf 'WIZ_SITE_DESC=%q\n'      "$site_desc"
        printf 'WIZ_BRAND_COLOR=%q\n'    "$brand_color"
        printf 'WIZ_BRAND_SUFFIX=%q\n'   "$brand_suffix"
        printf 'WIZ_PRESET=%q\n'         "$preset"
        printf 'WIZ_ADMIN_PASSWORD=%q\n' "$admin_pw"
        printf 'WIZ_ANTHROPIC_KEY=%q\n'  "$api_key"
    } > "$ANSWERS_FILE"
    log_ok "Wizard complete. Answers stored at $ANSWERS_FILE (mode 0600)."
}
