# LocalFlow Examples

Minimal examples showing how to embed a **metadata-first AI assistant** in your own app using [`@localflow/core`](https://github.com/localflow-ai/localflow-core).

> 🚀 Live demo: [apps.localflow.fr/demo](https://apps.localflow.fr/demo/) — built from the [`demo/`](./demo/) app in this repository

With metadata-first AI, the LLM receives only schema and column names — never your actual data values. It generates deterministic code that runs locally in a sandboxed iframe on your full dataset.

Each example provides:
- A CSV / Excel file loader
- A chat interface to ask questions about the data
- An analysis result rendered in a sandboxed iframe

No server required — the assistant runs entirely in the browser using `LocalProxy` and your own LLM API key (Gemini by default; OpenAI and Anthropic are also supported).

## Examples

| Example | Stack | Proxy | Directory |
|---------|-------|-------|-----------|
| React   | React 18 + Vite + TypeScript | `LocalProxy` (in-browser, BYOK) | [`react/`](./react/) |
| Vanilla | Plain JS + Vite | `LocalProxy` (in-browser, BYOK) | [`vanilla/`](./vanilla/) |
| Demo    | React 18 + Vite + TypeScript | `ProxyClient` (remote proxy, no key needed) | [`demo/`](./demo/) |

The `demo/` app is the source of the [live demo](https://apps.localflow.fr/demo/): it connects to a hosted LocalFlow proxy via a public session, so users can try it without supplying an API key (rate-limited per IP).

## Developing against a local `localflow-core`

By default the examples depend on the published `@localflow/core` npm package.
To test local changes without publishing, run these commands **once** to wire them together:

```bash
cd localflow-core
npm link                     # register local source as a global package

cd localflow-examples/react  # or vanilla
npm link @localflow/core     # use the local package instead of the published one
```

Then start both in separate terminals:

```bash
# Terminal 1
cd localflow-core && npm run dev   # recompiles on every save

# Terminal 2
cd localflow-examples/react && npm run dev
```

To restore the published npm version:

```bash
cd localflow-examples/react
npm unlink @localflow/core && npm install
```

## Getting started

> **Prerequisites:** Node.js 20+, an LLM API key — [Gemini](https://aistudio.google.com/apikey) (default), OpenAI, or Anthropic

Run either example:

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

Open the URL shown in your terminal, enter your API key, load a CSV or Excel file, and start asking questions.

## Building for production

```bash
cd react   # or vanilla
npm run build
```

This produces a `dist/` folder of static files ready to be served by any web server.

## How it works

```js
import { LocalProxy, LocalAssistant } from '@localflow/core'

// No server needed — LocalProxy runs entirely in the browser
const proxy = new LocalProxy()
const assistant = new LocalAssistant({
  proxy,
  llm: { protocol: 'gemini' },
  resultContainer: '#result',  // analysis results are rendered here, in a sandboxed iframe
})

// Your Gemini key — kept in the browser, sent only to the LLM provider.
// With LocalProxy it is stored as-is (fine for development); with a real
// proxy it is encrypted first and the clear key is discarded immediately.
await assistant.setLlmApiKey('AIza...')

// Load your data
assistant.addDataset('data', rows) // rows: object[] — one object per record

// Ask a question — the LLM generates JS that runs on your data locally,
// and the result is rendered automatically in #result
const { answer } = await assistant.prompt('Show me the top 10 values by revenue')
```

That's the whole integration — the assistant creates the sandboxed iframe, sets its permissions, and renders each analysis into `resultContainer` for you.

> The example apps in this repository instead use the lower-level `assistant.buildSandboxDocument(formula)` to drive the iframe themselves — useful when you need fine-grained control over loading states or tabbed layouts. See the [`LocalAssistant` API reference](https://github.com/localflow-ai/localflow-core#localassistant-api-reference) for both approaches.

The key idea — **metadata-first AI**: the LLM only ever receives metadata (schema, column names) — never your raw data. It generates executable JavaScript that runs locally in a sandboxed iframe on your full dataset. Your data never leaves the browser.

## Production use

`LocalProxy` is designed for development and getting-started scenarios. For production — where you need authentication, rate limiting, encrypted BYOK keys, and team management — replace it with a [`ProxyClient`](https://github.com/localflow-ai/localflow-core) connected to a [LocalFlow proxy](https://github.com/localflow-ai/localflow-proxy) server.

```js
// Production
import { ProxyClient, LocalAssistant } from '@localflow/core'

const proxy = new ProxyClient('https://your-proxy.example.com')

// Connect using your CRM credentials — connector type depends on your setup:
await proxy.connect('odoo', { url, db, username, password })  // Odoo
await proxy.connect('public')                                  // anonymous / public session

const assistant = new LocalAssistant({ proxy, llm: { protocol: 'gemini' } })
```

## License

Apache 2.0 — see [LICENSE](./LICENSE).
