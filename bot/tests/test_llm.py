"""LLM dispatch tests. Real provider SDKs are mocked — we verify routing
(provider → base URL) and the generate() wrapper's response handling.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

import llm
import settings


@pytest.fixture(autouse=True)
def reset_settings(monkeypatch):
    """Default settings for tests; each test overrides as needed."""
    monkeypatch.setattr(settings, "LLM_PROVIDER", "deepseek")
    monkeypatch.setattr(settings, "LLM_MODEL", "deepseek-chat")
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "LLM_BASE_URL", "")


def test_supported_providers_list():
    assert set(llm.SUPPORTED_PROVIDERS) == {
        "deepseek", "openai", "anthropic", "gemini", "grok",
        "yandex", "openrouter", "custom",
    }


def test_unknown_provider_raises(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "totally-fake")
    with pytest.raises(ValueError, match="Unknown LLM_PROVIDER"):
        llm.get_client()


def test_empty_api_key_raises(monkeypatch):
    monkeypatch.setattr(settings, "LLM_API_KEY", "")
    with pytest.raises(RuntimeError, match="LLM_API_KEY is not set"):
        llm.get_client()


@pytest.mark.parametrize("provider,expected_base", [
    ("deepseek",   "https://api.deepseek.com/v1"),
    ("openai",     "https://api.openai.com/v1"),
    ("anthropic",  "https://api.anthropic.com/v1"),
    ("gemini",     "https://generativelanguage.googleapis.com/v1beta/openai"),
    ("grok",       "https://api.x.ai/v1"),
    ("openrouter", "https://openrouter.ai/api/v1"),
])
def test_openai_compat_providers_use_correct_base_url(monkeypatch, provider, expected_base):
    monkeypatch.setattr(settings, "LLM_PROVIDER", provider)
    captured = {}

    def fake_openai(api_key, base_url):
        captured["api_key"] = api_key
        captured["base_url"] = base_url
        return MagicMock()

    with patch.object(llm, "OpenAI", side_effect=fake_openai):
        llm.get_client()

    assert captured["base_url"] == expected_base
    assert captured["api_key"] == "sk-test"


def test_yandex_returns_yandex_client(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "yandex")
    monkeypatch.setattr(settings, "LLM_API_KEY", "y-test-key")
    client = llm.get_client()
    # YandexClient mimics openai.OpenAI's surface
    assert hasattr(client, "chat")
    assert hasattr(client.chat, "completions")
    assert hasattr(client.chat.completions, "create")


def test_custom_provider_requires_base_url(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "custom")
    monkeypatch.setattr(settings, "LLM_BASE_URL", "")
    with pytest.raises(RuntimeError, match="LLM_BASE_URL is required"):
        llm.get_client()


def test_custom_provider_uses_user_base_url(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "custom")
    monkeypatch.setattr(settings, "LLM_BASE_URL", "https://my-llm.example.com/v1")
    captured = {}

    def fake_openai(api_key, base_url):
        captured["base_url"] = base_url
        return MagicMock()

    with patch.object(llm, "OpenAI", side_effect=fake_openai):
        llm.get_client()

    assert captured["base_url"] == "https://my-llm.example.com/v1"


def _make_response(text: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))],
    )


def test_generate_returns_assistant_content(monkeypatch):
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_response("hello world")

    with patch.object(llm, "get_client", return_value=fake_client):
        out = llm.generate(messages=[{"role": "user", "content": "ping"}])

    assert out == "hello world"
    call_kwargs = fake_client.chat.completions.create.call_args.kwargs
    assert call_kwargs["model"] == "deepseek-chat"
    assert call_kwargs["messages"] == [{"role": "user", "content": "ping"}]
    assert call_kwargs["max_tokens"] == 2000


def test_generate_raises_on_empty_content(monkeypatch):
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_response("")

    with patch.object(llm, "get_client", return_value=fake_client):
        with pytest.raises(RuntimeError, match="empty content"):
            llm.generate(messages=[{"role": "user", "content": "ping"}])


def test_generate_passes_custom_max_tokens_and_temperature(monkeypatch):
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = _make_response("ok")

    with patch.object(llm, "get_client", return_value=fake_client):
        llm.generate(
            messages=[{"role": "user", "content": "x"}],
            max_tokens=4096,
            temperature=0.5,
        )

    call_kwargs = fake_client.chat.completions.create.call_args.kwargs
    assert call_kwargs["max_tokens"] == 4096
    assert call_kwargs["temperature"] == 0.5
