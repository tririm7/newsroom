"""Lenient JSON parser for Claude responses.

Steps:
  1. Strip markdown fence (```json ... ```)
  2. Strict json.loads
  3. Fallback to json_repair.loads (forgiving — fixes trailing commas, broken
     strings, unescaped quotes inside strings, etc.)
"""
from __future__ import annotations

import json
import logging
from typing import Any

from json_repair import loads as repair_loads

logger = logging.getLogger(__name__)


def parse_lenient(text: str) -> Any:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning(
            "strict json.loads failed (%s), falling back to json-repair (text_len=%d)",
            exc, len(text),
        )
        return repair_loads(text)
