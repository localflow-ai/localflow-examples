import { useCallback, useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/browser'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import { marked } from 'marked'
import { LocalAssistant, LocalProxy, LocalProxyRateLimitError } from '@localflow/core'
import type { AssistantResponse } from '@localflow/core'
import logo from './logo.webp'

const KEY_STORAGE = 'lf_gemini_key'
const DEMO_KEY = import.meta.env.VITE_GEMINI_DEMO_KEY ?? ''
const RATE_LIMIT_PER_DAY = 20

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
            (headers as any[]).map((h: any, i: number) => {
              const v = row[i]
              const safe = v instanceof Date ? v.toLocaleDateString() : v
              return [String(h ?? `col${i + 1}`), safe]
            })
          )
        ))
      }).catch(reject)
    }
  })
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-app-bg p-6">
      <img src={logo} alt="LocalFlow" className="w-14 h-14 mb-8 rounded-xl" />
      <div className="flex gap-2 mb-6">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2.5 h-2.5 rounded-full bg-primary inline-block"
            style={{ animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
      <p className="text-fg text-base font-semibold mb-2 text-center">{label}</p>
      {sublabel && <p className="text-muted text-sm text-center max-w-xs leading-relaxed">{sublabel}</p>}
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
    <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50">
      <div className="bg-card border border-white/15 rounded-2xl p-6 w-[360px] flex flex-col">
        <img src={logo} alt="LocalFlow" className="w-9 h-9 rounded-lg mb-3" />
        <h3 className="mb-2 text-fg text-sm font-semibold">Gemini API Key</h3>
        {notice && (
          <p className="text-amber-300 text-xs mb-2.5 leading-relaxed bg-amber-300/10 p-2 rounded-md">
            {notice}
          </p>
        )}
        <p className="text-muted text-xs mb-3.5 leading-relaxed">
          Your key stays in the browser and is never sent to any server.{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-primary underline">
            Get a free key →
          </a>
        </p>
        <input
          type="password"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && draft.trim() && onSave(draft.trim())}
          placeholder="AIza..."
          className="w-full bg-white/7 text-fg border border-white/15 rounded-lg px-3 py-2 text-sm mb-3 outline-none box-border"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={() => onSave(draft.trim())}
            disabled={!draft.trim()}
            className="flex-1 bg-primary text-[oklch(0.10_0_0)] rounded-lg py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            Save
          </button>
          {current && (
            <button onClick={() => onSave('')} className="bg-transparent text-muted border border-white/15 rounded-lg px-4 py-2.5 text-sm cursor-pointer">
              Clear
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="bg-transparent text-muted border border-white/15 rounded-lg px-4 py-2.5 text-sm cursor-pointer">
              Cancel
            </button>
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
    <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-white/15 rounded-2xl p-5 w-[min(760px,92vw)] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-fg text-sm font-semibold">Generated formula</span>
          <div className="flex gap-2">
            <button onClick={copy} className="bg-transparent text-muted border border-white/15 rounded-lg px-3 py-1.5 text-xs cursor-pointer">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button onClick={onClose} className="bg-transparent text-fg/70 border-none text-lg cursor-pointer">✕</button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto font-mono text-[13px] leading-relaxed text-fg/85 bg-code-bg rounded-lg p-4 whitespace-pre">
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </div>
  )
}

// ── Data modal ────────────────────────────────────────────────────────────────
function DataModal({ rows, fileName, onClose }: { rows: Record<string, unknown>[]; fileName: string; onClose: () => void }) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  return (
    <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-white/15 rounded-2xl p-5 w-[min(900px,95vw)] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-fg text-sm font-semibold">📄 {fileName} — {rows.length} rows</span>
          <button onClick={onClose} className="bg-transparent text-fg/70 border-none text-lg cursor-pointer">✕</button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full border-collapse text-xs font-mono">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col} className="px-2.5 py-1.5 text-left whitespace-nowrap text-muted border-b border-white/10 sticky top-0 bg-surface">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 !== 0 ? 'bg-white/[0.02]' : ''}>
                  {columns.map(col => (
                    <td key={col} className="px-2.5 py-1 whitespace-nowrap text-fg border-b border-white/5 max-w-60 overflow-hidden text-ellipsis">
                      {row[col] == null ? <span className="text-muted">—</span> : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    <div className="min-h-dvh flex items-center justify-center bg-app-bg p-6 relative">
      <button onClick={onKeyClick} title="Set your own Gemini API key"
        className="absolute top-5 right-5 flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-fg text-sm cursor-pointer">
        🔑 <span className="text-xs text-muted">API key</span>
      </button>

      <div className="flex flex-col items-center gap-5">
        <img src={logo} alt="LocalFlow" className="w-16 h-16 rounded-[14px]" />
        <div className="text-center">
          <h1 className="text-fg text-2xl font-bold mb-1.5">
            LocalFlow <span className="text-primary">AI Demo</span>
          </h1>
          <p className="text-muted text-sm">Metadata-first AI — your data never leaves the browser</p>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`w-full max-w-[440px] border-[1.5px] border-dashed rounded-2xl px-8 py-9 flex flex-col items-center cursor-pointer transition-all duration-150 ${
            dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-white/20 bg-white/[0.03]'
          }`}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke={dragging ? 'oklch(0.68 0.14 175)' : 'oklch(0.63 0 0)'}
            strokeWidth="1.5" className="mb-3">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-fg text-sm font-medium mb-1.5 text-center">Drop a CSV or Excel file here</p>
          <p className="text-muted text-xs text-center leading-relaxed max-w-xs mb-4">
            The data is loaded in your browser and never sent to any server.
            Only the column names and statistics are shared with the AI to generate the analysis.
          </p>
          <button onClick={() => inputRef.current?.click()}
            className="bg-primary text-[oklch(0.10_0_0)] border-none rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer">
            Browse files
          </button>
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
        </div>

        <p className="text-muted/70 text-[11px] text-center">Supports CSV and Excel (.xlsx, .xls)</p>
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
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [showData, setShowData] = useState(false)
  const assistantRef = useRef<LocalAssistant | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const proxy = new LocalProxy({
      geminiApiKey: DEMO_KEY,
      rateLimit: (DEMO_KEY && !geminiKey) ? { maxPerDay: RATE_LIMIT_PER_DAY } : undefined,
    })
    const assistant = new LocalAssistant({
      proxy,
      llm: { type: 'gemini' },
      darkMode: true,
      sandboxTheme: {
        extend: {
          colors: {
            primary: '#14b8a6',
            gray: {
              50:  '#fafafa',
              100: '#f2f2f2',
              200: '#e0e0e0',
              300: '#c0c0c0',
              400: '#8a8a8a',
              500: '#6a6a6a',
              600: '#4a4a4a',
              700: '#333333',
              800: '#292929',
              900: '#111111',
              950: '#0a0a0a',
            },
          },
        },
      },
    })
    if (geminiKey) assistant.setLlmApiKey(geminiKey)
    assistantRef.current = assistant
  }, [geminiKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function saveKey(k: string) {
    if (k) {
      localStorage.setItem(KEY_STORAGE, k)
    } else {
      localStorage.removeItem(KEY_STORAGE)
    }
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
    setRows(rows)
    assistant.clearHistory()
    assistant.clearDatasets?.()
    assistant.addDataset('data', rows)

    setPhase('analyzing')
    try {
      const res: AssistantResponse = await assistant.prompt('Show the data')
      if (res.formula) { setSrcdoc(assistant.buildSandboxDocument(res.formula)); setFormula(res.formula) }
      setMessages(res.answer ? [{ id: 'a-init', role: 'assistant', content: res.answer }] : [])
    } catch (err: unknown) {
      handlePromptError(err)
      setPhase('idle')
      return
    }

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
    return <Spinner label="Analyzing with metadata-first AI…" sublabel="Only column names and statistics are shared with the AI — your actual data never leaves the browser." />
  }

  // ready
  return (
    <>
      {showKeyModal && <KeyModal current={geminiKey} notice={keyModalNotice} onSave={saveKey} onCancel={!keyModalNotice ? () => setShowKeyModal(false) : undefined} />}
      {showFormula && formula && <FormulaModal formula={formula} onClose={() => setShowFormula(false)} />}
      {showData && <DataModal rows={rows} fileName={fileName ?? ''} onClose={() => setShowData(false)} />}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[300px] flex flex-col border-r border-white/15 bg-sidebar">
          <div className="flex justify-between items-center px-3.5 py-3 border-b border-white/15">
            <div className="flex items-center gap-2">
              <img src={logo} alt="LocalFlow" className="w-6 h-6 rounded-[5px]" />
              <span className="font-semibold text-sm text-fg">LocalFlow</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { setPhase('idle'); setMessages([]); setSrcdoc(null) }}
                title="Load a new file"
                className="bg-transparent border-none cursor-pointer text-xl text-fg/55 p-0.5 rounded hover:text-fg/80">
                ↺
              </button>
              <button onClick={() => openKeyModal()}
                title={geminiKey ? 'Change API key' : 'Set your own API key'}
                className="bg-transparent border-none cursor-pointer text-base text-fg/55 p-0.5 rounded hover:text-fg/80">
                🔑
              </button>
            </div>
          </div>

          <div className="flex items-center px-3.5 py-2 border-b border-white/15 bg-white/[0.025] gap-1.5">
            <span className="text-primary">📄</span>
            <button onClick={() => setShowData(true)} title="View raw data"
              className="flex-1 bg-transparent border-none p-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-xs text-primary text-left underline decoration-primary/40">
              {fileName}
            </button>
            <span className="text-muted text-[11px] shrink-0 mr-1.5">{rowCount} rows</span>
            {formula && (
              <button onClick={() => setShowFormula(true)} title="Inspect generated formula"
                className="bg-transparent border-none cursor-pointer text-[11px] text-fg/55 font-mono font-bold hover:text-fg/80">
                {'</>'}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2">
            {messages.length === 0 && (
              <p className="text-muted text-xs leading-relaxed py-1">Ask a question about your data.</p>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex items-end gap-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' ? (
                  <img src={logo} alt="AI" className="w-5 h-5 rounded-[4px] shrink-0 mb-0.5" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-user-bubble flex items-center justify-center shrink-0 mb-0.5">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-fg/70">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  </div>
                )}
                <div className={`rounded-xl px-3 py-2 max-w-[80%] text-sm leading-snug ${
                  msg.role === 'user' ? 'bg-user-bubble text-fg' : 'bg-card text-fg'
                }`}>
                  {msg.role === 'assistant'
                    ? <span className="[&_p]:my-0.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-0.5 [&_ul]:pl-4 [&_ol]:my-0.5 [&_ol]:pl-4 [&_li]:my-0 [&_strong]:font-semibold [&_em]:italic [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-medium"
                        dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }} />
                    : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-end gap-1.5">
                <img src={logo} alt="AI" className="w-5 h-5 rounded-[4px] shrink-0 mb-0.5" />
                <div className="bg-card rounded-xl px-3 py-2.5 flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 rounded-full bg-primary inline-block"
                      style={{ animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/15 px-3 pt-2.5 pb-1.5">
            <div className="flex gap-1.5 items-end">
              <textarea
                value={input}
                rows={1}
                disabled={loading}
                placeholder="Ask something about your data…"
                className="flex-1 bg-white/[0.06] text-fg border border-white/15 rounded-lg px-2.5 py-2 text-sm resize-none outline-none font-[inherit] min-h-[34px] max-h-[120px] disabled:opacity-50"
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              />
              <button onClick={send} disabled={!input.trim() || loading}
                className="bg-primary text-[oklch(0.10_0_0)] border-none rounded-lg w-[34px] h-[34px] cursor-pointer text-base font-bold shrink-0 disabled:opacity-50">
                ➤
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted/50">Your data stays local — only column names and statistics are shared with the AI.</p>
          </div>
        </div>

        {/* Result panel */}
        <div className="flex-1 overflow-hidden bg-app-bg">
          {srcdoc ? (
            <iframe
              key={srcdoc}
              srcDoc={srcdoc}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-downloads"
              title="Analysis result"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted text-sm">
              Ask a question to see the analysis here.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
