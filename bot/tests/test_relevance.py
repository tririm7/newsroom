from relevance import make_filter


def test_empty_keywords_passes_all():
    f = make_filter([])
    assert f("anything") is True
    assert f("", "") is True


def test_substring_word_boundary():
    f = make_filter([{"pattern": "AI", "is_regex": False}])
    assert f("New AI breakthrough") is True
    assert f("Genai release") is False
    assert f("Wait what") is False


def test_case_insensitive():
    f = make_filter([{"pattern": "Nvidia", "is_regex": False}])
    assert f("NVIDIA earnings") is True
    assert f("nvidia stock") is True


def test_any_text_arg_matches():
    f = make_filter([{"pattern": "Claude", "is_regex": False}])
    assert f("Apple earnings", "Anthropic releases Claude 4") is True
    assert f("Apple earnings", None) is False


def test_regex_pattern():
    f = make_filter([{"pattern": r"GPT-?\d+", "is_regex": True}])
    assert f("New GPT4 model") is True
    assert f("GPT-5 leaked") is True
    assert f("just GPT") is False


def test_multiple_keywords_OR():
    f = make_filter([
        {"pattern": "AI", "is_regex": False},
        {"pattern": "crypto", "is_regex": False},
    ])
    assert f("AI news today") is True
    assert f("crypto market") is True
    assert f("housing market") is False
