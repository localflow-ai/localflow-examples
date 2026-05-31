# LocalFlow Examples

Minimal examples showing how to embed a **metadata-first AI assistant** in your own app using [`@localflow-ai/core`](https://github.com/localflow-ai/localflow-core).

With metadata-first AI, the LLM receives only schema and column names — never your actual data values. It generates deterministic code that runs locally in a sandboxed iframe on your full dataset.

Each example provides:
- A CSV / Excel file loader
- A chat interface to ask questions about the data
- An analysis result rendered in a sandboxed iframe

No server required — the assistant runs entirely in the browser using `LocalProxy` and your own Gemini API key.

## Examples

| Example | Stack | Directory |
|---------|-------|-----------|
| React   | React 18 + Vite + TypeScript | [`react/`](./react/) |
| Vanilla | Plain JS + Vite | [`vanilla/`](./vanilla/) |

## Getting started

> **Prerequisites:** Node.js 18+, a [Gemini API key](https://aistudio.google.com/apikey)

Because `@localflow-ai/core` is a local dependency (`file:../../localflow-core`), you need to build it once before running the examples:

```bash
cd ../../localflow-core
npm install && npm run build
```

Then run either example:

```bash
# React
cd react
npm install
npm run dev

# Vanilla
cd vanilla
npm install
npm run dev
```

Open the URL shown in your terminal, enter your Gemini API key, load a CSV or Excel file, and start asking questions.

## How it works

```js
import { LocalProxy, LocalAssistant } from '@localflow-ai/core'

// No server needed — LocalProxy runs entirely in the browser
const proxy = new LocalProxy()
const assistant = new LocalAssistant({ proxy, llm: { type: 'gemini' } })

// Your Gemini key — stays in the browser, never sent to any third party
await assistant.setLlmApiKey('AIza...')

// Load your data
assistant.addDataset('data', rows) // rows: object[] — one object per record

// Ask a question — the LLM generates JS that runs on your data locally
const { answer, formula } = await assistant.prompt('Show me the top 10 values by revenue')

// Render the result in a sandboxed iframe
iframe.srcdoc = assistant.buildSandboxDocument(formula)
```

The key idea — **metadata-first AI**: the LLM only ever receives metadata (schema, column names) — never your raw data. It generates executable JavaScript that runs locally in a sandboxed iframe on your full dataset. Your data never leaves the browser.

## Production use

`LocalProxy` is designed for development and getting-started scenarios. For production — where you need authentication, rate limiting, encrypted BYOK keys, and team management — replace it with a [`ProxyClient`](https://github.com/localflow-ai/localflow-core) connected to a [LocalFlow proxy](https://github.com/localflow-ai/localflow-proxy) server.

```js
// Production
import { ProxyClient, LocalAssistant } from '@localflow-ai/core'

const proxy = new ProxyClient('https://your-proxy.example.com')

// Connect using your CRM credentials — connector type depends on your setup:
await proxy.connect('odoo', { url, db, username, password })  // Odoo
await proxy.connect('public')                                  // anonymous / public session

const assistant = new LocalAssistant({ proxy, llm: { type: 'gemini' } })
```

## License

Apache 2.0 — see [LICENSE](./LICENSE).
