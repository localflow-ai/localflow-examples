import './style.css'
import { marked } from 'marked'
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/browser'
import { LocalAssistant, LocalProxy, LocalProxyRateLimitError } from '@localflow/core'

const KEY_STORAGE = 'lf_gemini_key'
const DEMO_KEY = import.meta.env.VITE_GEMINI_DEMO_KEY ?? ''
const RATE_LIMIT_PER_DAY = 20

// ── DOM refs ──────────────────────────────────────────────────────────────────
const keyOverlay    = document.getElementById('key-overlay')
const keyInput      = document.getElementById('key-input')
const keyNotice     = document.getElementById('key-notice')
const saveKeyBtn    = document.getElementById('save-key-btn')
const clearKeyBtn   = document.getElementById('clear-key-btn')
const cancelKeyBtn  = document.getElementById('cancel-key-btn')
const keyBtn        = document.getElementById('key-btn')
const keyBtnDrop    = document.getElementById('key-btn-drop')
const dropPage      = document.getElementById('drop-page')
const dropZone      = document.getElementById('drop-zone')
const dropIcon      = document.getElementById('drop-icon')
const browseBtn     = document.getElementById('browse-btn')
const fileInput     = document.getElementById('file-input')
const spinnerPage   = document.getElementById('spinner-page')
const spinnerLabel  = document.getElementById('spinner-label')
const spinnerSub    = document.getElementById('spinner-sublabel')
const appDiv        = document.getElementById('app')
const resetBtn      = document.getElementById('reset-btn')
const fileChip      = document.getElementById('file-chip')
const rowCount      = document.getElementById('row-count')
const messages      = document.getElementById('messages')
const emptyMsg      = document.getElementById('empty-msg')
const chatInput     = document.getElementById('chat-input')
const sendBtn       = document.getElementById('send-btn')
const emptyPanel    = document.getElementById('empty')
const resultFrame   = document.getElementById('result-frame')

const logo = '/src/logo.webp'

// ── State ─────────────────────────────────────────────────────────────────────
let assistant = null
let geminiKey = localStorage.getItem(KEY_STORAGE) ?? ''
let phase = 'idle'   // idle | parsing | analyzing | ready
let loading = false

// ── Phase management ──────────────────────────────────────────────────────────
function setPhase(p) {
  phase = p
  dropPage.classList.toggle('hidden', p !== 'idle')
  spinnerPage.classList.toggle('hidden', p !== 'parsing' && p !== 'analyzing')
  appDiv.classList.toggle('hidden', p !== 'ready')
}

function showSpinner(label, sublabel = '') {
  spinnerLabel.textContent = label
  spinnerSub.textContent = sublabel
}

// ── Assistant init ────────────────────────────────────────────────────────────
function initAssistant() {
  const proxy = new LocalProxy({
    geminiApiKey: DEMO_KEY,
    rateLimit: (DEMO_KEY && !geminiKey) ? { maxPerDay: RATE_LIMIT_PER_DAY } : undefined,
  })
  assistant = new LocalAssistant({
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
}

initAssistant()

// ── Key modal ─────────────────────────────────────────────────────────────────
function openKeyModal(notice) {
  keyInput.value = ''
  saveKeyBtn.disabled = true
  keyNotice.textContent = notice ?? ''
  keyNotice.classList.toggle('hidden', !notice)
  clearKeyBtn.classList.toggle('hidden', !geminiKey)
  cancelKeyBtn.classList.toggle('hidden', !geminiKey && !notice)
  keyOverlay.classList.remove('hidden')
  keyInput.focus()
}

function closeKeyModal() {
  keyOverlay.classList.add('hidden')
}

function saveKey(k) {
  if (k) {
    localStorage.setItem(KEY_STORAGE, k)
  } else {
    localStorage.removeItem(KEY_STORAGE)
  }
  geminiKey = k
  initAssistant()
  closeKeyModal()
}

keyInput.addEventListener('input', () => { saveKeyBtn.disabled = !keyInput.value.trim() })
keyInput.addEventListener('keydown', e => { if (e.key === 'Enter' && keyInput.value.trim()) saveKey(keyInput.value.trim()) })
saveKeyBtn.addEventListener('click', () => saveKey(keyInput.value.trim()))
clearKeyBtn.addEventListener('click', () => saveKey(''))
cancelKeyBtn.addEventListener('click', closeKeyModal)
keyBtn.addEventListener('click', () => openKeyModal())
keyBtnDrop.addEventListener('click', () => openKeyModal())

// Show modal on first load if no key and no demo key
if (!geminiKey && !DEMO_KEY) openKeyModal()

// ── Drop zone ─────────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', e => {
  e.preventDefault()
  dropZone.classList.add('border-primary', 'bg-primary/5', 'scale-[1.01]')
  dropZone.classList.remove('border-white/20', 'bg-white/[0.03]')
  dropIcon.setAttribute('stroke', 'oklch(0.68 0.14 175)')
})
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('border-primary', 'bg-primary/5', 'scale-[1.01]')
  dropZone.classList.add('border-white/20', 'bg-white/[0.03]')
  dropIcon.setAttribute('stroke', 'oklch(0.63 0 0)')
})
dropZone.addEventListener('drop', e => {
  e.preventDefault()
  dropZone.classList.remove('border-primary', 'bg-primary/5', 'scale-[1.01]')
  dropZone.classList.add('border-white/20', 'bg-white/[0.03]')
  dropIcon.setAttribute('stroke', 'oklch(0.63 0 0)')
  const file = e.dataTransfer.files?.[0]
  if (file) handleFile(file)
})
browseBtn.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', e => {
  const file = e.target.files?.[0]
  if (file) handleFile(file)
})

// ── File handling ─────────────────────────────────────────────────────────────
async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: r => resolve(r.data),
        error: reject,
      })
    } else {
      readXlsxFile(file).then(result => {
        const rows = result[0]?.data ?? result
        const [headers, ...dataRows] = rows
        resolve(dataRows.map(row =>
          Object.fromEntries(headers.map((h, i) => {
            const v = row[i]
            return [String(h ?? `col${i + 1}`), v instanceof Date ? v.toLocaleDateString() : v]
          }))
        ))
      }).catch(reject)
    }
  })
}

async function handleFile(file) {
  if (!assistant) return

  setPhase('parsing')
  showSpinner('Loading data in the browser…', 'Your file is being read locally. Nothing is sent anywhere yet.')

  let rows
  try {
    rows = await parseFile(file)
  } catch {
    setPhase('idle')
    return
  }

  fileChip.textContent = file.name
  rowCount.textContent = `${rows.length} rows`
  assistant.clearHistory()
  assistant.clearDatasets?.()
  assistant.addDataset('data', rows)

  setPhase('analyzing')
  showSpinner('Analyzing with metadata-first AI…', 'Only column names and statistics are shared with the AI — your actual data never leaves the browser.')

  let initAnswer = ''
  try {
    const res = await assistant.prompt('Show the data')
    if (res.formula) showResult(assistant.buildSandboxDocument(res.formula))
    initAnswer = res.answer
  } catch (err) {
    handlePromptError(err)
    setPhase('idle')
    return
  }

  clearMessages()
  if (initAnswer) appendMessage('ai', initAnswer)
  chatInput.disabled = false
  updateSendBtn()
  setPhase('ready')
}

// ── Reset ─────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  assistant?.clearHistory()
  resultFrame.classList.add('hidden')
  emptyPanel.classList.remove('hidden')
  fileInput.value = ''
  setPhase('idle')
})

// ── Messaging ─────────────────────────────────────────────────────────────────
function handlePromptError(err) {
  if (err instanceof LocalProxyRateLimitError) {
    openKeyModal(`You've used the ${RATE_LIMIT_PER_DAY} daily demo requests. Enter your own key to continue.`)
  } else if (err.message?.includes('429')) {
    openKeyModal('The shared demo key has reached its limit. Enter your own key to continue.')
  } else {
    appendMessage('ai', `Error: ${err.message}`)
  }
}

async function doSend(text) {
  if (loading || !assistant) return
  loading = true
  setLoading(true)
  appendMessage('user', text)
  const thinking = appendThinking()
  try {
    const res = await assistant.prompt(text)
    thinking.remove()
    appendMessage('ai', res.answer)
    if (res.formula) showResult(assistant.buildSandboxDocument(res.formula))
  } catch (err) {
    thinking.remove()
    handlePromptError(err)
  } finally {
    loading = false
    setLoading(false)
  }
}

sendBtn.addEventListener('click', async () => {
  const text = chatInput.value.trim()
  if (!text || loading) return
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
  sendBtn.disabled = on || !chatInput.value.trim()
}

function updateSendBtn() {
  sendBtn.disabled = !chatInput.value.trim() || loading
}

function clearMessages() {
  messages.innerHTML = ''
  emptyMsg.classList.add('hidden')
}

function appendMessage(role, content) {
  emptyMsg.classList.add('hidden')
  const row = document.createElement('div')
  row.className = `flex items-end gap-1.5 ${role === 'user' ? 'flex-row-reverse' : 'flex-row'}`

  const avatar = document.createElement('div')
  if (role === 'ai') {
    avatar.className = 'shrink-0 mb-0.5'
    avatar.innerHTML = `<img src="${logo}" alt="AI" class="w-5 h-5 rounded-[4px]" />`
  } else {
    avatar.className = 'w-5 h-5 rounded-full bg-user-bubble flex items-center justify-center shrink-0 mb-0.5'
    avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-3 h-3 text-fg/70"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`
  }

  const bubble = document.createElement('div')
  bubble.className = `rounded-xl px-3 py-2 max-w-[80%] text-sm leading-snug ${role === 'user' ? 'bg-user-bubble text-fg' : 'bg-card text-fg'}`

  if (role === 'ai') {
    bubble.className += ' [&_p]:my-0.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-0.5 [&_ul]:pl-4 [&_ol]:my-0.5 [&_ol]:pl-4 [&_li]:my-0 [&_strong]:font-semibold [&_em]:italic [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-medium'
    bubble.innerHTML = marked.parse(content)
  } else {
    bubble.textContent = content
  }

  row.appendChild(avatar)
  row.appendChild(bubble)
  messages.appendChild(row)
  row.scrollIntoView({ behavior: 'smooth', block: 'end' })
  return row
}

function appendThinking() {
  const row = document.createElement('div')
  row.className = 'flex items-end gap-1.5 flex-row'
  row.innerHTML = `
    <img src="${logo}" alt="AI" class="w-5 h-5 rounded-[4px] shrink-0 mb-0.5" />
    <div class="bg-card rounded-xl px-3 py-2.5 flex gap-1.5 items-center">
      <span class="w-2 h-2 rounded-full bg-primary inline-block" style="animation:bounce 1.2s ease-in-out infinite;animation-delay:0s"></span>
      <span class="w-2 h-2 rounded-full bg-primary inline-block" style="animation:bounce 1.2s ease-in-out infinite;animation-delay:0.2s"></span>
      <span class="w-2 h-2 rounded-full bg-primary inline-block" style="animation:bounce 1.2s ease-in-out infinite;animation-delay:0.4s"></span>
    </div>
  `
  messages.appendChild(row)
  row.scrollIntoView({ behavior: 'smooth', block: 'end' })
  return row
}

function showResult(srcdoc) {
  emptyPanel.classList.add('hidden')
  resultFrame.classList.remove('hidden')
  resultFrame.srcdoc = srcdoc
}

// Start in idle phase
setPhase('idle')
