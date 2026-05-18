# Newsroom — bot image.
# Runs supercronic by default (used by bot-cron service).
# One-shot manual runs override CMD: `docker compose --profile manual run --rm bot python -m main_full`

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# supercronic — container-native cron (no fork, single binary).
ARG SUPERCRONIC_VERSION=v0.2.29
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
        x86_64)        sc_arch=amd64 ;; \
        aarch64|arm64) sc_arch=arm64 ;; \
        *) echo "Unsupported arch: $arch" && exit 1 ;; \
    esac; \
    curl -fsSLO "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${sc_arch}"; \
    chmod +x "supercronic-linux-${sc_arch}"; \
    mv "supercronic-linux-${sc_arch}" /usr/local/bin/supercronic

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["supercronic", "/app/crontab"]
