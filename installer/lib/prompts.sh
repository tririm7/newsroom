#!/usr/bin/env bash
# whiptail wrappers with fallback to plain read prompts.
# Each function echoes the user's answer to stdout (or sets exit code for yesno).

if command -v whiptail >/dev/null 2>&1; then
    HAS_WHIPTAIL=1
else
    HAS_WHIPTAIL=0
fi

prompt_msgbox() {
    # $1 = title, $2 = body
    if [[ $HAS_WHIPTAIL == 1 ]]; then
        whiptail --title "$1" --msgbox "$2" 16 76
    else
        printf "\n---- %s ----\n%s\n" "$1" "$2"
        read -rp "Press Enter to continue..." _
    fi
}

prompt_yesno() {
    # $1 = title, $2 = body. Returns 0 (yes) or non-zero (no).
    if [[ $HAS_WHIPTAIL == 1 ]]; then
        whiptail --title "$1" --yesno "$2" 14 76
    else
        local ans
        read -rp "$2 [y/N]: " ans
        [[ "$ans" =~ ^[Yy] ]]
    fi
}

prompt_input() {
    # $1 = title, $2 = body, $3 = default. Echoes answer.
    local default=${3:-}
    if [[ $HAS_WHIPTAIL == 1 ]]; then
        whiptail --title "$1" --inputbox "$2" 12 76 "$default" 3>&1 1>&2 2>&3
    else
        local ans
        read -rp "$2 [$default]: " ans
        printf '%s' "${ans:-$default}"
    fi
}

prompt_password() {
    # $1 = title, $2 = body. Echoes the password.
    if [[ $HAS_WHIPTAIL == 1 ]]; then
        whiptail --title "$1" --passwordbox "$2" 12 76 3>&1 1>&2 2>&3
    else
        local ans
        read -rsp "$2: " ans
        printf '\n' >&2
        printf '%s' "$ans"
    fi
}

prompt_menu() {
    # $1 = title, $2 = body, then pairs: key1 desc1 key2 desc2 ...
    # Echoes the chosen key.
    local title=$1 body=$2
    shift 2
    if [[ $HAS_WHIPTAIL == 1 ]]; then
        whiptail --title "$title" --menu "$body" 20 78 8 "$@" 3>&1 1>&2 2>&3
    else
        printf '%s\n' "$body" >&2
        local i=1 keys=()
        while (( $# > 0 )); do
            keys+=("$1")
            printf "  %s) %s — %s\n" "$i" "$1" "$2" >&2
            shift 2
            ((i++))
        done
        local choice
        read -rp "Choose [1-$((i-1))]: " choice
        printf '%s' "${keys[$((choice-1))]}"
    fi
}
