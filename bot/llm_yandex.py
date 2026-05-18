"""Yandex GPT adapter — mimics `openai.OpenAI`'s `.chat.completions.create()`
shape so `bot/llm.py` can dispatch uniformly.

Auth: Api-Key (folder-scoped service-account key), not IAM token.
Get one at https://console.cloud.yandex.ru/folders/<folder>/iam.

Model URI: Yandex requires "gpt://<folder_id>/<model>" in the request body.
We encode this in `LLM_MODEL` as "<folder_id>/<model>" — e.g.
"b1g123abc/yandexgpt-latest" — and split on "/" inside the adapter.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests

YANDEX_API = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


@dataclass
class _Message:
    role: str
    content: str


@dataclass
class _Choice:
    message: _Message


@dataclass
class _Response:
    choices: list[_Choice]


class _Completions:
    def __init__(self, api_key: str) -> None:
        self._key = api_key

    def create(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        max_tokens: int = 2000,
        temperature: float = 0.7,
        **_: Any,
    ) -> _Response:
        if "/" not in model:
            raise ValueError(
                "Yandex LLM_MODEL must be '<folder_id>/<model>' "
                "(e.g. 'b1g123abc/yandexgpt-latest'); got: " + repr(model)
            )
        folder_id, model_name = model.split("/", 1)
        model_uri = f"gpt://{folder_id}/{model_name}"

        # Yandex uses "text" instead of "content" on each message.
        yandex_messages = [
            {"role": m["role"], "text": m["content"]}
            for m in messages
        ]

        body = {
            "modelUri": model_uri,
            "completionOptions": {
                "temperature": temperature,
                "maxTokens": str(max_tokens),  # Yandex wants string
                "stream": False,
            },
            "messages": yandex_messages,
        }

        resp = requests.post(
            YANDEX_API,
            headers={"Authorization": f"Api-Key {self._key}"},
            json=body,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["result"]["alternatives"][0]["message"]["text"]
        return _Response(choices=[_Choice(message=_Message(role="assistant", content=text))])


class _Chat:
    def __init__(self, api_key: str) -> None:
        self.completions = _Completions(api_key)


class YandexClient:
    """Thin OpenAI-shaped wrapper over Yandex GPT.

    Usage matches openai.OpenAI:
        client = YandexClient(api_key="<api-key>")
        resp = client.chat.completions.create(
            model="<folder>/yandexgpt-latest",
            messages=[{"role": "user", "content": "..."}],
            max_tokens=2000,
            temperature=0.7,
        )
        text = resp.choices[0].message.content
    """

    def __init__(self, api_key: str) -> None:
        self.chat = _Chat(api_key)
