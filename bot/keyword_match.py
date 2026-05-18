"""Token-based similarity (Jaccard) for fast-mode matching.

Strategy: every cluster keeps a token-bag (union of tokens from its items'
titles + cluster headline). A new item's tokens get Jaccard-compared to each
bag; the best match above threshold (default 0.7) wins. No LLM cost.

For matches below threshold, the item stays unclustered and waits for the
full pipeline (which uses Claude clustering on the leftover batch).
"""
from __future__ import annotations

import re

# Minimal RU + EN stopwords. Extend when noise shows up in tests.
STOPWORDS: frozenset[str] = frozenset({
    # EN — 2-char stopwords
    "is", "as", "at", "by", "or", "to", "it", "if", "on", "no", "we", "me",
    "up", "us", "do", "in", "of", "an", "be", "he",
    # EN — 3+ char stopwords
    "the", "and", "for", "with", "from", "this", "that", "have", "has", "are",
    "was", "will", "but", "not", "now", "all", "any", "can", "may", "out",
    "you", "your", "our", "its", "their", "they", "she", "him", "his", "her",
    "into", "over", "more", "most", "less", "than", "then", "when", "what",
    "who", "why", "how", "where", "which", "while", "about", "after", "before",
    "since", "between", "among", "without", "within", "during", "through",
    "against", "would", "could", "should", "must", "shall", "been", "being",
    "were",
    # RU
    "что", "это", "для", "как", "при", "под", "над", "без", "или", "так",
    "уже", "тут", "там", "был", "была", "были", "быть", "есть", "его", "её",
    "их", "она", "они", "оно", "тот", "тех", "том", "ним", "ней", "них",
    "ему", "ей", "им", "от", "до", "по", "из", "за", "со", "на", "не", "ни",
    "же", "ли", "бы", "вот", "если", "когда", "также", "очень", "ещё",
    "после", "перед", "против", "между", "будет", "будут", "может", "могут",
    "должен", "должна", "должны", "более", "менее", "самый", "свой", "наш",
    "ваш", "этот", "эта", "эти",
    # ES
    "el", "la", "los", "las", "de", "que", "en", "un", "una", "con", "por",
    "para", "sin", "como", "más", "menos", "ser", "ha", "han", "del", "al",
})

_TOKEN_RE = re.compile(r"[^\w]+", re.UNICODE)


def tokenize(text: str | None) -> set[str]:
    if not text:
        return set()
    parts = _TOKEN_RE.split(text.lower())
    return {p for p in parts if len(p) >= 2 and p not in STOPWORDS}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = a & b
    if not inter:
        return 0.0
    return len(inter) / len(a | b)


def best_match(
    item_tokens: set[str],
    clusters_tokens: dict[int, set[str]],
    threshold: float = 0.7,
) -> tuple[int, float] | None:
    """Return (cluster_id, score) for best Jaccard ≥ threshold, else None."""
    if not item_tokens:
        return None
    best: tuple[int, float] | None = None
    for cid, ctoks in clusters_tokens.items():
        s = jaccard(item_tokens, ctoks)
        if s >= threshold and (best is None or s > best[1]):
            best = (cid, s)
    return best
