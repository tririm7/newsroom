"""LLM provider abstraction.

Eight providers in v0.2 — seven OpenAI-compatible plus Yandex (proprietary
adapter). All callers go through `generate(messages, ...)` and never import
a provider SDK directly.

  deepseek    https://api.deepseek.com/v1
  openai      https://api.openai.com/v1
  anthropic   https://api.anthropic.com/v1               (OpenAI-compat endpoint)
  gemini      https://generativelanguage.googleapis.com/v1beta/openai
  grok        https://api.x.ai/v1
  yandex      <special adapter — Yandex GPT proprietary>
  openrouter  https://openrouter.ai/api/v1
  custom      <user-provided base URL>

Switching providers is one env-var change (`LLM_PROVIDER`) plus a model
name (`LLM_MODEL`) and a key (`LLM_API_KEY`). For `custom` set
`LLM_BASE_URL` too. For Yandex set `LLM_MODEL` to "<folder_id>/<model>"
e.g. "b1g123abc/yandexgpt-latest".
"""
from __future__ import annotations

import logging
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
    # "custom" reads settings.LLM_BASE_URL
}


def get_client() -> Any:
    """Return an OpenAI-shaped client for the configured provider.

    For Yandex this is a hand-rolled adapter with the same `.chat.completions.create()`
    method signature; callers can't tell the difference.
    """
    provider = settings.LLM_PROVIDER
    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError(
            f"Unknown LLM_PROVIDER={provider!r}. "
            f"Expected one of: {', '.join(SUPPORTED_PROVIDERS)}."
        )
    if not settings.LLM_API_KEY:
        raise RuntimeError(
            f"LLM_API_KEY is not set (LLM_PROVIDER={provider}). "
            f"Set it in .env or via the admin /admin/settings page."
        )

    if provider == "yandex":
        return YandexClient(api_key=settings.LLM_API_KEY)

    if provider == "custom":
        base_url = settings.LLM_BASE_URL.strip()
        if not base_url:
            raise RuntimeError(
                "LLM_BASE_URL is required when LLM_PROVIDER=custom "
                "(your own OpenAI-compatible endpoint URL)."
            )
    else:
        base_url = PROVIDER_BASE_URLS[provider]

    return OpenAI(api_key=settings.LLM_API_KEY, base_url=base_url)


def generate(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> str:
    """Send messages to the configured provider, return assistant text.

    `messages` follows the OpenAI Chat Completions shape:
        [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
    """
    client = get_client()
    resp = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    content = resp.choices[0].message.content
    if not content:
        raise RuntimeError(
            f"LLM ({settings.LLM_PROVIDER}/{settings.LLM_MODEL}) returned empty content."
        )
    logger.info(
        "llm.generate: provider=%s model=%s response_len=%d",
        settings.LLM_PROVIDER, settings.LLM_MODEL, len(content),
    )
    return content
