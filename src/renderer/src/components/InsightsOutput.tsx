import { useState, useEffect } from 'react'

interface ActionStep {
  type: 'email' | 'meeting'
  description: string
  details: string
  to?: string
  subject?: string
  body?: string
  meetingSummary?: string
  attendees?: string[]
  durationMinutes?: number
}

interface InsightsOutputProps {
  keyInsights: string[] | null
  feedback: string[] | null
  actionSteps: ActionStep[] | null
  loading: boolean
  error: string | null
  sourceType: string | null
  sourceId: string | null
}

export default function InsightsOutput({
  keyInsights,
  feedback,
  actionSteps,
  loading,
  error,
  sourceType,
  sourceId
}: InsightsOutputProps): React.JSX.Element {
  const [autoExecute, setAutoExecute] = useState(false)
  const [executedActions, setExecutedActions] = useState<Set<number>>(new Set())
  const [failedActions, setFailedActions] = useState<Map<number, string>>(new Map())
  const [executingAction, setExecutingAction] = useState<number | null>(null)
  const [expandedAction, setExpandedAction] = useState<number | null>(null)

  // Reset state when source changes
  useEffect(() => {
    setExecutedActions(new Set())
    setFailedActions(new Map())
    setExecutingAction(null)
    setExpandedAction(null)
  }, [sourceType, sourceId])

  // Auto-execute actions when toggle is on and results arrive
  useEffect(() => {
    if (autoExecute && actionSteps && sourceType && sourceId) {
      actionSteps.forEach((_, idx) => {
        if (!executedActions.has(idx) && !failedActions.has(idx)) {
          handleExecuteAction(idx)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExecute, actionSteps, sourceType, sourceId])

  const handleExecuteAction = async (actionIndex: number): Promise<void> => {
    if (!sourceType || !sourceId || executedActions.has(actionIndex)) return

    setExecutingAction(actionIndex)
    try {
      const result = await window.api.executeInsightAction(sourceType, sourceId, actionIndex)
      if (result.success) {
        setExecutedActions((prev) => new Set([...prev, actionIndex]))
        setFailedActions((prev) => {
          const next = new Map(prev)
          next.delete(actionIndex)
          return next
        })
      } else {
        setFailedActions(
          (prev) => new Map([...prev, [actionIndex, result.error || 'Unknown error']])
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to execute action'
      setFailedActions((prev) => new Map([...prev, [actionIndex, msg]]))
    } finally {
      setExecutingAction(null)
    }
  }

  if (loading) {
    return (
      <div className="insights-output">
        <div className="loading-state">
          <div className="loading-spinner" />
          <h3>Analyzing...</h3>
          <p className="loading-sub">Extracting insights from the response</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="insights-output">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Analysis Failed</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!keyInsights) {
    return (
      <div className="insights-output">
        <div className="empty-state">
          <div className="empty-icon">🔎</div>
          <h3>Insights Agent</h3>
          <p>Select an email reply or meeting transcript to extract key insights</p>
          <div className="empty-hints">
            <div className="hint">
              <span className="hint-icon">💬</span>
              <span>Reply → Key Insights</span>
            </div>
            <div className="hint">
              <span className="hint-icon">🎙️</span>
              <span>Transcript → Action Steps</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="insights-output">
      {/* Key Insights Section */}
      <section className="insights-section">
        <div className="section-header">
          <span className="section-icon">💡</span>
          <h2>Key Insights</h2>
        </div>
        <div className="insights-cards">
          {keyInsights.map((insight, i) => (
            <div key={i} className="insight-card">
              <span className="insight-number">{i + 1}</span>
              <p>{insight}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feedback Section */}
      {feedback && feedback.length > 0 && (
        <section className="insights-section">
          <div className="section-header">
            <span className="section-icon">📊</span>
            <h2>Feedback</h2>
          </div>
          <div className="feedback-list">
            {feedback.map((item, i) => (
              <div key={i} className="feedback-item">
                <span className="feedback-bullet">▸</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Action Steps Section */}
      {actionSteps && actionSteps.length > 0 && (
        <section className="insights-section">
          <div className="section-header actions-header">
            <div className="section-header-left">
              <span className="section-icon">🚀</span>
              <h2>Next Actions</h2>
            </div>
            <div className="auto-execute-toggle">
              <label className="toggle-label" htmlFor="auto-execute">
                <span className="toggle-text">Auto-execute</span>
                <div className={`toggle-switch ${autoExecute ? 'active' : ''}`}>
                  <input
                    id="auto-execute"
                    type="checkbox"
                    checked={autoExecute}
                    onChange={(e) => setAutoExecute(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </div>
              </label>
            </div>
          </div>
          <div className="action-cards">
            {actionSteps.map((action, i) => {
              const isExecuted = executedActions.has(i)
              const isExecuting = executingAction === i
              const failError = failedActions.get(i)
              const isExpanded = expandedAction === i

              return (
                <div
                  key={i}
                  className={`action-card ${isExecuted ? 'executed' : ''} ${failError ? 'failed' : ''}`}
                >
                  <div className="action-card-header">
                    <span className="action-type-badge">
                      {action.type === 'email' ? '📧' : '📅'}{' '}
                      {action.type === 'email' ? 'Email' : 'Meeting'}
                    </span>
                    <div className="action-card-controls">
                      <button
                        className="action-preview-btn"
                        onClick={() => setExpandedAction(isExpanded ? null : i)}
                        title={isExpanded ? 'Hide details' : 'Preview details'}
                      >
                        {isExpanded ? '▲ Hide' : '▼ Preview'}
                      </button>
                      {isExecuted ? (
                        <span className="action-status executed">
                          ✓ {action.type === 'email' ? 'Sent' : 'Created'}
                        </span>
                      ) : failError ? (
                        <span className="action-status failed" title={failError}>
                          ✗ Failed
                        </span>
                      ) : (
                        <button
                          className="action-execute-btn"
                          onClick={() => handleExecuteAction(i)}
                          disabled={isExecuting}
                        >
                          {isExecuting ? '⏳ Running...' : '▶ Execute'}
                        </button>
                      )}
                    </div>
                  </div>
                  <h4 className="action-title">{action.description}</h4>
                  <p className="action-details">{action.details}</p>

                  {/* Expanded preview of what will be sent/created */}
                  {isExpanded && (
                    <div className="action-preview">
                      {action.type === 'email' && (
                        <>
                          <div className="preview-field">
                            <span className="preview-label">To:</span>
                            <span className="preview-value">{action.to || '—'}</span>
                          </div>
                          <div className="preview-field">
                            <span className="preview-label">Subject:</span>
                            <span className="preview-value">{action.subject || '—'}</span>
                          </div>
                          <div className="preview-field preview-body">
                            <span className="preview-label">Body:</span>
                            <pre className="preview-email-body">{action.body || '—'}</pre>
                          </div>
                        </>
                      )}
                      {action.type === 'meeting' && (
                        <>
                          <div className="preview-field">
                            <span className="preview-label">Event:</span>
                            <span className="preview-value">
                              {action.meetingSummary || action.description}
                            </span>
                          </div>
                          <div className="preview-field">
                            <span className="preview-label">Duration:</span>
                            <span className="preview-value">
                              {action.durationMinutes || 30} min
                            </span>
                          </div>
                          {action.attendees && action.attendees.length > 0 && (
                            <div className="preview-field">
                              <span className="preview-label">Attendees:</span>
                              <span className="preview-value">{action.attendees.join(', ')}</span>
                            </div>
                          )}
                          <div className="preview-field">
                            <span className="preview-label">When:</span>
                            <span className="preview-value">Next business day at 10:00 AM</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Error details */}
                  {failError && (
                    <div className="action-error">
                      <span className="action-error-icon">⚠️</span>
                      <span>{failError}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
