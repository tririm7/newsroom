from rss_discovery import extract_links_from_html


def test_extract_rss_link():
    html = """
    <html><head>
        <link rel="alternate" type="application/rss+xml" href="/feed/" title="RSS">
    </head></html>
    """
    feeds = extract_links_from_html(html, "https://example.com/")
    assert len(feeds) == 1
    assert feeds[0]["url"] == "https://example.com/feed/"
    assert feeds[0]["type"] == "rss"
    assert feeds[0]["title"] == "RSS"


def test_extract_atom_link():
    html = '<link rel="alternate" type="application/atom+xml" href="https://example.com/atom.xml">'
    feeds = extract_links_from_html(html, "https://example.com/")
    assert len(feeds) == 1
    assert feeds[0]["type"] == "atom"


def test_extract_multiple_feeds():
    html = """
        <link rel="alternate" type="application/rss+xml" href="/feed/rss/" title="Main RSS">
        <link rel="alternate" type="application/atom+xml" href="/feed/atom/" title="Main Atom">
        <link rel="alternate" type="application/rss+xml" href="/comments/feed/" title="Comments">
    """
    feeds = extract_links_from_html(html, "https://example.com")
    assert len(feeds) == 3


def test_ignores_non_feed_alternates():
    html = """
        <link rel="alternate" type="text/html" hreflang="es" href="/es/">
        <link rel="alternate" type="application/rss+xml" href="/feed.xml">
    """
    feeds = extract_links_from_html(html, "https://example.com")
    assert len(feeds) == 1
    assert feeds[0]["url"] == "https://example.com/feed.xml"


def test_dedup_same_url():
    html = """
        <link rel="alternate" type="application/rss+xml" href="/feed/">
        <link rel="alternate" type="application/rss+xml" href="/feed/">
    """
    feeds = extract_links_from_html(html, "https://example.com")
    assert len(feeds) == 1


def test_empty_html_no_feeds():
    assert extract_links_from_html("<html></html>", "https://example.com") == []
