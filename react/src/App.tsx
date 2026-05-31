import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/browser'
import { LocalAssistant, LocalProxy } from '@localflow/core'
import type { AssistantResponse } from '@localflow/core'

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
        header: true, skipEmptyLines: true,
        complete: (r) => resolve(r.data as Record<string, unknown>[]),
        error: reject,
      })
    } else {
      readXlsxFile(file).then(([headers, ...dataRows]) => {
        resolve(dataRows.map(row =>
          Object.fromEntries(headers.map((h, i) => [String(h ?? `col${i + 1}`), row[i]]))
        ))
      }).catch(reject)
    }
  })
}

// ── Key modal ─────────────────────────────────────────────────────────────────
function KeyModal({ current, onSave, onCancel }: {
  current: string
  onSave: (k: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(current)
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <h3 style={{ marginBottom: 8 }}>Gemini API Key</h3>
        <p style={{ color: '#888', fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
          Your key stays in the browser and is never sent to any server.
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
          <button
            onClick={() => onSave(draft.trim())}
            disabled={!draft.trim()}
            style={{ ...S.btn, flex: 1 }}
          >
            Save
          </button>
          {current && (
            <button onClick={onCancel} style={S.btnSecondary}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? '')
  const [showKeyModal, setShowKeyModal] = useState(() => !localStorage.getItem(KEY_STORAGE))
  const [fileName, setFileName] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const assistantRef = useRef<LocalAssistant | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!geminiKey) return
    const proxy = new LocalProxy()
    const assistant = new LocalAssistant({ proxy, llm: { type: 'gemini' } })
    assistant.setLlmApiKey(geminiKey)
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
      content: `Loaded <strong>${file.name}</strong> — ${rows.length} rows.`,
    }])
    // Auto-send initial overview
    await doSend('Show the data', assistantRef.current)
  }

  async function doSend(text: string, assistant: LocalAssistant) {
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const res: AssistantResponse = await assistant.prompt(text)
      const aMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        formula: res.formula || undefined,
      }
      setMessages(prev => [...prev, aMsg])
      if (res.formula) setSrcdoc(assistant.buildSandboxDocument(res.formula))
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

  async function send() {
    const text = input.trim()
    if (!text || loading || !assistantRef.current || !fileName) return
    setInput('')
    await doSend(text, assistantRef.current)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {showKeyModal && (
        <KeyModal
          current={geminiKey}
          onSave={saveKey}
          onCancel={() => setShowKeyModal(false)}
        />
      )}

      <div style={S.layout}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          <div style={S.sidebarHeader}>
            <span style={{ fontWeight: 600 }}>LocalFlow</span>
            <button
              onClick={() => setShowKeyModal(true)}
              title="Edit API key"
              style={S.iconBtn}
            >
              🔑
            </button>
          </div>

          <label style={S.uploadLabel}>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
            {fileName
              ? <span style={{ color: '#7cf', fontSize: 12 }}>📄 {fileName}</span>
              : <span style={{ color: '#888' }}>+ Load CSV / Excel</span>}
          </label>

          <div style={S.messages}>
            {messages.map(msg => (
              <div key={msg.id} style={msg.role === 'user' ? S.userBubble : S.aiBubble}>
                {msg.role === 'assistant'
                  ? <span dangerouslySetInnerHTML={{ __html: msg.content }} />
                  : msg.content}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#7dd3fc', fontSize: 12 }}>
                <svg style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                <span>Thinking… <span style={{ color: '#93c5fd' }}>this may take a while</span></span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

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
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, opacity: 0.6, padding: 2,
  },
  uploadLabel: {
    display: 'block', padding: '10px 16px',
    borderBottom: '1px solid #1a1a1a', cursor: 'pointer',
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
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
    borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, flexShrink: 0,
  },
  main: { flex: 1, overflow: 'hidden', background: '#0f0f0f' },
  empty: {
    height: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#444',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: 12, padding: 24, width: 360,
  },
  input: {
    width: '100%', background: '#111', color: '#f0f0f0', border: '1px solid #333',
    borderRadius: 8, padding: '8px 12px', fontSize: 14, marginBottom: 12,
    outline: 'none', fontFamily: 'inherit',
  },
  btn: {
    background: '#1d4ed8', color: '#fff', border: 'none',
    borderRadius: 8, padding: '8px 0', fontSize: 14, cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent', color: '#888', border: '1px solid #333',
    borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer',
  },
}
