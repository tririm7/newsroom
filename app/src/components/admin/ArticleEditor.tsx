"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Article = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string;
  imageUrl: string | null;
  status: string;
  language: string;
};

export function ArticleEditor({ initial }: { initial: Article }) {
  const router = useRouter();
  const [a, setA] = useState<Article>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await fetch(`/api/admin/articles/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit",
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        contentHtml: a.contentHtml,
        imageUrl: a.imageUrl,
        status: a.status,
      }),
    });
    setSaving(false);
    if (!r.ok) {
      setMsg({ kind: "err", text: "Save failed: " + (await r.text()) });
      return;
    }
    setMsg({ kind: "ok", text: "Saved." });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this article?")) return;
    const r = await fetch(`/api/admin/articles/${a.id}`, { method: "DELETE" });
    if (r.ok) router.push("/admin/articles");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <label className="block text-sm">
          <span className="block font-medium mb-1">Title</span>
          <input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="block font-medium mb-1">Status</span>
          <select value={a.status} onChange={(e) => setA({ ...a, status: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
            <option value="published">published</option>
            <option value="draft">draft</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="block font-medium mb-1">Slug</span>
        <input value={a.slug} onChange={(e) => setA({ ...a, slug: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
        <span className="text-xs text-gray-500 block mt-1">
          URL: /{a.language}/article/<code>{a.slug}</code>
        </span>
      </label>

      <label className="block text-sm">
        <span className="block font-medium mb-1">Excerpt</span>
        <textarea value={a.excerpt ?? ""}
          onChange={(e) => setA({ ...a, excerpt: e.target.value })}
          rows={2}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
      </label>

      <label className="block text-sm">
        <span className="block font-medium mb-1">Content (HTML)</span>
        <textarea value={a.contentHtml}
          onChange={(e) => setA({ ...a, contentHtml: e.target.value })}
          rows={20}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
      </label>

      <label className="block text-sm">
        <span className="block font-medium mb-1">Image URL (optional)</span>
        <input value={a.imageUrl ?? ""}
          onChange={(e) => setA({ ...a, imageUrl: e.target.value || null })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
      </label>

      {msg && (
        <div className={"text-sm px-3 py-2 rounded " + (msg.kind === "ok"
          ? "bg-green-50 border border-green-200 text-green-700"
          : "bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={save} disabled={saving}
          className="bg-black text-white rounded px-3 py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <a href={`/${a.language}/article/${a.slug}`} target="_blank" rel="noopener noreferrer"
          className="border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-50">
          Preview ↗
        </a>
        <button onClick={remove} className="text-red-600 text-sm hover:underline ml-auto">
          Delete
        </button>
      </div>
    </div>
  );
}
