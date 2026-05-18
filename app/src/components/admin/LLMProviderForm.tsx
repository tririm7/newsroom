"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PROVIDERS = [
  { id: "deepseek",   label: "DeepSeek",         defaultModel: "deepseek-chat",
    note: "Chinese provider — data processed in CN. Cheapest. Works in RU/CN.",
    getKeyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "openai",     label: "OpenAI (ChatGPT)", defaultModel: "gpt-4o",
    note: "Industry standard. Does NOT work from RU/CN without VPN.",
    getKeyUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic",  label: "Anthropic Claude", defaultModel: "claude-sonnet-4-6",
    note: "Premium text quality. Does NOT work from RU/CN without VPN.",
    getKeyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "gemini",     label: "Google Gemini",    defaultModel: "gemini-2.5-flash",
    note: "Google infra. Good price/quality. Does NOT work from RU/CN.",
    getKeyUrl: "https://aistudio.google.com/apikey" },
  { id: "grok",       label: "xAI Grok",         defaultModel: "grok-2-latest",
    note: "From xAI. Strong for tech news.",
    getKeyUrl: "https://console.x.ai/" },
  { id: "yandex",     label: "Yandex GPT",       defaultModel: "<folder_id>/yandexgpt-latest",
    note: "Russian provider, local jurisdiction. Only useful for the RU market. Model must be '<folder_id>/<model>'.",
    getKeyUrl: "https://console.cloud.yandex.ru/folders" },
  { id: "openrouter", label: "OpenRouter",       defaultModel: "anthropic/claude-sonnet-4.6",
    note: "Gateway: pick any model from 100+. Markup on each call. Works from any region the underlying provider does.",
    getKeyUrl: "https://openrouter.ai/keys" },
  { id: "custom",     label: "Custom",           defaultModel: "",
    note: "Your own OpenAI-compatible endpoint.",
    getKeyUrl: null },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

type Props = {
  current: {
    provider: ProviderId;
    model: string;
    baseUrl: string | null;
    hasApiKey: boolean;
  };
};

export function LLMProviderForm({ current }: Props) {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderId>(current.provider);
  const [model, setModel] = useState(current.model);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(current.baseUrl ?? "");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean; error?: string; sampleResponse?: string; durationMs?: number;
  } | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const meta = PROVIDERS.find((p) => p.id === provider)!;

  function handleProviderChange(next: ProviderId) {
    setProvider(next);
    const m = PROVIDERS.find((p) => p.id === next)!;
    setModel(m.defaultModel);
    setTestResult(null);
    setSaveMsg(null);
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setSaveMsg(null);
    const r = await fetch("/api/admin/llm/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider, model, apiKey,
        baseUrl: provider === "custom" ? baseUrl : null,
      }),
    });
    setTesting(false);
    if (!r.ok) {
      setTestResult({ ok: false, error: await r.text() });
      return;
    }
    setTestResult(await r.json());
  }

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    const r = await fetch("/api/admin/llm/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider, model,
        // Empty string here means "don't change the stored key"
        apiKey: apiKey || "",
        baseUrl: provider === "custom" ? baseUrl : null,
      }),
    });
    setSaving(false);
    if (!r.ok) {
      setSaveMsg({ kind: "err", text: "Save failed: " + (await r.text()) });
      return;
    }
    const j = await r.json();
    setSaveMsg({ kind: "ok", text: j.note || "Saved." });
    setApiKey("");
    router.refresh();
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white max-w-3xl space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block font-medium mb-1">Provider</span>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="block font-medium mb-1">Model</span>
          <input value={model} onChange={(e) => setModel(e.target.value)}
            placeholder={meta.defaultModel}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
        </label>
      </div>

      <label className="block text-sm">
        <span className="block font-medium mb-1 flex items-center justify-between">
          <span>
            API key
            {current.hasApiKey && (
              <span className="ml-2 text-xs text-gray-500 font-normal">
                (stored — leave empty to keep current)
              </span>
            )}
          </span>
          <button type="button" onClick={() => setShowKey((s) => !s)}
            className="text-xs text-blue-600 hover:underline">
            {showKey ? "hide" : "show"}
          </button>
        </span>
        <input
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={current.hasApiKey ? "••••••••••••" : "Paste your API key"}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
        />
        {meta.getKeyUrl && (
          <span className="text-xs text-gray-500 block mt-1">
            Get one at: <a href={meta.getKeyUrl} target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline">{meta.getKeyUrl}</a>
          </span>
        )}
      </label>

      {provider === "custom" && (
        <label className="block text-sm">
          <span className="block font-medium mb-1">Base URL (OpenAI-compatible endpoint)</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://my-llm.example.com/v1"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono" />
        </label>
      )}

      <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded text-sm">
        <span className="font-medium">Note:</span> {meta.note}
      </div>

      {testResult && (
        <div className={"text-sm px-3 py-2 rounded " + (testResult.ok
          ? "bg-green-50 border border-green-200 text-green-800"
          : "bg-red-50 border border-red-200 text-red-700")}>
          {testResult.ok ? (
            <div>
              ✓ Connection OK
              {testResult.durationMs ? ` (${testResult.durationMs}ms)` : ""}
              {testResult.sampleResponse && (
                <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-40">
                  {testResult.sampleResponse}
                </pre>
              )}
            </div>
          ) : (
            <div>
              ✗ {testResult.error}
              {testResult.durationMs ? ` (${testResult.durationMs}ms)` : ""}
            </div>
          )}
        </div>
      )}

      {saveMsg && (
        <div className={"text-sm px-3 py-2 rounded " + (saveMsg.kind === "ok"
          ? "bg-green-50 border border-green-200 text-green-700"
          : "bg-red-50 border border-red-200 text-red-700")}>{saveMsg.text}</div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={runTest}
          disabled={testing || !apiKey}
          title={apiKey ? "" : "Paste an API key first"}
          className="border border-gray-300 rounded px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="bg-black text-white rounded px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
