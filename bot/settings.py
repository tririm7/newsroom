"""Newsroom bot — env-driven config + constants.

Project-specific knobs (article_min_sources, max_news_age_hours, ...) live in
the `projects` DB row and override these constants per-deploy when loaded.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Project slug — Newsroom Open always uses 'newsroom' (single-tenant).
# Layer 2 SaaS may set this per-instance.
PROJECT_SLUG = os.environ.get("PROJECT_SLUG", "newsroom")

# Claude models. Cluster runs frequently → cheap model. Article writes are rare → strong model.
CLAUDE_MODEL_CLUSTER = os.environ.get("CLAUDE_MODEL_CLUSTER", "claude-haiku-4-5-20251001")
CLAUDE_MODEL_WRITE = os.environ.get("CLAUDE_MODEL_WRITE", "claude-sonnet-4-6")


def require_runtime_env() -> None:
    """Loud early failure when essential env is missing."""
    missing = [k for k in ["DATABASE_URL"] if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")
