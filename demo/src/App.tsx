import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/browser'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import { marked } from 'marked'
import { LocalAssistant, ProxyClient } from '@localflow/core'
import type { AssistantResponse } from '@localflow/core'
import logo from './logo.webp'
import { i18n } from './i18n'

const DEMO_PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'https://backoffice.daquota.io/demo'
const DEMO_MODEL_ID  = import.meta.env.VITE_MODEL_ID  ?? 'gemini-flash'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'connecting' | 'idle' | 'parsing' | 'analyzing' | 'ready'

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
      <p className="text-fg text-xl font-semibold mb-2 text-center">{label}</p>
      {sublabel && <p className="text-muted text-base text-center max-w-xs leading-relaxed">{sublabel}</p>}
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
          <span className="text-fg text-sm font-semibold">{i18n.formula.title}</span>
          <div className="flex gap-2">
            <button onClick={copy} className="bg-transparent text-muted border border-white/15 rounded-lg px-3 py-1.5 text-xs cursor-pointer">
              {copied ? i18n.formula.copied : i18n.formula.copy}
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
function DataModal({ rows, fileName, onClose, icon, totalRows, onAnalyze }: {
  rows: Record<string, unknown>[]
  fileName: string
  onClose: () => void
  icon?: string
  totalRows?: number
  onAnalyze?: () => void
}) {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  const rowLabel = totalRows != null
    ? i18n.chat.rowCountPreview(rows.length, totalRows)
    : i18n.chat.rowCount(rows.length)
  return (
    <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-white/15 rounded-2xl p-5 w-[min(900px,95vw)] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-fg text-sm font-semibold">{icon ?? '📄'} {fileName} — {rowLabel}</span>
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
        {onAnalyze && (
          <div className="mt-4 flex justify-end border-t border-white/10 pt-4">
            <button onClick={onAnalyze}
              className="bg-primary text-[oklch(0.10_0_0)] border-none rounded-xl px-6 py-2.5 text-sm font-semibold cursor-pointer">
              {i18n.chat.startAnalysis}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
const PILLARS = i18n.pillars

const BASE = import.meta.env.BASE_URL

const SAMPLE_DATASETS = [
  { icon: '🌦️', rows: 1461, cols: 6,  file: 'seattle-weather.csv',        ...i18n.samples[0] },
  { icon: '🦅', rows: 9999, cols: 14, file: 'birdstrikes.csv',             ...i18n.samples[1] },
  { icon: '🌍', rows: 802,  cols: 3,  file: 'disasters.csv',               ...i18n.samples[2] },
  { icon: '📊', rows: 188,  cols: 5,  file: 'gapminder-health-income.csv', ...i18n.samples[3] },
]

function DropZone({ onFile, genaiLimit }: { onFile: (f: File) => void; genaiLimit: number | null }) {
  const [dragging, setDragging] = useState(false)
  const [loadingSample, setLoadingSample] = useState<string | null>(null)
  const [view, setView] = useState<'upload' | 'samples'>('upload')
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null)
  const [previewDs, setPreviewDs] = useState<typeof SAMPLE_DATASETS[0] | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function openPreview(ds: typeof SAMPLE_DATASETS[0], e: React.MouseEvent) {
    e.stopPropagation()
    if (previewLoading) return
    setPreviewLoading(ds.file)
    try {
      const res = await fetch(`${BASE}datasets/${ds.file}`)
      const blob = await res.blob()
      const rows = await parseFile(new File([blob], ds.file, { type: 'text/csv' }))
      setPreviewDs(ds)
      setPreviewRows(rows.slice(0, 100))
    } finally {
      setPreviewLoading(null)
    }
  }

  async function loadSample(dataset: typeof SAMPLE_DATASETS[0]) {
    if (loadingSample) return
    setLoadingSample(dataset.file)
    try {
      const res = await fetch(`${BASE}datasets/${dataset.file}`)
      const blob = await res.blob()
      onFile(new File([blob], dataset.file, { type: 'text/csv' }))
    } finally {
      setLoadingSample(null)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }, [onFile])

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-app-bg">

      {/* ── Hero ── */}
      <div className="flex flex-col items-center pt-8 pb-6 px-8 text-center">
        <img src={logo} alt="LocalFlow" className="w-16 h-16 rounded-2xl mb-4" />
        <h1 className="text-fg text-5xl font-bold mb-2">
          LocalFlow <span className="text-primary">AI Demo</span>
        </h1>
        <p className="text-muted text-xl max-w-xl leading-relaxed">{i18n.hero.subtitle}</p>
      </div>

      {/* ── Pillars ── */}
      <div className="flex flex-wrap items-center justify-center gap-y-2 px-8 pb-6">
        {PILLARS.map(({ title, body }, i) => (
          <Fragment key={title}>
            {i > 0 && <span className="text-white/20 mx-3 select-none">·</span>}
            <span className="relative group flex items-center gap-1.5">
              <span className="text-muted text-base">{title}</span>
              <span className="w-4 h-4 rounded-full border border-white/20 text-muted/50 text-[10px] leading-none flex items-center justify-center cursor-help shrink-0">?</span>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-56 bg-surface border border-white/15 rounded-xl px-3 py-2.5 text-sm text-muted leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-20 shadow-lg">
                {body}
              </div>
            </span>
          </Fragment>
        ))}
      </div>

      {/* ── Upload / Samples (toggled) ── */}
      <div className="flex flex-col items-center px-8 pb-6 w-full max-w-4xl mx-auto">

        {view === 'upload' ? (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`w-full max-w-[520px] border-[1.5px] border-dashed rounded-2xl px-10 py-7 flex flex-col items-center cursor-pointer transition-all duration-150 ${
                dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-white/20 bg-white/[0.03]'
              }`}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke={dragging ? 'oklch(0.68 0.14 175)' : 'oklch(0.63 0 0)'}
                strokeWidth="1.5" className="mb-3">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-fg text-lg font-medium mb-1 text-center">{i18n.upload.dropMessage}</p>
              <p className="text-muted text-base text-center mb-4">{i18n.upload.formats}</p>
              <button onClick={() => inputRef.current?.click()}
                className="bg-primary text-[oklch(0.10_0_0)] border-none rounded-xl px-5 py-2 text-sm font-semibold cursor-pointer">
                {i18n.upload.browse}
              </button>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
            </div>
            <button onClick={() => setView('samples')}
              className="mt-4 bg-transparent border-none text-muted text-base cursor-pointer hover:text-fg/70 underline decoration-white/20">
              {i18n.upload.trySample}
            </button>
          </>
        ) : (
          <>
            {previewRows && previewDs && (
              <DataModal
                rows={previewRows}
                fileName={previewDs.title}
                icon={previewDs.icon}
                totalRows={previewDs.rows}
                onClose={() => { setPreviewRows(null); setPreviewDs(null) }}
                onAnalyze={() => { setPreviewRows(null); setPreviewDs(null); loadSample(previewDs) }}
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {SAMPLE_DATASETS.map(ds => (
                <button
                  key={ds.file}
                  onClick={() => loadSample(ds)}
                  disabled={!!loadingSample}
                  className="bg-card border border-white/10 rounded-2xl p-4 flex flex-col gap-1.5 text-left cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{loadingSample === ds.file ? '⏳' : ds.icon}</span>
                      <span className="text-fg text-base font-semibold">{ds.title}</span>
                    </div>
                    <span className="text-muted text-xs shrink-0">{i18n.chat.rowCount(ds.rows)}</span>
                  </div>
                  <p className="text-muted text-sm leading-relaxed">{ds.description}</p>
                  <span
                    onClick={e => openPreview(ds, e)}
                    className="text-primary/60 text-xs underline decoration-primary/30 hover:text-primary/90 mt-0.5 self-start cursor-pointer"
                  >
                    {previewLoading === ds.file ? '…' : i18n.upload.columns(ds.cols)}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setView('upload')}
              className="mt-4 bg-transparent border-none text-muted text-base cursor-pointer hover:text-fg/70 underline decoration-white/20">
              {i18n.upload.useOwn}
            </button>
          </>
        )}

      </div>

      {/* ── Footer ── */}
      <div className="text-center text-sm text-muted/50 pb-6 px-8 flex flex-col gap-1.5">
        {genaiLimit != null && <span>{i18n.footer.rateLimit(genaiLimit)}</span>}
        <span>
          {i18n.footer.poweredBy}{' '}
          <a href="https://localflow.fr" target="_blank" rel="noreferrer" className="text-primary/70 underline">LocalFlow</a>
          {' · '}
          <a href="https://localflow.fr/contact" target="_blank" rel="noreferrer" className="text-primary/70 underline">{i18n.footer.contact}</a>
        </span>
      </div>

    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [mobileView, setMobileView] = useState<'chat' | 'chart'>('chat')
  const [genaiLimit, setGenaiLimit] = useState<number | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const [iframeLoading, setIframeLoading] = useState(false)
  const [formula, setFormula] = useState<string | null>(null)
  const [showFormula, setShowFormula] = useState(false)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [showData, setShowData] = useState(false)
  const assistantRef = useRef<LocalAssistant | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${DEMO_PROXY_URL}/public/config`)
      .then(r => r.json())
      .then(cfg => setGenaiLimit(cfg.publicSessions?.rateLimits?.genaiPerIpPerDay ?? null))
      .catch(() => {})

    const proxy = new ProxyClient(DEMO_PROXY_URL)
    proxy.connect('public').then(() => {
      const assistant = new LocalAssistant({
        proxy,
        llm: { modelId: DEMO_MODEL_ID },
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
      assistantRef.current = assistant
      setPhase('idle')
    }).catch(() => {
      setMessages([{ id: 'conn-err', role: 'assistant', content: i18n.errors.connection }])
      setPhase('idle')
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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
    setMobileView('chat')
    assistant.clearHistory()
    assistant.clearDatasets?.()
    assistant.addDataset('data', rows)

    setPhase('analyzing')
    try {
      const res: AssistantResponse = await assistant.prompt(i18n.chat.initialPrompt)
      if (res.formula) { setIframeLoading(true); setSrcdoc(assistant.buildSandboxDocument(res.formula)); setFormula(res.formula); setMobileView('chart') }
      setMessages(res.answer ? [{ id: 'a-init', role: 'assistant', content: res.answer }] : [])
    } catch (err: unknown) {
      handlePromptError(err)
      setPhase('ready')
      return
    }

    setPhase('ready')
  }

  function handlePromptError(err: unknown) {
    const msg = (err as Error).message ?? ''
    let content: string
    if (msg.includes('429')) {
      content = i18n.errors.rateLimit
    } else if (msg.includes('403') && msg.toLowerCase().includes('disabled')) {
      content = i18n.errors.disabled
    } else if (msg.includes('500') || msg.includes('suspended') || msg.includes('Permission denied')) {
      content = i18n.errors.unavailable
    } else {
      content = i18n.errors.generic(msg)
    }
    setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content }])
  }

  async function doSend(text: string) {
    const assistant = assistantRef.current
    if (!assistant) return
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }])
    setLoading(true)
    try {
      const res: AssistantResponse = await assistant.prompt(text)
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: res.answer }])
      if (res.formula) { setIframeLoading(true); setSrcdoc(assistant.buildSandboxDocument(res.formula)); setFormula(res.formula); setMobileView('chart') }
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

  if (phase === 'connecting') {
    return <Spinner label={i18n.spinner.connecting} />
  }

  if (phase === 'idle') {
    return <DropZone onFile={handleFile} genaiLimit={genaiLimit} />
  }

  if (phase === 'parsing') {
    return <Spinner label={i18n.spinner.parsing} sublabel={i18n.spinner.parsingSubtitle} />
  }

  if (phase === 'analyzing') {
    return <Spinner label={i18n.spinner.analyzing} sublabel={i18n.spinner.analyzingSubtitle} />
  }

  // ready
  return (
    <>
      {showFormula && formula && <FormulaModal formula={formula} onClose={() => setShowFormula(false)} />}
      {showData && <DataModal rows={rows} fileName={fileName ?? ''} onClose={() => setShowData(false)} />}

      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Mobile tab bar */}
        <div className="flex md:hidden shrink-0 border-b border-white/15 bg-sidebar">
          <button
            onClick={() => setMobileView('chat')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mobileView === 'chat' ? 'text-primary border-b-2 border-primary' : 'text-muted'}`}
          >
            {i18n.chat.tabChat}
          </button>
          <button
            onClick={() => setMobileView('chart')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mobileView === 'chart' ? 'text-primary border-b-2 border-primary' : 'text-muted'}`}
          >
            {srcdoc ? `${i18n.chat.tabResult} ●` : i18n.chat.tabResult}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`flex flex-col border-r border-white/15 bg-sidebar w-full md:w-[336px] ${mobileView === 'chart' ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex justify-between items-center px-3.5 py-3 border-b border-white/15">
            <div className="flex items-center gap-2">
              <img src={logo} alt="LocalFlow" className="w-6 h-6 rounded-[5px]" />
              <span className="font-semibold text-sm text-fg">LocalFlow</span>
            </div>
            <button onClick={() => { setPhase('idle'); setMessages([]); setSrcdoc(null) }}
              title={i18n.chat.loadNewFile}
              className="bg-transparent border-none cursor-pointer text-xl text-fg/55 p-0.5 rounded hover:text-fg/80">
              ↺
            </button>
          </div>

          <div className="flex items-center px-3.5 py-2 border-b border-white/15 bg-white/[0.025] gap-1.5">
            <span className="text-primary">📄</span>
            <button onClick={() => setShowData(true)} title={i18n.chat.viewRawData}
              className="flex-1 bg-transparent border-none p-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-sm text-primary text-left underline decoration-primary/40">
              {fileName}
            </button>
            <span className="text-muted text-xs shrink-0 mr-1.5">{i18n.chat.rowCount(rowCount)}</span>
            {formula && (
              <button onClick={() => setShowFormula(true)} title={i18n.chat.inspectFormula}
                className="bg-transparent border-none cursor-pointer text-[11px] text-fg/55 font-mono font-bold hover:text-fg/80">
                {'</>'}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2">
            {messages.length === 0 && (
              <p className="text-muted text-sm leading-relaxed py-1">{i18n.chat.empty}</p>
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
                placeholder={i18n.chat.placeholder}
                className="flex-1 bg-white/[0.06] text-fg border border-white/15 rounded-lg px-2.5 py-2 text-sm resize-none outline-none font-[inherit] min-h-[34px] max-h-[120px] disabled:opacity-50"
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              />
              <button onClick={send} disabled={!input.trim() || loading}
                className="bg-primary text-[oklch(0.10_0_0)] border-none rounded-lg w-[34px] h-[34px] cursor-pointer text-base font-bold shrink-0 disabled:opacity-50">
                ➤
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-muted/70">{i18n.chat.disclaimer}</p>
          </div>
        </div>

        {/* Result panel */}
        <div className={`flex-1 overflow-hidden bg-app-bg relative ${mobileView === 'chat' ? 'hidden md:block' : 'block'}`}>
          {srcdoc ? (
            <iframe
              key={srcdoc}
              srcDoc={srcdoc}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-downloads"
              title="Analysis result"
              onLoad={() => setIframeLoading(false)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted text-sm">
              {i18n.chat.noResult}
            </div>
          )}
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-app-bg/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2.5 h-2.5 rounded-full bg-primary inline-block"
                      style={{ animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                <p className="text-fg/70 text-sm">{i18n.spinner.rendering}</p>
              </div>
            </div>
          )}
        </div>
        </div>{/* inner flex row */}
      </div>{/* outer flex col */}
    </>
  )
}
