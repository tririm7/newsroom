"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Page = {
  id?: number;
  slug: string;
  title: string;
  locale: string;
  contentHtml: string;
  isPublished: boolean;
  footerPosition: number | null;
};

export function StaticPageEditor({ initial, locales }: {
  initial: Page; locales: string[];
}) {
  const router = useRouter();
  const [p, setP] = useState<Page>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const payload = {
      slug: p.slug.trim(),
      title: p.title.trim(),
      locale: p.locale,
      contentHtml: p.contentHtml,
      contentMarkdown: p.contentHtml,  // v0.1 stores HTML as both
      isPublished: p.isPublished,
      footerPosition: p.footerPosition,
    };
    const isNew = !p.id;
    const url = isNew ? "/api/admin/pages" : `/api/admin/pages/${p.id}`;
    const method = isNew ? "POST" : "PATCH";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!r.ok) {
      setMsg({ kind: "err", text: "Save failed: " + (await r.text()) });
      return;
    }
    setMsg({ kind: "ok", text: "Saved." });
    if (isNew) {
      const j = await r.json();
      router.push(`/admin/pages/${j.id}`);
    } else {
      router.refresh();
    }
  }

  async function remove() {
    if (!p.id) return;
    if (!confirm("Delete this page?")) return;
    const r = await fetch(`/api/admin/pages/${p.id}`, { method: "DELETE" });
    if (r.ok) router.push("/admin/pages");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block font-medium mb-1">Slug (URL after /[locale]/)</span>
          <input value={p.slug} onChange={(e) => setP({ ...p, slug: e.target.value })}
            placeholder="about" className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
        </label>
        <label className="block text-sm">
          <span className="block font-medium mb-1">Locale</span>
          <select value={p.locale} onChange={(e) => setP({ ...p, locale: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
            {locales.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="block font-medium mb-1">Title</span>
        <input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
      </label>

      <label className="block text-sm">
        <span className="block font-medium mb-1">Content (HTML)</span>
        <textarea value={p.contentHtml} onChange={(e) => setP({ ...p, contentHtml: e.target.value })}
          rows={16}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
        <span className="text-xs text-gray-500 block mt-1">
          Paste raw HTML. <code>&lt;p&gt;</code>, <code>&lt;h2&gt;</code>, <code>&lt;ul&gt;</code>, <code>&lt;a&gt;</code> all render on the public side.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block font-medium mb-1">Footer position (blank = not in footer)</span>
          <input
            type="number"
            min={0}
            value={p.footerPosition ?? ""}
            onChange={(e) => setP({ ...p, footerPosition: e.target.value === "" ? null : Number(e.target.value) })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-sm flex items-end gap-2">
          <input type="checkbox" checked={p.isPublished}
            onChange={(e) => setP({ ...p, isPublished: e.target.checked })} />
          <span>Published (visible to readers)</span>
        </label>
      </div>

      {msg && (
        <div className={"text-sm px-3 py-2 rounded " + (msg.kind === "ok"
          ? "bg-green-50 border border-green-200 text-green-700"
          : "bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={save} disabled={saving}
          className="bg-black text-white rounded px-3 py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? "Saving…" : (p.id ? "Save" : "Create")}
        </button>
        {p.id && (
          <button onClick={remove} className="text-red-600 text-sm hover:underline ml-auto">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
