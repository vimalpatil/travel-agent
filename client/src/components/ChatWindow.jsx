import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'

const SUGGESTIONS = [
  "What's the weather in Tokyo right now?",
  'Plan a 3-day itinerary for Lisbon',
  "I'm vegetarian and on a tight budget",
  'Do US citizens need a visa for Vietnam?',
]

export default function ChatWindow({ messages, loading, onSuggestion }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <main className="chat-window">
      {messages.length === 0 && !loading && (
        <div className="empty-state">
          <h2>Where to next?</h2>
          <p>
            Ask about destinations, itineraries or the weather. Tell me your preferences and I'll
            remember them for this chat.
          </p>
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => onSuggestion(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m, i) => (
        <MessageBubble key={i} message={m} />
      ))}

      {loading && (
        <div className="message assistant">
          <div className="bubble typing" aria-label="Assistant is typing">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </main>
  )
}
