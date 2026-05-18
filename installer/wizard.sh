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

    # --- LLM provider ---
    log_step "LLM provider"
    # Language-aware default — surface a provider that works in the user's region.
    local default_provider
    case "$locale" in
        ru) default_provider="deepseek" ;;
        es) default_provider="gemini" ;;
        *)  default_provider="openai" ;;
    esac
    prompt_msgbox "LLM provider" \
"The bot uses an LLM to cluster RSS items and write articles. Newsroom supports 8 providers — pick one based on your region and budget.

For language '$locale' the typical default is: $default_provider.
You can change provider any time via /admin/settings."

    local llm_provider llm_default_model
    llm_provider=$(prompt_menu "Provider" "Pick an LLM provider:" \
        "deepseek"   "DeepSeek (cheap, works in RU/CN)  — \$0.30/\$0.50 per M tokens" \
        "openai"     "OpenAI GPT (\"ChatGPT\")          — not RU/CN" \
        "anthropic"  "Anthropic Claude (premium)         — not RU/CN" \
        "gemini"     "Google Gemini                       — not RU/CN" \
        "grok"       "xAI Grok                            — not sanctioned regions" \
        "yandex"     "Yandex GPT (RU local)               — RU only" \
        "openrouter" "OpenRouter (gateway, any model)     — works everywhere" \
        "custom"     "Custom — your OpenAI-compatible endpoint")

    case "$llm_provider" in
        deepseek)   llm_default_model="deepseek-chat" ;;
        openai)     llm_default_model="gpt-4o" ;;
        anthropic)  llm_default_model="claude-sonnet-4-6" ;;
        gemini)     llm_default_model="gemini-2.5-flash" ;;
        grok)       llm_default_model="grok-2-latest" ;;
        yandex)     llm_default_model="b1g_REPLACE_FOLDER/yandexgpt-latest" ;;
        openrouter) llm_default_model="anthropic/claude-sonnet-4.6" ;;
        custom)     llm_default_model="" ;;
    esac

    local llm_disclosure
    case "$llm_provider" in
        deepseek)
            llm_disclosure="⚠ Chinese provider — data processed in CN under their laws. Not for confidential data. Cheapest option."
            ;;
        openai)
            llm_disclosure="✓ Industry standard. Data in US/EU. Does NOT work from RU/CN without VPN."
            ;;
        anthropic)
            llm_disclosure="✓ Premium text quality. Pricey. Does NOT work from RU/CN without VPN."
            ;;
        gemini)
            llm_disclosure="✓ Google infra. Good price/quality. Does NOT work from RU/CN without VPN."
            ;;
        grok)
            llm_disclosure="✓ From xAI (Musk). Strong for tech news."
            ;;
        yandex)
            llm_disclosure="✓ Russian provider, local jurisdiction. Only useful for the RU market."
            ;;
        openrouter)
            llm_disclosure="✓ Gateway: pick any model from 100+. Markup on each call. Works from any region the provider does."
            ;;
        custom)
            llm_disclosure="⚠ Your own OpenAI-compatible endpoint. You vouch for it."
            ;;
    esac
    prompt_msgbox "About $llm_provider" "$llm_disclosure

Setup guide: docs/PROVIDERS.md → $llm_provider"

    local llm_model llm_api_key llm_base_url
    llm_model=$(prompt_input "Model" "LLM model name (Yandex: '<folder_id>/<model>'):" "$llm_default_model")

    while :; do
        llm_api_key=$(prompt_password "API key" "${llm_provider^} API key (we'll store this in the DB, never displayed in plaintext to users):")
        if [[ -n "$llm_api_key" ]]; then
            break
        fi
        if prompt_yesno "No key entered" \
"You entered an empty API key. The bot won't be able to generate articles without one.

You can paste it later via /admin/settings. Continue anyway?"; then
            break
        fi
    done

    llm_base_url=""
    if [[ "$llm_provider" == "custom" ]]; then
        llm_base_url=$(prompt_input "Base URL" "Endpoint URL (must be OpenAI-Chat-Completions compatible):" "")
    fi

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
LLM:      $llm_provider / $llm_model

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
        printf 'WIZ_LLM_PROVIDER=%q\n'   "$llm_provider"
        printf 'WIZ_LLM_MODEL=%q\n'      "$llm_model"
        printf 'WIZ_LLM_API_KEY=%q\n'    "$llm_api_key"
        printf 'WIZ_LLM_BASE_URL=%q\n'   "$llm_base_url"
    } > "$ANSWERS_FILE"
    log_ok "Wizard complete. Answers stored at $ANSWERS_FILE (mode 0600)."
}
