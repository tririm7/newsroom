"""LLM provider abstraction.

Eight providers in v0.2 — seven OpenAI-compatible plus Yandex (proprietary
adapter). All callers go through `generate(messages, config=...)` and never
import a provider SDK directly.

  deepseek    https://api.deepseek.com/v1
  openai      https://api.openai.com/v1
  anthropic   https://api.anthropic.com/v1               (OpenAI-compat endpoint)
  gemini      https://generativelanguage.googleapis.com/v1beta/openai
  grok        https://api.x.ai/v1
  yandex      <special adapter — Yandex GPT proprietary>
  openrouter  https://openrouter.ai/api/v1
  custom      <user-provided base URL>

Provider config comes from the DB (`projects` row, loaded once per bot
run) — that's where the admin saves changes. `.env`'s LLM_* vars are
fallback only, used on first install before seed runs.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from openai import OpenAI

import settings
from llm_yandex import YandexClient

logger = logging.getLogger(__name__)

SUPPORTED_PROVIDERS: tuple[str, ...] = (
    "deepseek", "openai", "anthropic", "gemini", "grok",
    "yandex", "openrouter", "custom",
)

PROVIDER_BASE_URLS: dict[str, str] = {
    "deepseek":   "https://api.deepseek.com/v1",
    "openai":     "https://api.openai.com/v1",
    "anthropic":  "https://api.anthropic.com/v1",
    "gemini":     "https://generativelanguage.googleapis.com/v1beta/openai",
    "grok":       "https://api.x.ai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    # "yandex" handled by YandexClient (separate adapter)
    # "custom" reads config.base_url
}


@dataclass
class LLMConfig:
    """Provider config for a single generate() call."""
    provider: str
    model: str
    api_key: str
    base_url: str = ""

    def __post_init__(self) -> None:
        if self.provider not in SUPPORTED_PROVIDERS:
            raise ValueError(
                f"Unknown provider={self.provider!r}. "
                f"Expected one of: {', '.join(SUPPORTED_PROVIDERS)}."
            )
        if not self.api_key:
            raise RuntimeError(
                f"LLM api_key is empty (provider={self.provider}). "
                f"Set it in /admin/settings or via the LLM_API_KEY env var."
            )
        if self.provider == "custom" and not self.base_url:
            raise RuntimeError(
                "base_url is required when provider=custom "
                "(your own OpenAI-compatible endpoint URL)."
            )


def from_settings() -> LLMConfig:
    """Build config from .env / process env. Bootstrap-time fallback."""
    return LLMConfig(
        provider=settings.LLM_PROVIDER,
        model=settings.LLM_MODEL,
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL or "",
    )


def from_project(project: dict[str, Any]) -> LLMConfig:
    """Build config from a loaded `projects` row. DB is the source of truth.

    Falls back to env LLM_API_KEY only when DB column is empty (e.g. fresh
    install before user pasted a key via /admin/settings).
    """
    return LLMConfig(
        provider=project["llm_provider"],
        model=project["llm_model"],
        api_key=project.get("llm_api_key") or settings.LLM_API_KEY,
        base_url=project.get("llm_base_url") or "",
    )


def get_client(config: LLMConfig | None = None) -> Any:
    """Return an OpenAI-shaped client for the configured provider.

    For Yandex this is a hand-rolled adapter with the same
    `.chat.completions.create()` method signature; callers can't tell.
    """
    if config is None:
        config = from_settings()

    if config.provider == "yandex":
        return YandexClient(api_key=config.api_key)

    if config.provider == "custom":
        base_url = config.base_url
    else:
        base_url = PROVIDER_BASE_URLS[config.provider]

    return OpenAI(api_key=config.api_key, base_url=base_url)


def generate(
    messages: list[dict[str, str]],
    *,
    config: LLMConfig | None = None,
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> str:
    """Send messages to the configured provider, return assistant text.

    `messages` follows the OpenAI Chat Completions shape:
        [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
    """
    if config is None:
        config = from_settings()

    client = get_client(config)
    resp = client.chat.completions.create(
        model=config.model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    content = resp.choices[0].message.content
    if not content:
        raise RuntimeError(
            f"LLM ({config.provider}/{config.model}) returned empty content."
        )
    logger.info(
        "llm.generate: provider=%s model=%s response_len=%d",
        config.provider, config.model, len(content),
    )
    return content
