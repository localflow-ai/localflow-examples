import { useCallback, useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/browser'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import { LocalAssistant, LocalProxy, LocalProxyRateLimitError } from '@localflow/core'
import type { AssistantResponse } from '@localflow/core'
import logo from './logo.webp'

const KEY_STORAGE = 'lf_gemini_key'
const DEMO_KEY = import.meta.env.VITE_GEMINI_DEMO_KEY ?? ''
const RATE_LIMIT_PER_DAY = 20

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg:        'oklch(0.17 0 0)',
  sidebar:   'oklch(0.165 0 0)',
  card:      'oklch(0.28 0 0)',
  border:    'oklch(1 0 0 / 14%)',
  primary:   'oklch(0.68 0.14 175)',
  primary2:  'oklch(0.75 0.13 200)',
  fg:        'oklch(0.96 0 0)',
  muted:     'oklch(0.63 0 0)',
  userBubble:'oklch(0.35 0.08 200)',
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'parsing' | 'analyzing' | 'ready'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ── File parser ───────────────────────────────────────────────────────────────
function parseFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (r) => resolve(r.data as Record<string, unknown>[]),
        error: reject,
      })
    } else {
      readXlsxFile(file).then((result: any) => {
        const rows = result[0]?.data ?? result
        const [headers, ...dataRows] = rows
        resolve(dataRows.map((row: any[]) =>
          Object.fromEntries(
            (headers as any[]).map((h: any, i: number) => [String(h ?? `col${i + 1}`), row[i]])
          )
        ))
      }).catch(reject)
    }
  })
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div style={S.spinnerWrap}>
      <img src={logo} alt="LocalFlow" style={{ width: 56, height: 56, marginBottom: 32, borderRadius: 12 }} />
      <div style={{ display: 'flex', gap: 7, marginBottom: 24 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 9, height: 9, borderRadius: '50%',
            background: T.primary,
            display: 'inline-block',
            animation: `bounce 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
      <p style={{ color: T.fg, fontSize: 15, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>{label}</p>
      {sublabel && <p style={{ color: T.muted, fontSize: 13, textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>{sublabel}</p>}
    </div>
  )
}

// ── Key modal ─────────────────────────────────────────────────────────────────
function KeyModal({ current, notice, onSave, onCancel }: {
  current: string
  notice?: string
  onSave: (k: string) => void
  onCancel?: () => void
}) {
  const [draft, setDraft] = useState(current)
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <img src={logo} alt="LocalFlow" style={{ width: 36, height: 36, borderRadius: 8, marginBottom: 12 }} />
        <h3 style={{ marginBottom: 8, color: T.fg, fontSize: 15 }}>Gemini API Key</h3>
        {notice && (
          <p style={{ color: 'oklch(0.75 0.15 50)', fontSize: 12, marginBottom: 10, lineHeight: 1.5, background: 'oklch(0.75 0.15 50 / 0.1)', padding: '8px 10px', borderRadius: 6 }}>
            {notice}
          </p>
        )}
        <p style={{ color: T.muted, fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>
          Your key stays in the browser and is never sent to any server.{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: T.primary }}>Get a free key →</a>
        </p>
        <input
          type="password"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && draft.trim() && onSave(draft.trim())}
          placeholder="AIza..."
          style={S.input}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onSave(draft.trim())} disabled={!draft.trim()} style={{ ...S.btn, flex: 1 }}>
            Save
          </button>
          {onCancel && (
            <button onClick={onCancel} style={S.btnSecondary}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Formula modal ─────────────────────────────────────────────────────────────
function FormulaModal({ formula, onClose }: { formula: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const highlighted = Prism.highlight(formula, Prism.languages.javascript, 'javascript')

  function copy() {
    navigator.clipboard.writeText(formula)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.formulaModal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: T.fg, fontSize: 13, fontWeight: 600 }}>Generated formula</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={copy} style={S.btnSecondary}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button onClick={onClose} style={{ ...S.iconBtn, fontSize: 18, opacity: 0.7 }}>✕</button>
          </div>
        </div>
        <pre style={S.codePre}>
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </div>
  )
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ onFile, onKeyClick }: { onFile: (f: File) => void; onKeyClick: () => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }, [onFile])

  return (
    <div style={S.dropPage}>
      {/* Top-right key button */}
      <button onClick={onKeyClick} title="Set your own Gemini API key" style={S.keyBtn}>
        🔑 <span style={{ fontSize: 11, color: T.muted }}>API key</span>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <img src={logo} alt="LocalFlow" style={{ width: 64, height: 64, borderRadius: 14 }} />
        <div>
          <h1 style={{ color: T.fg, fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>
            LocalFlow <span style={{ color: T.primary }}>AI Demo</span>
          </h1>
          <p style={{ color: T.muted, fontSize: 13, textAlign: 'center' }}>
            Metadata-first AI — your data never leaves the browser
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            ...S.dropZone,
            borderColor: dragging ? T.primary : 'oklch(1 0 0 / 22%)',
            background: dragging ? 'oklch(0.68 0.14 175 / 0.06)' : 'oklch(1 0 0 / 0.03)',
            transform: dragging ? 'scale(1.01)' : 'scale(1)',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dragging ? T.primary : T.muted} strokeWidth="1.5" style={{ marginBottom: 12 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ color: T.fg, fontSize: 14, fontWeight: 500, marginBottom: 6, textAlign: 'center' }}>
            Drop a CSV or Excel file here
          </p>
          <p style={{ color: T.muted, fontSize: 12, textAlign: 'center', lineHeight: 1.6, maxWidth: 320, marginBottom: 16 }}>
            The data is loaded in your browser and never sent to any server.
            Only the column names and statistics are shared with the AI to generate the analysis.
          </p>
          <button onClick={() => inputRef.current?.click()} style={S.browseBtn}>
            Browse files
          </button>
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
        </div>

        <p style={{ color: 'oklch(0.63 0 0 / 0.7)', fontSize: 11, textAlign: 'center' }}>
          Supports CSV and Excel (.xlsx, .xls)
        </p>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? '')
  const [keyModalNotice, setKeyModalNotice] = useState<string | undefined>()
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const [formula, setFormula] = useState<string | null>(null)
  const [showFormula, setShowFormula] = useState(false)
  const assistantRef = useRef<LocalAssistant | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const proxy = new LocalProxy({
      geminiApiKey: DEMO_KEY,
      rateLimit: DEMO_KEY ? { maxPerDay: RATE_LIMIT_PER_DAY } : undefined,
    })
    const assistant = new LocalAssistant({ proxy, llm: { type: 'gemini' }, darkMode: true })
    if (geminiKey) assistant.setLlmApiKey(geminiKey)
    assistantRef.current = assistant
  }, [geminiKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function saveKey(k: string) {
    if (!k) return
    localStorage.setItem(KEY_STORAGE, k)
    setGeminiKey(k)
    setShowKeyModal(false)
    setKeyModalNotice(undefined)
  }

  function openKeyModal(notice?: string) {
    setKeyModalNotice(notice)
    setShowKeyModal(true)
  }

  async function handleFile(file: File) {
    const assistant = assistantRef.current
    if (!assistant) return

    setPhase('parsing')
    let rows: Record<string, unknown>[]
    try {
      rows = await parseFile(file)
    } catch {
      setPhase('idle')
      return
    }

    setFileName(file.name)
    setRowCount(rows.length)
    assistant.clearHistory()
    assistant.clearDatasets?.()
    assistant.addDataset('data', rows)

    setPhase('analyzing')
    try {
      const res: AssistantResponse = await assistant.prompt('Show the data')
      if (res.formula) { setSrcdoc(assistant.buildSandboxDocument(res.formula)); setFormula(res.formula) }
    } catch (err: unknown) {
      handlePromptError(err)
      setPhase('idle')
      return
    }

    setMessages([])
    setPhase('ready')
  }

  function handlePromptError(err: unknown) {
    if (err instanceof LocalProxyRateLimitError) {
      openKeyModal(`You've used the ${RATE_LIMIT_PER_DAY} daily demo requests. Enter your own key to continue.`)
    } else if ((err as Error).message?.includes('429')) {
      openKeyModal('The shared demo key has reached its limit. Enter your own key to continue.')
    } else {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`, role: 'assistant',
        content: `Error: ${(err as Error).message}`,
      }])
    }
  }

  async function doSend(text: string) {
    const assistant = assistantRef.current
    if (!assistant) return
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }])
    setLoading(true)
    try {
      const res: AssistantResponse = await assistant.prompt(text)
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: res.answer }])
      if (res.formula) { setSrcdoc(assistant.buildSandboxDocument(res.formula)); setFormula(res.formula) }
    } catch (err: unknown) {
      handlePromptError(err)
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    await doSend(text)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <>
        {showKeyModal && <KeyModal current={geminiKey} notice={keyModalNotice} onSave={saveKey} onCancel={!keyModalNotice ? () => setShowKeyModal(false) : undefined} />}
        <DropZone onFile={handleFile} onKeyClick={() => openKeyModal()} />
      </>
    )
  }

  if (phase === 'parsing') {
    return <Spinner label="Loading data in the browser…" sublabel="Your file is being read locally. Nothing is sent anywhere yet." />
  }

  if (phase === 'analyzing') {
    return <Spinner label="Analyzing your data with AI…" sublabel="Only column names and statistics are shared with the AI — your actual data never leaves the browser." />
  }

  // ready
  return (
    <>
      {showKeyModal && <KeyModal current={geminiKey} notice={keyModalNotice} onSave={saveKey} onCancel={!keyModalNotice ? () => setShowKeyModal(false) : undefined} />}
      {showFormula && formula && <FormulaModal formula={formula} onClose={() => setShowFormula(false)} />}
      <div style={S.layout}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          <div style={S.sidebarHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={logo} alt="LocalFlow" style={{ width: 24, height: 24, borderRadius: 5 }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: T.fg }}>LocalFlow</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => { setPhase('idle'); setMessages([]); setSrcdoc(null) }} title="Load a new file" style={{ ...S.iconBtn, fontSize: 20 }}>
                ↺
              </button>
              <button onClick={() => openKeyModal()} title={geminiKey ? 'Change API key' : 'Set your own API key'} style={S.iconBtn}>
                🔑
              </button>
            </div>
          </div>

          <div style={S.fileChip}>
            <span style={{ color: T.primary, marginRight: 6 }}>📄</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{fileName}</span>
            <span style={{ color: T.muted, fontSize: 11, flexShrink: 0, marginRight: 6 }}>{rowCount} rows</span>
            {formula && (
              <button onClick={() => setShowFormula(true)} title="Inspect generated formula" style={{ ...S.iconBtn, fontSize: 11, opacity: 0.7, fontFamily: 'monospace', fontWeight: 700 }}>
                {'</>'}
              </button>
            )}
          </div>

          <div style={S.messages}>
            {messages.length === 0 && (
              <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6, padding: '4px 0' }}>
                Ask a question about your data.
              </p>
            )}
            {messages.map(msg => (
              <div key={msg.id} style={msg.role === 'user' ? S.userBubble : S.aiBubble}>
                {msg.role === 'assistant'
                  ? <span dangerouslySetInnerHTML={{ __html: msg.content }} />
                  : msg.content}
              </div>
            ))}
            {loading && (
              <div style={{ ...S.aiBubble, display: 'flex', gap: 5, alignItems: 'center', padding: '10px 14px' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: T.primary, display: 'inline-block',
                    animation: 'bounce 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={S.inputRow}>
            <textarea
              value={input}
              rows={1}
              disabled={loading}
              placeholder="Ask something about your data…"
              style={S.textarea}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            />
            <button onClick={send} disabled={!input.trim() || loading} style={S.sendBtn}>➤</button>
          </div>
        </div>

        {/* Result panel */}
        <div style={S.main}>
          {srcdoc ? (
            <iframe
              key={srcdoc}
              srcDoc={srcdoc}
              style={{ width: '100%', height: '100%', border: 'none' }}
              sandbox="allow-scripts allow-downloads"
              title="Analysis result"
            />
          ) : (
            <div style={S.empty}>Ask a question to see the analysis here.</div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  // Full-screen states
  spinnerWrap: {
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: T.bg, padding: 24,
  },
  dropPage: {
    minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: T.bg, padding: 24, position: 'relative',
  },
  dropZone: {
    width: '100%', maxWidth: 440,
    border: '1.5px dashed oklch(1 0 0 / 22%)',
    borderRadius: 16, padding: '36px 32px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    cursor: 'pointer', transition: 'all 0.15s ease',
  },
  browseBtn: {
    background: T.primary, color: 'oklch(0.10 0 0)',
    border: 'none', borderRadius: 8,
    padding: '9px 22px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
  },
  keyBtn: {
    position: 'absolute', top: 20, right: 20,
    background: 'oklch(1 0 0 / 0.06)', border: '1px solid oklch(1 0 0 / 12%)',
    borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5, color: T.fg, fontSize: 13,
  },

  // Ready layout
  layout: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 300, display: 'flex', flexDirection: 'column',
    borderRight: `1px solid ${T.border}`, background: T.sidebar,
  },
  sidebarHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px', borderBottom: `1px solid ${T.border}`,
  },
  fileChip: {
    display: 'flex', alignItems: 'center',
    padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
    background: 'oklch(1 0 0 / 0.025)',
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 15, opacity: 0.55, padding: 3, color: T.fg,
    borderRadius: 4,
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  userBubble: {
    alignSelf: 'flex-end', background: T.userBubble, color: T.fg,
    borderRadius: 10, padding: '7px 11px', maxWidth: '85%', fontSize: 13, lineHeight: 1.55,
  },
  aiBubble: {
    alignSelf: 'flex-start', background: T.card,
    borderRadius: 10, padding: '7px 11px', maxWidth: '85%', fontSize: 13, lineHeight: 1.55,
    color: T.fg,
  },
  inputRow: {
    display: 'flex', gap: 6, padding: '10px 12px',
    borderTop: `1px solid ${T.border}`, alignItems: 'flex-end',
  },
  textarea: {
    flex: 1, background: 'oklch(1 0 0 / 0.06)', color: T.fg,
    border: `1px solid ${T.border}`,
    borderRadius: 8, padding: '7px 10px', fontSize: 13, resize: 'none',
    outline: 'none', fontFamily: 'inherit', minHeight: 34, maxHeight: 120,
  },
  sendBtn: {
    background: T.primary, color: 'oklch(0.10 0 0)',
    border: 'none', borderRadius: 8,
    width: 34, height: 34, cursor: 'pointer', fontSize: 16, flexShrink: 0,
    fontWeight: 700,
  },
  main: { flex: 1, overflow: 'hidden', background: T.bg },
  empty: {
    height: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: T.muted, fontSize: 13,
  },

  // Formula modal
  formulaModal: {
    background: 'oklch(0.13 0 0)', border: `1px solid ${T.border}`,
    borderRadius: 14, padding: 20,
    width: 'min(760px, 92vw)', maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
  },
  codePre: {
    flex: 1, overflowY: 'auto', overflowX: 'auto',
    fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
    fontSize: 12.5, lineHeight: 1.7,
    color: 'oklch(0.85 0 0)',
    background: 'oklch(0.10 0 0)',
    borderRadius: 8, padding: 16,
    whiteSpace: 'pre',
  },

  // Key modal
  overlay: {
    position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: T.card, border: `1px solid ${T.border}`,
    borderRadius: 14, padding: 24, width: 360,
    display: 'flex', flexDirection: 'column',
  },
  input: {
    width: '100%', background: 'oklch(1 0 0 / 0.07)', color: T.fg,
    border: `1px solid ${T.border}`,
    borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  },
  btn: {
    background: T.primary, color: 'oklch(0.10 0 0)',
    border: 'none', borderRadius: 8,
    padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent', color: T.muted,
    border: `1px solid ${T.border}`,
    borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer',
  },
}
