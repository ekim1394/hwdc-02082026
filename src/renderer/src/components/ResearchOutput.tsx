import { useState } from 'react'

interface EmailData {
  id: string
  from: string
  to: string
  subject: string
  body: string
  threadId?: string
  messageId?: string
}

interface ResearchOutputProps {
  output: string | null
  toolCalls: { tool: string; query: string }[]
  loading: boolean
  error: string | null
  inputType: 'email' | 'calendar' | null
  emailData?: EmailData | null
  isAuthenticated?: boolean
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')

  html = html.replace(/((?:<li>.*?<\/li><br\/?>)+)/g, '<ul>$1</ul>')
  html = html.replace(/<ul><br\/>/g, '<ul>')

  return `<p>${html}</p>`
}

export default function ResearchOutput({
  output,
  toolCalls,
  loading,
  error,
  inputType,
  emailData,
  isAuthenticated
}: ResearchOutputProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState<string | null>(null)

  const handleCopy = (): void => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSend = async (): Promise<void> => {
    if (!output || !emailData || !isAuthenticated) return

    setSendState('sending')
    setSendError(null)

    try {
      const result = await window.api.sendEmailReply(
        emailData.from,
        emailData.subject,
        output,
        emailData.threadId,
        emailData.messageId
      )

      if (result.success) {
        setSendState('sent')
      } else {
        setSendState('error')
        setSendError(result.error || 'Failed to send')
      }
    } catch (err) {
      setSendState('error')
      setSendError(err instanceof Error ? err.message : 'Failed to send')
    }
  }

  if (loading) {
    return (
      <div className="research-output">
        <div className="loading-state">
          <div className="loading-spinner" />
          <h3>Researching...</h3>
          <p className="loading-sub">
            {inputType === 'calendar'
              ? 'Preparing your meeting briefing'
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
              <span>Event → Briefing</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isEmail = inputType === 'email'
  const canSend = isEmail && isAuthenticated && emailData && sendState !== 'sent'

  const sendButtonLabel = (): string => {
    switch (sendState) {
      case 'sending':
        return '⏳ Sending...'
      case 'sent':
        return '✓ Sent!'
      case 'error':
        return '⚠️ Retry'
      default:
        return '✉️ Send'
    }
  }

  return (
    <div className="research-output">
      <div className="output-header">
        <div className="output-badge">{isEmail ? '✏️ Draft Reply' : '📋 Meeting Briefing'}</div>
        <div className="output-actions">
          {isEmail && (
            <>
              <button className="action-btn copy-btn" onClick={handleCopy}>
                {copied ? '✓ Copied' : '📋 Copy Draft'}
              </button>
              <button
                className={`action-btn send-btn ${sendState === 'sent' ? 'sent' : ''} ${sendState === 'error' ? 'send-error' : ''}`}
                disabled={!canSend || sendState === 'sending'}
                onClick={handleSend}
                title={
                  !isAuthenticated
                    ? 'Connect Google to send emails'
                    : sendError || 'Send reply via Gmail'
                }
              >
                {sendButtonLabel()}
              </button>
            </>
          )}
          {toolCalls.length > 0 && <span className="output-meta">{toolCalls.length} searches</span>}
        </div>
      </div>

      <div
        className={`output-content ${isEmail ? 'email-draft' : ''}`}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
      />
    </div>
  )
}
