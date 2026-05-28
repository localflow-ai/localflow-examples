import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { LocalAssistant, LocalProxy } from 'localflow-core'

const KEY_STORAGE = 'lf_gemini_key'

// ── State ─────────────────────────────────────────────────────────────────────
let assistant = null
let fileName = null

// ── DOM refs ──────────────────────────────────────────────────────────────────
const app          = document.getElementById('app')
const keyScreen    = document.getElementById('key-screen')
const keyInput     = document.getElementById('key-input')
const saveKeyBtn   = document.getElementById('save-key-btn')

// ── Key screen ────────────────────────────────────────────────────────────────
const savedKey = localStorage.getItem(KEY_STORAGE)
if (savedKey) {
  initAssistant(savedKey)
  mountLayout()
}

saveKeyBtn.addEventListener('click', () => {
  const key = keyInput.value.trim()
  if (!key) return
  localStorage.setItem(KEY_STORAGE, key)
  initAssistant(key)
  mountLayout()
})

keyInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveKeyBtn.click()
})

// ── Assistant setup ───────────────────────────────────────────────────────────
function initAssistant(key) {
  const proxy = new LocalProxy({ adminToken: 'dev' })
  assistant = new LocalAssistant({ proxy, llm: { type: 'gemini' } })
  assistant.setLlmApiKey(key)
}

// ── Layout ────────────────────────────────────────────────────────────────────
function mountLayout() {
  app.innerHTML = `
    <div id="sidebar">
      <div id="sidebar-header">
        <span style="font-weight:600">LocalFlow</span>
        <span style="color:#555;font-size:11px">local mode</span>
      </div>
      <label id="upload-label">
        <input type="file" id="file-input" accept=".csv,.xlsx,.xls" style="display:none" />
        + Load CSV / Excel
      </label>
      <div id="messages"></div>
      <div id="input-row">
        <textarea id="chat-input" rows="1" placeholder="Load a file first" disabled></textarea>
        <button id="send-btn" disabled>↑</button>
      </div>
    </div>
    <div id="main">
      <div id="empty">Load a file to get started.</div>
    </div>
  `

  document.getElementById('file-input').addEventListener('change', handleFileChange)

  const chatInput = document.getElementById('chat-input')
  const sendBtn   = document.getElementById('send-btn')

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto'
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'
    sendBtn.disabled = !chatInput.value.trim() || !fileName
  })

  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click() }
  })

  sendBtn.addEventListener('click', sendMessage)
}

// ── File parsing ──────────────────────────────────────────────────────────────
function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const ext = file.name.split('.').pop()?.toLowerCase()

  const onRows = (rows) => {
    assistant.clearHistory()
    assistant.addDataset('data', rows)
    fileName = file.name

    const label = document.getElementById('upload-label')
    label.textContent = `📄 ${file.name}`
    label.classList.add('loaded')

    const chatInput = document.getElementById('chat-input')
    chatInput.disabled = false
    chatInput.placeholder = 'Ask something…'

    setEmpty('Ask a question to see the analysis here.')
    clearMessages()
    appendMessage('ai', `Loaded <strong>${file.name}</strong> — ${rows.length} rows. Ask me anything about your data.`)
  }

  if (ext === 'csv') {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: r => onRows(r.data),
    })
  } else {
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' })
      onRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]))
    }
    reader.readAsArrayBuffer(file)
  }
}

// ── Messaging ─────────────────────────────────────────────────────────────────
async function sendMessage() {
  const chatInput = document.getElementById('chat-input')
  const sendBtn   = document.getElementById('send-btn')
  const text = chatInput.value.trim()
  if (!text || !assistant || !fileName) return

  appendMessage('user', text)
  chatInput.value = ''
  chatInput.style.height = 'auto'
  sendBtn.disabled = true
  chatInput.disabled = true

  const thinking = appendMessage('ai', 'Thinking…', 'thinking')

  try {
    const res = await assistant.prompt(text)
    thinking.remove()
    appendMessage('ai', res.answer)
    if (res.formula) {
      showResult(assistant.buildSandboxDocument(res.formula))
    }
  } catch (err) {
    thinking.remove()
    appendMessage('ai', `Error: ${err.message}`)
  } finally {
    chatInput.disabled = false
    sendBtn.disabled = false
    chatInput.focus()
  }
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function appendMessage(role, html, extraClass = '') {
  const messages = document.getElementById('messages')
  const div = document.createElement('div')
  div.className = `bubble ${role}${extraClass ? ' ' + extraClass : ''}`
  div.innerHTML = html
  messages.appendChild(div)
  div.scrollIntoView({ behavior: 'smooth', block: 'end' })
  return div
}

function clearMessages() {
  document.getElementById('messages').innerHTML = ''
}

function setEmpty(text) {
  const main = document.getElementById('main')
  const existing = document.getElementById('result-frame')
  if (existing) existing.remove()
  let empty = document.getElementById('empty')
  if (!empty) {
    empty = document.createElement('div')
    empty.id = 'empty'
    main.appendChild(empty)
  }
  empty.textContent = text
}

function showResult(srcdoc) {
  const main = document.getElementById('main')
  const empty = document.getElementById('empty')
  if (empty) empty.remove()
  let frame = document.getElementById('result-frame')
  if (!frame) {
    frame = document.createElement('iframe')
    frame.id = 'result-frame'
    frame.setAttribute('sandbox', 'allow-scripts allow-downloads')
    frame.setAttribute('title', 'Analysis result')
    main.appendChild(frame)
  }
  frame.srcdoc = srcdoc
}
