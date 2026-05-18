"""Topic relevance filter — regex compiled from `keywords` rows at startup.

Applied during RSS ingest: items without any keyword hit in title/summary
are dropped before insert (logged as 'off-topic'). No LLM cost.

Empty keyword list → filter is OFF (passes everything) with a warning.
"""
from __future__ import annotations

import logging
import re
from typing import Callable

logger = logging.getLogger(__name__)

RelevanceFn = Callable[..., bool]


def make_filter(keywords: list[dict]) -> RelevanceFn:
    """Returns `is_relevant(*texts) -> bool` compiled from keyword rows."""
    patterns: list[str] = []
    for kw in keywords:
        if kw.get("is_regex"):
            patterns.append(kw["pattern"])
        else:
            patterns.append(rf"\b{re.escape(kw['pattern'])}\b")

    if not patterns:
        logger.warning("relevance filter: 0 keywords — passing everything (likely a config bug)")
        return lambda *texts: True

    regex = re.compile("|".join(patterns), re.IGNORECASE | re.UNICODE)

    def is_relevant(*texts: str | None) -> bool:
        for t in texts:
            if t and regex.search(t):
                return True
        return False

    return is_relevant
