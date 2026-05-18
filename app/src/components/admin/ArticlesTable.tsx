"use client";

import { useState } from "react";

type Article = {
  id: number;
  slug: string;
  title: string;
  status: string;
  publishedAt: string | null;
  isManual: boolean;
  language: string;
};

export function ArticlesTable({ initial }: { initial: Article[] }) {
  const [rows, setRows] = useState<Article[]>(initial);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: number) {
    setError(null);
    const r = await fetch(`/api/admin/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_status" }),
    });
    if (!r.ok) { setError("Toggle failed: " + (await r.text())); return; }
    const data = (await r.json()) as { status: string };
    setRows(rows.map((x) => x.id === id ? { ...x, status: data.status } : x));
  }

  async function remove(id: number) {
    if (!confirm("Delete this article permanently?")) return;
    setError(null);
    const r = await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    if (!r.ok) { setError("Delete failed: " + (await r.text())); return; }
    setRows(rows.filter((x) => x.id !== id));
  }

  return (
    <div>
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-300">
            <th className="py-2 pr-2 w-44">Published</th>
            <th className="py-2 pr-2">Title</th>
            <th className="py-2 pr-2 w-20">Status</th>
            <th className="py-2 pr-2 w-12">Lang</th>
            <th className="py-2 w-44">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-gray-100">
              <td className="py-2 pr-2 text-gray-500 text-xs">
                {a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 16).replace("T", " ") : "—"}
              </td>
              <td className="py-2 pr-2">
                <a href={`/${a.language}/article/${a.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                  {a.title}
                </a>
                {a.isManual && <span className="ml-2 text-xs text-blue-600">(manual)</span>}
              </td>
              <td className="py-2 pr-2">
                <span className={a.status === "published" ? "text-green-600" : "text-gray-500"}>
                  {a.status}
                </span>
              </td>
              <td className="py-2 pr-2 text-gray-500">{a.language}</td>
              <td className="py-2 text-xs">
                <a href={`/admin/articles/${a.id}`} className="text-blue-600 hover:underline mr-3">edit</a>
                <button onClick={() => toggle(a.id)} className="text-gray-700 hover:underline mr-3">
                  {a.status === "published" ? "→ draft" : "→ publish"}
                </button>
                <button onClick={() => remove(a.id)} className="text-red-600 hover:underline">delete</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="py-4 text-center text-gray-500">No articles yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
