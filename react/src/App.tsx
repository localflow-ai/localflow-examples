import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { LocalAssistant, LocalProxy } from 'localflow-core'
import type { AssistantResponse } from 'localflow-core'

const KEY_STORAGE = 'lf_gemini_key'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  formula?: string
}

function parseFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => resolve(r.data as Record<string, unknown>[]),
        error: reject,
      })
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        const wb = XLSX.read(e.target!.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(ws))
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    }
  })
}

export default function App() {
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? '')
  const [keyDraft, setKeyDraft] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const assistantRef = useRef<LocalAssistant | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Build assistant when key is set
  useEffect(() => {
    if (!geminiKey) return
    const proxy = new LocalProxy({ adminToken: 'dev' })
    const assistant = new LocalAssistant({ proxy, llm: { type: 'gemini' } })
    assistant.setLlmApiKey(geminiKey)
    assistantRef.current = assistant
  }, [geminiKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function saveKey() {
    const k = keyDraft.trim()
    if (!k) return
    localStorage.setItem(KEY_STORAGE, k)
    setGeminiKey(k)
    setKeyDraft('')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !assistantRef.current) return
    const rows = await parseFile(file)
    assistantRef.current.clearHistory()
    assistantRef.current.addDataset('data', rows)
    setFileName(file.name)
    setSrcdoc(null)
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Loaded <strong>${file.name}</strong> — ${rows.length} rows. Ask me anything about your data.`,
    }])
  }

  async function send() {
    const text = input.trim()
    if (!text || loading || !assistantRef.current || !fileName) return
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res: AssistantResponse = await assistantRef.current.prompt(text)
      const aMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        formula: res.formula || undefined,
      }
      setMessages(prev => [...prev, aMsg])
      if (res.formula) {
        setSrcdoc(assistantRef.current.buildSandboxDocument(res.formula))
      }
    } catch (err: unknown) {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${(err as Error).message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── Key setup screen ──────────────────────────────────────────────────────
  if (!geminiKey) {
    return (
      <div style={S.center}>
        <div style={S.card}>
          <h2 style={{ marginBottom: 8 }}>LocalFlow Example</h2>
          <p style={{ color: '#888', marginBottom: 16, lineHeight: 1.5 }}>
            Enter your Gemini API key to get started.<br />
            It stays in your browser — nothing is sent to any server.
          </p>
          <input
            type="password"
            value={keyDraft}
            onChange={e => setKeyDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
            placeholder="AIza..."
            style={S.input}
            autoFocus
          />
          <button onClick={saveKey} disabled={!keyDraft.trim()} style={S.btn}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div style={S.layout}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <span style={{ fontWeight: 600 }}>LocalFlow</span>
          <span style={{ color: '#555', fontSize: 11 }}>local mode</span>
        </div>

        {/* File upload */}
        <label style={S.uploadLabel}>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          {fileName ? (
            <span style={{ color: '#7cf', fontSize: 12 }}>📄 {fileName}</span>
          ) : (
            <span style={{ color: '#888' }}>+ Load CSV / Excel</span>
          )}
        </label>

        {/* Chat messages */}
        <div style={S.messages}>
          {messages.map(msg => (
            <div key={msg.id} style={msg.role === 'user' ? S.userBubble : S.aiBubble}>
              {msg.role === 'assistant'
                ? <span dangerouslySetInnerHTML={{ __html: msg.content }} />
                : msg.content}
            </div>
          ))}
          {loading && <div style={{ color: '#666', fontSize: 12 }}>Thinking…</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={S.inputRow}>
          <textarea
            value={input}
            rows={1}
            disabled={loading || !fileName}
            placeholder={fileName ? 'Ask something…' : 'Load a file first'}
            style={S.textarea}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || !fileName}
            style={S.sendBtn}
          >
            ↑
          </button>
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
          <div style={S.empty}>
            {fileName ? 'Ask a question to see the analysis here.' : 'Load a file to get started.'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Minimal inline styles ─────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 300, display: 'flex', flexDirection: 'column',
    borderRight: '1px solid #222', background: '#111',
  },
  sidebarHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid #222',
  },
  uploadLabel: {
    display: 'block', padding: '10px 16px',
    borderBottom: '1px solid #1a1a1a', cursor: 'pointer',
  },
  messages: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  userBubble: {
    alignSelf: 'flex-end', background: '#1d4ed8', color: '#fff',
    borderRadius: 10, padding: '6px 10px', maxWidth: '85%', fontSize: 12, lineHeight: 1.5,
  },
  aiBubble: {
    alignSelf: 'flex-start', background: '#1e1e1e',
    borderRadius: 10, padding: '6px 10px', maxWidth: '85%', fontSize: 12, lineHeight: 1.5,
  },
  inputRow: {
    display: 'flex', gap: 6, padding: '10px 12px',
    borderTop: '1px solid #222', alignItems: 'flex-end',
  },
  textarea: {
    flex: 1, background: '#1a1a1a', color: '#f0f0f0', border: '1px solid #333',
    borderRadius: 8, padding: '6px 10px', fontSize: 12, resize: 'none',
    outline: 'none', fontFamily: 'inherit', minHeight: 32, maxHeight: 120,
  },
  sendBtn: {
    background: '#1d4ed8', color: '#fff', border: 'none',
    borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16,
    flexShrink: 0,
  },
  main: { flex: 1, overflow: 'hidden', background: '#0f0f0f' },
  empty: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' },
  center: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 24, width: 360 },
  input: {
    width: '100%', background: '#111', color: '#f0f0f0', border: '1px solid #333',
    borderRadius: 8, padding: '8px 12px', fontSize: 14, marginBottom: 12, outline: 'none',
  },
  btn: {
    width: '100%', background: '#1d4ed8', color: '#fff', border: 'none',
    borderRadius: 8, padding: '8px 0', fontSize: 14, cursor: 'pointer',
  },
}
