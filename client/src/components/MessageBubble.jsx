import ReactMarkdown from 'react-markdown'

const TOOL_LABELS = {
  web_search: '🔎 Web search',
  weather_lookup: '🌤️ Weather',
}

export default function MessageBubble({ message }) {
  const { role, content, toolsUsed = [], error } = message
  return (
    <div className={`message ${role}`}>
      <div className={`bubble${error ? ' error' : ''}`}>
        {role === 'assistant' ? (
          <ReactMarkdown
            components={{
              a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          content
        )}
      </div>
      {toolsUsed.length > 0 && (
        <div className="tools">
          {toolsUsed.map((t) => (
            <span key={t} className="tool-badge">
              {TOOL_LABELS[t] ?? t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
