import { useState } from 'react'
import ChatWindow from './components/ChatWindow.jsx'
import ChatInput from './components/ChatInput.jsx'
import './App.css'

const THREAD_KEY = 'travel-agent-thread-id'
const MESSAGES_KEY = 'travel-agent-messages'

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — ignore */
  }
}

function initialThreadId() {
  const existing = load(THREAD_KEY, null)
  if (existing) return existing
  const id = crypto.randomUUID()
  save(THREAD_KEY, id)
  return id
}

export default function App() {
  const [threadId, setThreadId] = useState(initialThreadId)
  const [messages, setMessages] = useState(() => load(MESSAGES_KEY, []))
  const [loading, setLoading] = useState(false)

  function updateMessages(updater) {
    setMessages((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      save(MESSAGES_KEY, next)
      return next
    })
  }

  async function sendMessage(text) {
    const content = text.trim()
    if (!content || loading) return

    updateMessages((prev) => [...prev, { role: 'user', content }])
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, threadId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      updateMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, toolsUsed: data.toolsUsed ?? [] },
      ])
    } catch (err) {
      updateMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${err.message}`, error: true },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function newChat() {
    fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    }).catch(() => {})
    const id = crypto.randomUUID()
    save(THREAD_KEY, id)
    setThreadId(id)
    updateMessages([])
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="logo" aria-hidden>✈️</span>
          <div>
            <h1>Wanderly</h1>
            <p>Your AI travel agent · web search + live weather</p>
          </div>
        </div>
        <button className="new-chat" onClick={newChat} disabled={loading}>
          New chat
        </button>
      </header>
      <ChatWindow messages={messages} loading={loading} onSuggestion={sendMessage} />
      <ChatInput onSend={sendMessage} disabled={loading} />
    </div>
  )
}
