"use client";

import { useState } from "react";

type Cluster = {
  id: number;
  headline: string;
  description: string | null;
  sourceCount: number;
  score: number;
  isActive: boolean;
  lastSourceAddedAt: string;
  articleId: number | null;
  articleSlug: string | null;
};

export function ClustersTable({ initial }: { initial: Cluster[] }) {
  const [rows, setRows] = useState<Cluster[]>(initial);
  const [error, setError] = useState<string | null>(null);

  async function setActive(c: Cluster, active: boolean) {
    setError(null);
    const r = await fetch(`/api/admin/clusters/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: active }),
    });
    if (!r.ok) { setError("Update failed: " + (await r.text())); return; }
    setRows(rows.map((x) => x.id === c.id ? { ...x, isActive: active } : x));
  }

  const active = rows.filter((c) => c.isActive);
  const inactive = rows.filter((c) => !c.isActive);

  return (
    <div>
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
      )}

      <h2 className="text-sm font-medium text-gray-700 mb-2">Active ({active.length})</h2>
      <ClusterList rows={active} setActive={setActive} />

      {inactive.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm font-medium text-gray-700 mb-2 cursor-pointer">Deactivated ({inactive.length})</summary>
          <div className="mt-3">
            <ClusterList rows={inactive} setActive={setActive} />
          </div>
        </details>
      )}
    </div>
  );
}

function ClusterList({ rows, setActive }: {
  rows: Cluster[];
  setActive: (c: Cluster, active: boolean) => void;
}) {
  if (rows.length === 0) return <div className="text-center text-gray-500 py-6">None.</div>;
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-300">
          <th className="py-2 pr-2">Headline</th>
          <th className="py-2 pr-2 w-16">Sources</th>
          <th className="py-2 pr-2 w-16">Score</th>
          <th className="py-2 pr-2 w-32">Last item</th>
          <th className="py-2 pr-2 w-28">Article</th>
          <th className="py-2 w-28">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-gray-100">
            <td className="py-2 pr-2">
              <div className="font-medium">{c.headline}</div>
              {c.description && <div className="text-xs text-gray-500 truncate max-w-md">{c.description}</div>}
            </td>
            <td className="py-2 pr-2 text-center">{c.sourceCount}</td>
            <td className="py-2 pr-2 text-center">{c.score.toFixed(2)}</td>
            <td className="py-2 pr-2 text-xs text-gray-500">{new Date(c.lastSourceAddedAt).toISOString().slice(0, 16).replace("T", " ")}</td>
            <td className="py-2 pr-2 text-xs">
              {c.articleSlug
                ? <a href={`/admin/articles`} className="text-blue-600 hover:underline">id={c.articleId}</a>
                : <span className="text-gray-400">—</span>}
            </td>
            <td className="py-2 text-xs">
              {c.isActive
                ? <button onClick={() => setActive(c, false)} className="text-red-600 hover:underline">deactivate</button>
                : <button onClick={() => setActive(c, true)} className="text-green-600 hover:underline">reactivate</button>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
