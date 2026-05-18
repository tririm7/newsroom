"use client";

import { useState, useTransition } from "react";

type Keyword = {
  id: number;
  pattern: string;
  category: string;
  isRegex: boolean;
  isActive: boolean;
};

export function KeywordsTable({ initial }: { initial: Keyword[] }) {
  const [rows, setRows] = useState<Keyword[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [addPattern, setAddPattern] = useState("");
  const [addCategory, setAddCategory] = useState("general");
  const [addRegex, setAddRegex] = useState(false);

  async function refresh() {
    const r = await fetch("/api/admin/keywords");
    if (r.ok) setRows(await r.json());
  }

  async function add() {
    setError(null);
    if (!addPattern.trim()) { setError("Pattern required."); return; }
    const r = await fetch("/api/admin/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern: addPattern.trim(),
        category: addCategory.trim() || "general",
        isRegex: addRegex,
        isActive: true,
      }),
    });
    if (!r.ok) { setError("Add failed: " + (await r.text())); return; }
    setAddPattern("");
    startTransition(() => { refresh(); });
  }

  async function toggle(k: Keyword) {
    await fetch(`/api/admin/keywords/${k.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !k.isActive }),
    });
    setRows(rows.map((x) => x.id === k.id ? { ...x, isActive: !x.isActive } : x));
  }

  async function remove(id: number) {
    if (!confirm("Delete this keyword?")) return;
    const r = await fetch(`/api/admin/keywords/${id}`, { method: "DELETE" });
    if (r.ok) setRows(rows.filter((x) => x.id !== id));
  }

  // Group by category for display
  const byCategory = rows.reduce<Record<string, Keyword[]>>((acc, k) => {
    (acc[k.category] = acc[k.category] || []).push(k);
    return acc;
  }, {});

  return (
    <div>
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
      )}

      <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-white">
        <h2 className="font-semibold mb-2">Add keyword</h2>
        <div className="grid grid-cols-[1fr_140px_auto_auto] gap-2 items-center">
          <input
            value={addPattern}
            onChange={(e) => setAddPattern(e.target.value)}
            placeholder="Pattern (word or regex)"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            value={addCategory}
            onChange={(e) => setAddCategory(e.target.value)}
            placeholder="Category"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={addRegex} onChange={(e) => setAddRegex(e.target.checked)} />
            regex
          </label>
          <button onClick={add} className="bg-black text-white rounded px-3 py-1 text-sm font-semibold">Add</button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Substring matches use word boundaries (<code>\b{`{pattern}`}\b</code>). Regex matches the pattern as-is.
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(byCategory).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">{category} <span className="text-gray-400">({items.length})</span></h3>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {items.map((k) => (
                  <tr key={k.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2 font-mono">{k.pattern}</td>
                    <td className="py-1.5 pr-2 w-20 text-xs text-gray-500">{k.isRegex ? "regex" : "substring"}</td>
                    <td className="py-1.5 pr-2 w-20">
                      <button onClick={() => toggle(k)} className="text-xs">
                        {k.isActive ? "🟢 on" : "⚪ off"}
                      </button>
                    </td>
                    <td className="py-1.5 w-16">
                      <button onClick={() => remove(k.id)} className="text-xs text-red-600 hover:underline">delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {rows.length === 0 && <div className="text-center text-gray-500 py-8">No keywords yet.</div>}
      </div>
      {pending && <div className="text-xs text-gray-500 mt-2">Refreshing…</div>}
    </div>
  );
}
