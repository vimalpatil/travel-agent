import { useEffect, useRef, useState } from 'react'

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!disabled) ref.current?.focus()
  }, [disabled])

  function submit(e) {
    e?.preventDefault()
    if (!text.trim() || disabled) return
    onSend(text)
    setText('')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form className="chat-input" onSubmit={submit}>
      <textarea
        ref={ref}
        rows={1}
        value={text}
        placeholder="Ask about a destination, itinerary or the weather…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !text.trim()} aria-label="Send">
        Send
      </button>
    </form>
  )
}
