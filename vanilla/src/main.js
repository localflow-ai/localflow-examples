import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { LocalAssistant, LocalProxy } from 'localflow-core'

const KEY_STORAGE = 'lf_gemini_key'

// ── State ─────────────────────────────────────────────────────────────────────
let assistant = null
let fileName = null

// ── DOM refs ──────────────────────────────────────────────────────────────────
const keyOverlay  = document.getElementById('key-overlay')
const keyInput    = document.getElementById('key-input')
const saveKeyBtn  = document.getElementById('save-key-btn')
const cancelKeyBtn = document.getElementById('cancel-key-btn')
const keyBtn      = document.getElementById('key-btn')
const fileInput   = document.getElementById('file-input')
const uploadLabel = document.getElementById('upload-label')
const messages    = document.getElementById('messages')
const chatInput   = document.getElementById('chat-input')
const sendBtn     = document.getElementById('send-btn')
const empty       = document.getElementById('empty')
const resultFrame = document.getElementById('result-frame')

// ── Key modal ─────────────────────────────────────────────────────────────────
function openKeyModal() {
  keyInput.value = ''
  saveKeyBtn.disabled = true
  cancelKeyBtn.style.display = localStorage.getItem(KEY_STORAGE) ? '' : 'none'
  keyOverlay.classList.remove('hidden')
  keyInput.focus()
}

function closeKeyModal() {
  keyOverlay.classList.add('hidden')
}

function saveKey() {
  const k = keyInput.value.trim()
  if (!k) return
  localStorage.setItem(KEY_STORAGE, k)
  initAssistant(k)
  closeKeyModal()
}

keyInput.addEventListener('input', () => {
  saveKeyBtn.disabled = !keyInput.value.trim()
})
keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveKey() })
saveKeyBtn.addEventListener('click', saveKey)
cancelKeyBtn.addEventListener('click', closeKeyModal)
keyBtn.addEventListener('click', openKeyModal)

// Show modal on load if no key saved
const savedKey = localStorage.getItem(KEY_STORAGE)
if (savedKey) {
  initAssistant(savedKey)
  keyOverlay.classList.add('hidden')
} else {
  openKeyModal()
}

// ── Assistant setup ───────────────────────────────────────────────────────────
function initAssistant(key) {
  const proxy = new LocalProxy({ adminToken: 'dev' })
  assistant = new LocalAssistant({ proxy, llm: { type: 'gemini' } })
  assistant.setLlmApiKey(key)
}

// ── File parsing ──────────────────────────────────────────────────────────────
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0]
  if (!file || !assistant) return
  const ext = file.name.split('.').pop()?.toLowerCase()

  const onRows = async (rows) => {
    assistant.clearHistory()
    assistant.addDataset('data', rows)
    fileName = file.name

    uploadLabel.textContent = `📄 ${file.name}`
    uploadLabel.classList.add('loaded')
    chatInput.disabled = false
    chatInput.placeholder = 'Ask something…'
    updateSendBtn()

    showEmpty(false)
    clearMessages()
    appendMessage('ai', `Loaded <strong>${file.name}</strong> — ${rows.length} rows.`)

    // Auto-send initial overview
    await doSend('Show me the data')
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
})

// ── Messaging ─────────────────────────────────────────────────────────────────
async function doSend(text) {
  appendMessage('user', text)
  setLoading(true)
  const thinking = appendMessage('ai', `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    <span>Thinking… <span style="color:#444">this may take a few seconds</span></span>
  `, 'thinking')
  try {
    const res = await assistant.prompt(text)
    thinking.remove()
    appendMessage('ai', res.answer)
    if (res.formula) showResult(assistant.buildSandboxDocument(res.formula))
  } catch (err) {
    thinking.remove()
    appendMessage('ai', `Error: ${err.message}`)
  } finally {
    setLoading(false)
  }
}

sendBtn.addEventListener('click', async () => {
  const text = chatInput.value.trim()
  if (!text || !assistant || !fileName) return
  chatInput.value = ''
  chatInput.style.height = 'auto'
  updateSendBtn()
  await doSend(text)
})

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto'
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'
  updateSendBtn()
})

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click() }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function setLoading(on) {
  chatInput.disabled = on
  sendBtn.disabled = on
}

function updateSendBtn() {
  sendBtn.disabled = !chatInput.value.trim() || !fileName
}

function appendMessage(role, html, extraClass = '') {
  const div = document.createElement('div')
  div.className = `bubble ${role}${extraClass ? ' ' + extraClass : ''}`
  div.innerHTML = html
  messages.appendChild(div)
  div.scrollIntoView({ behavior: 'smooth', block: 'end' })
  return div
}

function clearMessages() {
  messages.innerHTML = ''
}

function showEmpty(visible) {
  empty.style.display = visible ? 'flex' : 'none'
  resultFrame.style.display = visible ? 'none' : 'none'
}

function showResult(srcdoc) {
  empty.style.display = 'none'
  resultFrame.style.display = 'block'
  resultFrame.srcdoc = srcdoc
}
