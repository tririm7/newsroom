from jsonparse import parse_lenient


def test_plain_json():
    assert parse_lenient('{"a": 1, "b": [2, 3]}') == {"a": 1, "b": [2, 3]}


def test_markdown_fence_with_json_tag():
    text = '```json\n{"x": "y"}\n```'
    assert parse_lenient(text) == {"x": "y"}


def test_markdown_fence_without_tag():
    text = '```\n{"x": "y"}\n```'
    assert parse_lenient(text) == {"x": "y"}


def test_trailing_comma_repaired():
    assert parse_lenient('{"a": 1, "b": 2,}') == {"a": 1, "b": 2}


def test_leading_whitespace_ok():
    assert parse_lenient('  \n  {"k": 1}\n') == {"k": 1}
