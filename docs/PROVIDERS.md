# LLM Providers

Newsroom supports 8 LLM providers in v0.2. Pick one during the wizard
(language-aware default is suggested) or change later in `/admin/settings`
without restarting any containers — the bot rereads the provider config
from the DB on every cron tick.

| # | Provider     | Region notes                          | Wire format        | Typical cost (in/out $/M tok) |
|---|--------------|---------------------------------------|--------------------|--------------------------------|
| 1 | DeepSeek     | Works everywhere incl. RU / CN        | OpenAI-compat      | ~$0.30 / $0.50                 |
| 2 | OpenAI       | Not RU / CN (needs VPN)               | Native             | ~$1.25 / $10                   |
| 3 | Anthropic    | Not RU / CN                           | OpenAI-compat      | ~$3 / $15                      |
| 4 | Google Gemini| Not RU / CN                           | OpenAI-compat      | ~$0.30 / $2.50                 |
| 5 | xAI Grok     | Not sanctioned regions                | OpenAI-compat      | ~$3 / $15                      |
| 6 | Yandex GPT   | RU only (legal jurisdiction)          | Proprietary (adapter) | ~$0.50 / $1.50              |
| 7 | OpenRouter   | Works wherever upstream works         | OpenAI-compat      | Markup on any of 100+ models   |
| 8 | Custom       | Wherever your endpoint runs           | OpenAI-compat      | Yours                          |

Prices drift — check the provider's pricing page before committing.

---

## DeepSeek

**Why pick it:** cheapest, works in RU / CN, decent quality for short
article generation. Default for the `ru` locale in the wizard.

**Setup:**

1. Sign up at <https://platform.deepseek.com>
2. Top up (often 5 M free tokens on signup; check current promo)
3. API keys → *Create new key* → copy `sk-...`
4. In `/admin/settings` → LLM provider: provider=DeepSeek,
   model=`deepseek-chat`, paste the key, *Test connection*, *Save*

**Models:**
- `deepseek-chat` (default) — general purpose
- `deepseek-reasoner` — heavier reasoning, ~2× cost

**Disclosure:** Chinese provider. Data processed in China subject to
their laws. Don't use for confidential or regulated data.

---

## OpenAI

**Why pick it:** "ChatGPT" is the most recognised name; recruiters and
non-tech users instantly trust it. Default for `en` locale in the
wizard.

**Setup:**

1. Sign up at <https://platform.openai.com>
2. Verify a phone number (required for paid tier)
3. Add credit ($5 minimum)
4. API keys → *Create new secret key* → copy `sk-proj-...` (or `sk-...`)
5. In `/admin/settings`: provider=OpenAI, model=`gpt-4o`, paste key, *Test*, *Save*

**Models:**
- `gpt-4o` (default) — strong, ~$5 / M tok
- `gpt-4o-mini` — cheaper, ~$0.15 / M tok
- `gpt-4-turbo` — older flagship

**Disclosure:** US-based. Data stored in US/EU. Does NOT serve requests
from RU or CN IPs.

---

## Anthropic (Claude)

**Why pick it:** premium text quality, particularly strong in Russian
news writing.

**Setup:**

1. Sign up at <https://console.anthropic.com>
2. Add credit ($5 minimum)
3. Settings → API keys → *Create key* → copy `sk-ant-api03-...`
4. In `/admin/settings`: provider=Anthropic, model=`claude-sonnet-4-6`,
   paste, *Test*, *Save*

Newsroom uses Anthropic's OpenAI-compatible endpoint at
`api.anthropic.com/v1` — no separate SDK required.

**Models:**
- `claude-sonnet-4-6` (default)
- `claude-opus-4-7` — top-tier, ~3× cost

**Disclosure:** US-based. Does NOT work from RU / CN.

---

## Google Gemini

**Why pick it:** good balance of price and quality. Default for `es` /
`pt` locales.

**Setup:**

1. Sign in at <https://aistudio.google.com>
2. *Get API key* → *Create API key in new project*
3. Copy the `AIza...` key
4. In `/admin/settings`: provider=Gemini, model=`gemini-2.5-flash`,
   paste, *Test*, *Save*

Newsroom uses Gemini's OpenAI-compatible endpoint
(`generativelanguage.googleapis.com/v1beta/openai`).

**Models:**
- `gemini-2.5-flash` (default) — fast, cheap
- `gemini-2.5-pro` — heavier, slower

**Disclosure:** Does NOT work from RU / CN.

---

## xAI Grok

**Why pick it:** strong for tech-heavy news. Real-time data access in
some models.

**Setup:**

1. Sign in at <https://console.x.ai>
2. Add credit
3. *API keys* → *Create new key* → copy `xai-...`
4. In `/admin/settings`: provider=Grok, model=`grok-2-latest`,
   paste, *Test*, *Save*

**Models:**
- `grok-2-latest` (default)
- `grok-3` / `grok-4` — newer, more expensive (verify availability)

**Disclosure:** xAI sanctions list mirrors US export controls.

---

## Yandex GPT

**Why pick it:** legally clean for sites hosted in / serving RU.
Data stays in Yandex Cloud.

**Setup:**

1. Sign in at <https://console.cloud.yandex.ru>
2. Create a folder (or use the default one). Note the folder ID
   (looks like `b1g123abc456...`).
3. Create a service account with the `ai.languageModels.user` role.
4. *API keys* → generate an API key for that service account. Copy.
5. In `/admin/settings`:
   - provider=Yandex GPT
   - **model=`<folder_id>/yandexgpt-latest`** — the folder ID and
     model name joined by a `/`. The wizard / admin form prompts
     for this format.
   - paste the API key, *Test*, *Save*

**Models** (replace `<folder>` with yours):
- `<folder>/yandexgpt-latest` (default) — strong
- `<folder>/yandexgpt-lite-latest` — cheaper

**Disclosure:** Russian provider. Only valid for RU-market sites.

---

## OpenRouter

**Why pick it:** one key, 100+ models, easy A/B-testing. Pay a small
markup on each provider's underlying cost.

**Setup:**

1. Sign in at <https://openrouter.ai>
2. Add credit
3. *Keys* → *Create key* → copy `sk-or-v1-...`
4. In `/admin/settings`:
   - provider=OpenRouter
   - model=any slug from <https://openrouter.ai/models> —
     e.g. `anthropic/claude-sonnet-4.6` or `openai/gpt-4o` or
     `deepseek/deepseek-chat`
   - paste, *Test*, *Save*

Useful when you want Claude quality without managing an Anthropic
account, or want to A/B test models without re-configuring keys each
time.

**Disclosure:** OpenRouter charges a small markup (typically ~5%).
Some upstream models have their own region restrictions which still
apply.

---

## Custom

For self-hosted / private endpoints that speak OpenAI Chat Completions
(LocalAI, llama.cpp's server, vLLM, Ollama with the OpenAI-compat
front, in-house gateways, ...).

**Setup:**

1. In `/admin/settings`:
   - provider=Custom
   - model=whatever your endpoint expects (e.g. `llama3.1:70b`)
   - **Base URL** = your endpoint's `/v1` path
     (e.g. `http://my-llm.internal:8080/v1`)
   - API key = whatever your endpoint validates, or any non-empty
     placeholder if it doesn't require auth
   - *Test*, *Save*

**Disclosure:** Your call. You vouch for the endpoint.

---

## How Newsroom calls the provider

Bot reads `projects.llm_provider`, `llm_model`, `llm_api_key`,
`llm_base_url` from the DB on every cron tick (so admin changes take
effect on the next 5- or 30-min run — no restart required).

Wire format: standard OpenAI Chat Completions JSON for all providers
except Yandex (where a thin adapter translates messages/response shape).

Request shape sent for each `main_full` run:
- 1 clustering call (~system prompt + JSON payload, up to 16k tokens)
- N article-writing calls (one per cluster reaching `article_min_sources`,
  up to 4k tokens each)

Cost-control knobs:
- `CLUSTER_BATCH_MAX = 40` items per clustering call (in `bot/main_full.py`)
- `article_min_sources` in `/admin/settings` — raise it to write fewer articles per run

## Where keys are stored

- `projects.llm_api_key` — DB column (plaintext for v0.2; encryption is
  on the v0.3 roadmap). Same risk perimeter as Postgres dumps.
- `.env` — `LLM_API_KEY` exists as a *bootstrap fallback* — used by
  `bot/seed.py` to populate the DB during install, and as a backup if
  the DB column is empty. Not authoritative.

Pre-upgrade backups (`backups/pre-upgrade-*.sql.gz`) contain the key
in plaintext. Mirror them somewhere private or rotate the key after
the upgrade window.
