"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Project = {
  name: string;
  description: string | null;
  brandName: string;
  brandSuffix: string;
  brandColor: string;
  brandColorHover: string | null;
  primaryLocale: string;
  timezone: string;
  articleMinSources: number;
  maxNewsAgeHours: number;
  clusterInactivityHours: number;
  ingestionCron: string;
  generationCron: string;
  autoPublish: boolean;
};

export function ProjectSettingsForm({ initial, locales }: {
  initial: Project; locales: string[];
}) {
  const router = useRouter();
  const [p, setP] = useState<Project>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await fetch("/api/admin/settings/project", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    setSaving(false);
    if (!r.ok) {
      setMsg({ kind: "err", text: "Save failed: " + (await r.text()) });
      return;
    }
    setMsg({ kind: "ok", text: "Saved. Some changes (cron, locale) need `docker compose restart bot-cron app` to take effect." });
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <fieldset className="space-y-3 border border-gray-200 rounded-lg p-4 bg-white">
        <legend className="text-sm font-medium px-1">Identity</legend>
        <label className="block text-sm">
          <span className="block font-medium mb-1">Site name</span>
          <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="block font-medium mb-1">SEO description</span>
          <textarea value={p.description ?? ""} onChange={(e) => setP({ ...p, description: e.target.value || null })}
            rows={2}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
        </label>
      </fieldset>

      <fieldset className="space-y-3 border border-gray-200 rounded-lg p-4 bg-white">
        <legend className="text-sm font-medium px-1">Branding</legend>
        <div className="grid grid-cols-[1fr_120px_120px] gap-3">
          <label className="block text-sm">
            <span className="block font-medium mb-1">Brand name (header)</span>
            <input value={p.brandName} onChange={(e) => setP({ ...p, brandName: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">Suffix (1-4 chars)</span>
            <input value={p.brandSuffix} maxLength={4}
              onChange={(e) => setP({ ...p, brandSuffix: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">Color</span>
            <input type="color" value={p.brandColor}
              onChange={(e) => setP({ ...p, brandColor: e.target.value })}
              className="w-full h-7 border border-gray-300 rounded" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border border-gray-200 rounded-lg p-4 bg-white">
        <legend className="text-sm font-medium px-1">Locale & timezone</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="block font-medium mb-1">Primary locale</span>
            <select value={p.primaryLocale} onChange={(e) => setP({ ...p, primaryLocale: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
              {locales.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">Timezone (IANA)</span>
            <input value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border border-gray-200 rounded-lg p-4 bg-white">
        <legend className="text-sm font-medium px-1">Pipeline thresholds</legend>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="block font-medium mb-1">Article min sources</span>
            <input type="number" min={1} max={10} value={p.articleMinSources}
              onChange={(e) => setP({ ...p, articleMinSources: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">Max news age (h)</span>
            <input type="number" min={1} value={p.maxNewsAgeHours}
              onChange={(e) => setP({ ...p, maxNewsAgeHours: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="block font-medium mb-1">Cluster idle deactivate (h)</span>
            <input type="number" min={1} value={p.clusterInactivityHours}
              onChange={(e) => setP({ ...p, clusterInactivityHours: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
          </label>
        </div>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={p.autoPublish}
            onChange={(e) => setP({ ...p, autoPublish: e.target.checked })} />
          Auto-publish articles (when off, articles land as drafts)
        </label>
      </fieldset>

      <fieldset className="space-y-3 border border-gray-200 rounded-lg p-4 bg-white">
        <legend className="text-sm font-medium px-1">Cron (supercronic syntax — restart bot-cron after edit)</legend>
        <label className="block text-sm">
          <span className="block font-medium mb-1">Ingestion (main_fast)</span>
          <input value={p.ingestionCron} onChange={(e) => setP({ ...p, ingestionCron: e.target.value })}
            placeholder="*/5 * * * *"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
        </label>
        <label className="block text-sm">
          <span className="block font-medium mb-1">Full pipeline (main_full)</span>
          <input value={p.generationCron} onChange={(e) => setP({ ...p, generationCron: e.target.value })}
            placeholder="15,45 * * * *"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
        </label>
        <p className="text-xs text-gray-500">
          Stored in DB. Actual schedule is read by supercronic from
          <code className="bg-gray-100 px-1 mx-1 rounded">crontab.template</code> on container start —
          updating the schedule via this form persists the intent; rewrite of the
          crontab file + bot-cron restart lands in v0.2.
        </p>
      </fieldset>

      {msg && (
        <div className={"text-sm px-3 py-2 rounded " + (msg.kind === "ok"
          ? "bg-green-50 border border-green-200 text-green-700"
          : "bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>
      )}

      <button onClick={save} disabled={saving}
        className="bg-black text-white rounded px-3 py-2 text-sm font-semibold disabled:opacity-50">
        {saving ? "Saving…" : "Save project settings"}
      </button>
    </div>
  );
}
