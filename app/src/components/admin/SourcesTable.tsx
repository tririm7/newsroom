"use client";

import { useState, useTransition } from "react";

type Source = {
  id: number;
  name: string;
  url: string;
  type: string;
  language: string;
  tier: number;
  isActive: boolean;
};

type DiscoveredFeed = { url: string; type: "rss" | "atom"; title: string | null };

export function SourcesTable({ initial }: { initial: Source[] }) {
  const [sources, setSources] = useState<Source[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Add by URL form
  const [addUrl, setAddUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [addLanguage, setAddLanguage] = useState("en");

  // Discover by domain
  const [discoverDomain, setDiscoverDomain] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredFeed[]>([]);

  async function refresh() {
    const r = await fetch("/api/admin/sources");
    if (r.ok) setSources(await r.json());
  }

  async function addByUrl() {
    setError(null);
    if (!addUrl || !addName) {
      setError("Name and URL are required.");
      return;
    }
    const r = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addName, url: addUrl, type: "rss",
        language: addLanguage, tier: 3, isActive: true,
      }),
    });
    if (!r.ok) {
      setError("Add failed: " + (await r.text()));
      return;
    }
    setAddUrl(""); setAddName("");
    startTransition(() => { refresh(); });
  }

  async function runDiscover() {
    setError(null);
    setDiscovered([]);
    if (!discoverDomain) return;
    const r = await fetch("/api/admin/sources/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: discoverDomain }),
    });
    if (!r.ok) {
      setError("Discover failed: " + (await r.text()));
      return;
    }
    setDiscovered(await r.json());
  }

  async function adoptDiscovered(feed: DiscoveredFeed) {
    setError(null);
    const r = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: feed.title || new URL(feed.url).hostname,
        url: feed.url,
        type: feed.type,
        language: "en",
        tier: 3,
        isActive: true,
      }),
    });
    if (!r.ok) {
      setError("Add failed: " + (await r.text()));
      return;
    }
    setDiscovered(discovered.filter((f) => f.url !== feed.url));
    startTransition(() => { refresh(); });
  }

  async function toggleActive(s: Source) {
    await fetch(`/api/admin/sources/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    setSources(sources.map((x) => x.id === s.id ? { ...x, isActive: !x.isActive } : x));
  }

  async function remove(id: number) {
    if (!confirm("Delete this source? Items already ingested stay.")) return;
    const r = await fetch(`/api/admin/sources/${id}`, { method: "DELETE" });
    if (r.ok) setSources(sources.filter((x) => x.id !== id));
  }

  return (
    <div>
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
      )}

      {/* Discover by domain */}
      <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
        <h2 className="font-semibold mb-2">Discover feeds by domain</h2>
        <div className="flex gap-2">
          <input
            value={discoverDomain}
            onChange={(e) => setDiscoverDomain(e.target.value)}
            placeholder="example.com"
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <button
            onClick={runDiscover}
            className="bg-black text-white rounded px-3 py-1 text-sm font-semibold"
          >
            Discover
          </button>
        </div>
        {discovered.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {discovered.map((f) => (
              <li key={f.url} className="flex justify-between items-center gap-2">
                <span>
                  <span className="text-xs uppercase text-gray-500 mr-2">[{f.type}]</span>
                  {f.title ? <span className="font-medium">{f.title}</span> : null}{" "}
                  <span className="text-gray-500">{f.url}</span>
                </span>
                <button onClick={() => adoptDiscovered(f)} className="text-xs text-blue-600 hover:underline">
                  + Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add by direct URL */}
      <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-white">
        <h2 className="font-semibold mb-2">Add source by URL</h2>
        <div className="grid grid-cols-[1fr_1fr_80px_auto] gap-2">
          <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Display name" className="border border-gray-300 rounded px-2 py-1 text-sm" />
          <input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="https://example.com/feed" className="border border-gray-300 rounded px-2 py-1 text-sm" />
          <select value={addLanguage} onChange={(e) => setAddLanguage(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
            <option value="en">en</option>
            <option value="ru">ru</option>
            <option value="es">es</option>
          </select>
          <button onClick={addByUrl} className="bg-black text-white rounded px-3 py-1 text-sm font-semibold">Add</button>
        </div>
      </div>

      {/* Sources table */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-300">
            <th className="py-2 pr-2">Name</th>
            <th className="py-2 pr-2">URL</th>
            <th className="py-2 pr-2 w-16">Lang</th>
            <th className="py-2 pr-2 w-16">Tier</th>
            <th className="py-2 pr-2 w-20">Active</th>
            <th className="py-2 w-16">—</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id} className="border-b border-gray-100">
              <td className="py-2 pr-2 font-medium">{s.name}</td>
              <td className="py-2 pr-2 text-gray-600 truncate max-w-md">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.url}</a>
              </td>
              <td className="py-2 pr-2">{s.language}</td>
              <td className="py-2 pr-2">{s.tier}</td>
              <td className="py-2 pr-2">
                <button onClick={() => toggleActive(s)} className="text-xs">
                  {s.isActive ? "🟢 on" : "⚪ off"}
                </button>
              </td>
              <td className="py-2">
                <button onClick={() => remove(s.id)} className="text-xs text-red-600 hover:underline">delete</button>
              </td>
            </tr>
          ))}
          {sources.length === 0 && (
            <tr><td colSpan={6} className="py-4 text-center text-gray-500">No sources yet.</td></tr>
          )}
        </tbody>
      </table>
      {pending && <div className="text-xs text-gray-500 mt-2">Refreshing…</div>}
    </div>
  );
}
