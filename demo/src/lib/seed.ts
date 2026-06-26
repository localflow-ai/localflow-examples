import LZString from 'lz-string'

// Seed payload written by the marketing site's "Chat" deep-link (see
// code-brand-bright `src/lib/demoHandoff.ts`). It pre-loads the demo with an
// example's data + pre-generated analysis, as if produced by a first chat turn.
export interface DemoSeed {
  v: number
  name: string
  rows: Record<string, unknown>[]
  formula: string
  question: string
  answer?: string
}

// Read + validate a seed from the URL fragment (`#seed=<lz-compressed JSON>`).
// Returns null when absent or malformed. Transport-agnostic by design: only this
// reader would change if the hand-off later moved to a token (`?handoff=<id>`).
export function readSeed(): DemoSeed | null {
  try {
    const m = window.location.hash.match(/[#&]seed=([^&]+)/)
    if (!m) return null
    const json = LZString.decompressFromEncodedURIComponent(m[1])
    if (!json) return null
    const s = JSON.parse(json) as DemoSeed
    if (!s || !Array.isArray(s.rows) || typeof s.formula !== 'string' || typeof s.question !== 'string') {
      return null
    }
    return s
  } catch {
    return null
  }
}
