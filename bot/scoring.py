"""Cluster scoring.

score = source_count / (hours_since_last_source + 2) ** 1.5

Recent multi-source clusters score highest. Old clusters decay naturally.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _hours_since(dt: datetime | None) -> float:
    if dt is None:
        return 0.0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt
    return max(0.0, delta.total_seconds() / 3600.0)


def compute(source_count: int, last_source_added_at: datetime | None) -> float:
    if source_count <= 0:
        return 0.0
    h = _hours_since(last_source_added_at)
    return source_count / (h + 2) ** 1.5
