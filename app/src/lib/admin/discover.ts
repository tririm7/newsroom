/**
 * RSS / Atom feed discovery for a given domain. TypeScript port of
 * bot/rss_discovery.py so the admin "Add source by domain" endpoint
 * doesn't need to shell out into the bot container.
 */

const USER_AGENT = "Newsroom Bot/0.1 (+https://github.com/tririm7/newsroom)";

const COMMON_PATHS = [
  "/feed", "/feed/", "/rss", "/rss.xml", "/atom.xml",
  "/feed.atom", "/index.xml", "/feeds/posts/default",
];

const LINK_TAG = /<link\b[^>]*>/gi;
const REL_ALT = /rel\s*=\s*["']alternate["']/i;
const HREF = /href\s*=\s*["']([^"']+)["']/i;
const TYPE = /type\s*=\s*["']([^"']+)["']/i;
const TITLE = /title\s*=\s*["']([^"']*)["']/i;

export type DiscoveredFeed = { url: string; type: "rss" | "atom"; title: string | null };

function feedType(mime: string): "rss" | "atom" | null {
  const m = mime.toLowerCase();
  if (m.includes("atom")) return "atom";
  if (m.includes("rss") || m.includes("rdf")) return "rss";
  return null;
}

export function extractLinksFromHtml(html: string, baseUrl: string): DiscoveredFeed[] {
  const found: DiscoveredFeed[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(LINK_TAG)) {
    const tag = m[0];
    if (!REL_ALT.test(tag)) continue;
    const typeM = TYPE.exec(tag);
    const hrefM = HREF.exec(tag);
    if (!typeM || !hrefM) continue;
    const ft = feedType(typeM[1]);
    if (!ft) continue;
    let url: string;
    try {
      url = new URL(hrefM[1], baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    const titleM = TITLE.exec(tag);
    found.push({ url, type: ft, title: titleM ? titleM[1] : null });
  }
  return found;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: ac.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function discoverFeeds(domain: string): Promise<DiscoveredFeed[]> {
  const base = domain.startsWith("http") ? domain : `https://${domain}`;

  const resp = await fetchWithTimeout(base, 10_000);
  if (resp?.ok) {
    const html = await resp.text();
    const found = extractLinksFromHtml(html, resp.url);
    if (found.length > 0) return found;
  }

  // Fallback: probe common feed paths
  for (const path of COMMON_PATHS) {
    let probeUrl: string;
    try {
      probeUrl = new URL(path, base).toString();
    } catch {
      continue;
    }
    const r = await fetchWithTimeout(probeUrl, 5_000);
    if (!r?.ok) continue;
    const text = await r.text();
    const head = text.trim().slice(0, 200).toLowerCase();
    if (head.startsWith("<?xml") || head.includes("<rss") || head.includes("<feed")) {
      return [{
        url: r.url,
        type: head.includes("<feed") ? "atom" : "rss",
        title: null,
      }];
    }
  }
  return [];
}
