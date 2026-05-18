from datetime import datetime, timedelta, timezone

from scoring import compute


def test_zero_sources_zero_score():
    assert compute(0, datetime.now(timezone.utc)) == 0.0


def test_none_timestamp_treated_as_fresh():
    s = compute(3, None)
    assert s > 0.5


def test_recent_beats_old_same_source_count():
    recent = compute(5, datetime.now(timezone.utc))
    older = compute(5, datetime.now(timezone.utc) - timedelta(hours=12))
    assert recent > older


def test_more_sources_beat_fewer_same_age():
    now = datetime.now(timezone.utc)
    assert compute(5, now) > compute(2, now)


def test_naive_datetime_handled():
    naive = datetime.utcnow()
    assert compute(2, naive) > 0
