"""Yandex GPT adapter shape tests. HTTP is mocked — we verify the request
body shape (modelUri, completionOptions, message translation) and the
OpenAI-compatible response wrapping.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import llm_yandex


def _fake_yandex_resp(text: str = "ok"):
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = {
        "result": {
            "alternatives": [
                {"message": {"role": "assistant", "text": text}, "status": "ALTERNATIVE_STATUS_FINAL"},
            ],
            "usage": {"inputTextTokens": "10", "completionTokens": "5", "totalTokens": "15"},
            "modelVersion": "test",
        }
    }
    return resp


def test_yandex_client_has_openai_shape():
    c = llm_yandex.YandexClient(api_key="y-test")
    assert hasattr(c, "chat")
    assert hasattr(c.chat, "completions")
    assert hasattr(c.chat.completions, "create")


def test_yandex_create_translates_messages_and_returns_openai_shape():
    c = llm_yandex.YandexClient(api_key="y-test-key")

    with patch.object(llm_yandex, "requests") as mock_requests:
        mock_requests.post.return_value = _fake_yandex_resp("hello from yandex")
        resp = c.chat.completions.create(
            model="b1g123abc/yandexgpt-latest",
            messages=[
                {"role": "system", "content": "be brief"},
                {"role": "user", "content": "hi"},
            ],
            max_tokens=500,
            temperature=0.4,
        )

    # OpenAI-shaped response
    assert resp.choices[0].message.role == "assistant"
    assert resp.choices[0].message.content == "hello from yandex"

    # Request shape
    call = mock_requests.post.call_args
    assert call.args[0] == llm_yandex.YANDEX_API
    assert call.kwargs["headers"]["Authorization"] == "Api-Key y-test-key"
    body = call.kwargs["json"]
    assert body["modelUri"] == "gpt://b1g123abc/yandexgpt-latest"
    assert body["completionOptions"]["temperature"] == 0.4
    assert body["completionOptions"]["maxTokens"] == "500"  # Yandex wants string
    assert body["completionOptions"]["stream"] is False
    # Messages translated: "content" → "text"
    assert body["messages"] == [
        {"role": "system", "text": "be brief"},
        {"role": "user", "text": "hi"},
    ]


def test_yandex_rejects_model_without_folder_prefix():
    c = llm_yandex.YandexClient(api_key="y-test")
    with pytest.raises(ValueError, match="<folder_id>/<model>"):
        c.chat.completions.create(
            model="yandexgpt-latest",
            messages=[{"role": "user", "content": "x"}],
        )


def test_yandex_propagates_http_error():
    import requests as _req
    c = llm_yandex.YandexClient(api_key="y-test")

    bad_resp = MagicMock()
    bad_resp.raise_for_status.side_effect = _req.exceptions.HTTPError("401")

    with patch.object(llm_yandex, "requests") as mock_requests:
        mock_requests.post.return_value = bad_resp
        mock_requests.exceptions = _req.exceptions
        with pytest.raises(_req.exceptions.HTTPError):
            c.chat.completions.create(
                model="b1g1/yandexgpt-latest",
                messages=[{"role": "user", "content": "x"}],
            )
