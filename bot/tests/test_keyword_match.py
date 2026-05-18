from keyword_match import best_match, jaccard, tokenize


def test_tokenize_drops_short_and_stopwords():
    toks = tokenize("The OpenAI release is a big deal")
    assert "openai" in toks
    assert "release" in toks
    assert "big" in toks
    assert "deal" in toks
    assert "the" not in toks
    assert "is" not in toks
    assert "a" not in toks


def test_tokenize_empty():
    assert tokenize("") == set()
    assert tokenize(None) == set()


def test_tokenize_russian():
    toks = tokenize("Anthropic выпустил новую модель Claude")
    assert "anthropic" in toks
    assert "claude" in toks
    assert "новую" in toks
    assert "модель" in toks


def test_jaccard_identical():
    assert jaccard({"a", "b", "c"}, {"a", "b", "c"}) == 1.0


def test_jaccard_disjoint():
    assert jaccard({"a"}, {"b"}) == 0.0


def test_jaccard_empty():
    assert jaccard(set(), {"a"}) == 0.0
    assert jaccard({"a"}, set()) == 0.0


def test_best_match_returns_above_threshold():
    bags = {
        1: {"openai", "release", "gpt", "model"},
        2: {"crypto", "bitcoin", "ethereum"},
    }
    item_toks = {"openai", "release", "gpt"}
    m = best_match(item_toks, bags, threshold=0.5)
    assert m is not None
    assert m[0] == 1
    assert m[1] >= 0.5


def test_best_match_returns_none_below_threshold():
    bags = {1: {"crypto", "bitcoin", "blockchain"}}
    item_toks = {"openai", "release"}
    assert best_match(item_toks, bags, threshold=0.5) is None


def test_best_match_empty_item():
    assert best_match(set(), {1: {"a"}}) is None
