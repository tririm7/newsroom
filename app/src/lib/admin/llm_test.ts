/**
 * Server-side LLM "Test Connection" runner. Sends a clustering-shaped
 * request through whichever provider the admin has selected and reports
 * whether the round-trip works.
 *
 * Mirrors `bot/llm.py` + `bot/llm_yandex.py` so the test exercises the
 * exact wire format the bot will use.
 */
import "server-only";

import OpenAI from "openai";

export const SUPPORTED_PROVIDERS = [
  "deepseek", "openai", "anthropic", "gemini", "grok",
  "yandex", "openrouter", "custom",
] as const;
export type LLMProvider = (typeof SUPPORTED_PROVIDERS)[number];

export const PROVIDER_BASE_URLS: Record<Exclude<LLMProvider, "yandex" | "custom">, string> = {
  deepseek:   "https://api.deepseek.com/v1",
  openai:     "https://api.openai.com/v1",
  anthropic:  "https://api.anthropic.com/v1",
  gemini:     "https://generativelanguage.googleapis.com/v1beta/openai",
  grok:       "https://api.x.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const YANDEX_API = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

// A real clustering-shaped request — small enough to be cheap but matches
// what the bot actually sends. Avoids false negatives from "ping" tests.
const TEST_SYSTEM = `You are an editor of a thematic news feed. Reply with valid JSON only — no commentary, no markdown fences. Schema: {"groups": [{"item_ids": [int], "skip": bool}]}`;
const TEST_USER = JSON.stringify({
  new_items: [{ id: 1, title: "Test ping", summary: "", source: "Test" }],
  active_clusters: [],
});

export type TestResult = {
  ok: boolean;
  error?: string;
  sampleResponse?: string;
  durationMs?: number;
};

export async function testLLMConnection(opts: {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string | null;
}): Promise<TestResult> {
  if (!opts.apiKey) {
    return { ok: false, error: "API key is empty." };
  }
  const start = Date.now();
  try {
    if (opts.provider === "yandex") {
      return await testYandex({ model: opts.model, apiKey: opts.apiKey }, start);
    }

    let baseURL: string;
    if (opts.provider === "custom") {
      if (!opts.baseUrl) {
        return { ok: false, error: "Base URL required when provider=custom." };
      }
      baseURL = opts.baseUrl;
    } else {
      baseURL = PROVIDER_BASE_URLS[opts.provider];
    }

    const client = new OpenAI({ apiKey: opts.apiKey, baseURL });
    const resp = await client.chat.completions.create({
      model: opts.model,
      messages: [
        { role: "system", content: TEST_SYSTEM },
        { role: "user", content: TEST_USER },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });
    const text = resp.choices[0]?.message?.content ?? "";
    if (!text) {
      return {
        ok: false,
        error: "Provider returned empty content.",
        durationMs: Date.now() - start,
      };
    }
    return {
      ok: true,
      sampleResponse: text.slice(0, 300),
      durationMs: Date.now() - start,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, durationMs: Date.now() - start };
  }
}

async function testYandex(opts: { model: string; apiKey: string }, start: number): Promise<TestResult> {
  if (!opts.model.includes("/")) {
    return {
      ok: false,
      error: "Yandex model must be '<folder_id>/<model>', e.g. 'b1g123/yandexgpt-latest'.",
    };
  }
  const [folder, modelName] = opts.model.split("/", 2);
  const body = {
    modelUri: `gpt://${folder}/${modelName}`,
    completionOptions: { temperature: 0.3, maxTokens: "200", stream: false },
    messages: [
      { role: "system", text: TEST_SYSTEM },
      { role: "user", text: TEST_USER },
    ],
  };
  const r = await fetch(YANDEX_API, {
    method: "POST",
    headers: {
      "Authorization": `Api-Key ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    return {
      ok: false,
      error: `Yandex HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`,
      durationMs: Date.now() - start,
    };
  }
  const data = await r.json();
  const text: string = data?.result?.alternatives?.[0]?.message?.text ?? "";
  if (!text) {
    return {
      ok: false,
      error: "Yandex returned no text content.",
      durationMs: Date.now() - start,
    };
  }
  return {
    ok: true,
    sampleResponse: text.slice(0, 300),
    durationMs: Date.now() - start,
  };
}
