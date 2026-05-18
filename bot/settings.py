"""Newsroom bot — env-driven config.

LLM provider config (v0.2): one provider per project, configured via env.
Most providers share the OpenAI Chat Completions wire format — `bot/llm.py`
dispatches to the right base URL. Yandex GPT uses a thin adapter
(`bot/llm_yandex.py`) that mimics the OpenAI SDK shape.

See docs/PROVIDERS.md for setup steps per provider.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# LLM provider config. One of:
#   deepseek | openai | anthropic | gemini | grok | yandex | openrouter | custom
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "deepseek")
LLM_MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")

# Only used when LLM_PROVIDER=custom (your own OpenAI-compatible endpoint).
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")

# Project slug — Newsroom Open always uses 'newsroom' (single-tenant).
PROJECT_SLUG = os.environ.get("PROJECT_SLUG", "newsroom")


def require_runtime_env() -> None:
    """Loud early failure when essential env is missing."""
    missing = [k for k in ["DATABASE_URL"] if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")
