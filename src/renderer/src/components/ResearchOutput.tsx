interface ResearchOutputProps {
  output: string | null
  toolCalls: { tool: string; query: string }[]
  loading: boolean
  error: string | null
  inputType: 'email' | 'calendar' | null
}

function renderMarkdown(text: string): string {
  // Lightweight markdown → HTML conversion for display
  let html = text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br/>')

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*?<\/li><br\/>?)+)/g, '<ul>$1</ul>')
  html = html.replace(/<ul><br\/>/g, '<ul>')

  return `<p>${html}</p>`
}

export default function ResearchOutput({
  output,
  toolCalls,
  loading,
  error,
  inputType
}: ResearchOutputProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="research-output">
        <div className="loading-state">
          <div className="loading-spinner" />
          <h3>Researching...</h3>
          <p className="loading-sub">
            {inputType === 'calendar'
              ? 'Preparing your meeting guide'
              : 'Drafting your email reply'}
          </p>
          {toolCalls.length > 0 && (
            <div className="tool-calls-live">
              <div className="tool-calls-label">Search queries:</div>
              {toolCalls.map((tc, i) => (
                <div key={i} className="tool-call-item live">
                  <span className="tool-call-icon">🔍</span>
                  <span className="tool-call-query">{tc.query}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="research-output">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Research Failed</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!output) {
    return (
      <div className="research-output">
        <div className="empty-state">
          <div className="empty-icon">🔬</div>
          <h3>Research Agent</h3>
          <p>Select an email or calendar event to start researching</p>
          <div className="empty-hints">
            <div className="hint">
              <span className="hint-icon">✉️</span>
              <span>Email → Draft Reply</span>
            </div>
            <div className="hint">
              <span className="hint-icon">📅</span>
              <span>Event → Meeting Guide</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="research-output">
      <div className="output-header">
        <div className="output-badge">
          {inputType === 'calendar' ? '📋 Meeting Guide' : '✏️ Draft Reply'}
        </div>
        {toolCalls.length > 0 && (
          <div className="output-meta">{toolCalls.length} searches performed</div>
        )}
      </div>

      <div
        className="output-content"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
      />

      {toolCalls.length > 0 && (
        <div className="tool-calls-summary">
          <h4>Research Queries</h4>
          {toolCalls.map((tc, i) => (
            <div key={i} className="tool-call-item">
              <span className="tool-call-icon">🔍</span>
              <span className="tool-call-query">{tc.query}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
