"use client";

import Link from "next/link";
import { useState } from "react";

type Page = {
  id: number;
  slug: string;
  title: string;
  locale: string;
  isPublished: boolean;
  footerPosition: number | null;
};

export function StaticPagesTable({ initial }: { initial: Page[] }) {
  const [rows, setRows] = useState<Page[]>(initial);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: number) {
    if (!confirm("Delete this page?")) return;
    setError(null);
    const r = await fetch(`/api/admin/pages/${id}`, { method: "DELETE" });
    if (!r.ok) { setError("Delete failed: " + (await r.text())); return; }
    setRows(rows.filter((x) => x.id !== id));
  }

  async function togglePublished(p: Page) {
    setError(null);
    const r = await fetch(`/api/admin/pages/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !p.isPublished }),
    });
    if (!r.ok) { setError("Toggle failed: " + (await r.text())); return; }
    setRows(rows.map((x) => x.id === p.id ? { ...x, isPublished: !x.isPublished } : x));
  }

  return (
    <div>
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
      )}

      <div className="mb-4">
        <Link href="/admin/pages/new" className="bg-black text-white rounded px-3 py-1.5 text-sm font-semibold">
          + New page
        </Link>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-300">
            <th className="py-2 pr-2 w-32">Slug</th>
            <th className="py-2 pr-2">Title</th>
            <th className="py-2 pr-2 w-16">Locale</th>
            <th className="py-2 pr-2 w-24">Published</th>
            <th className="py-2 pr-2 w-20">Footer</th>
            <th className="py-2 w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-gray-100">
              <td className="py-2 pr-2 font-mono text-xs">{p.slug}</td>
              <td className="py-2 pr-2 font-medium">{p.title}</td>
              <td className="py-2 pr-2 text-gray-500">{p.locale}</td>
              <td className="py-2 pr-2">
                <button onClick={() => togglePublished(p)} className="text-xs">
                  {p.isPublished ? "🟢 yes" : "⚪ no"}
                </button>
              </td>
              <td className="py-2 pr-2 text-xs text-gray-500">
                {p.footerPosition !== null ? `#${p.footerPosition}` : "—"}
              </td>
              <td className="py-2 text-xs">
                <Link href={`/admin/pages/${p.id}`} className="text-blue-600 hover:underline mr-3">edit</Link>
                <button onClick={() => remove(p.id)} className="text-red-600 hover:underline">delete</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="py-4 text-center text-gray-500">No pages yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
