import { useState, useEffect } from 'react'

interface ActionStep {
  type: 'email' | 'meeting'
  description: string
  details: string
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
  const [executingAction, setExecutingAction] = useState<number | null>(null)

  // Reset executed actions when source changes
  useEffect(() => {
    setExecutedActions(new Set())
    setExecutingAction(null)
  }, [sourceType, sourceId])

  // Auto-execute actions when toggle is on and results arrive
  useEffect(() => {
    if (autoExecute && actionSteps && sourceType && sourceId) {
      actionSteps.forEach((_, idx) => {
        if (!executedActions.has(idx)) {
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
      }
    } catch (err) {
      console.error('Failed to execute action:', err)
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

              return (
                <div key={i} className={`action-card ${isExecuted ? 'executed' : ''}`}>
                  <div className="action-card-header">
                    <span className="action-type-badge">
                      {action.type === 'email' ? '📧' : '📅'}{' '}
                      {action.type === 'email' ? 'Email' : 'Meeting'}
                    </span>
                    {isExecuted ? (
                      <span className="action-status executed">✓ Executed</span>
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
                  <h4 className="action-title">{action.description}</h4>
                  <p className="action-details">{action.details}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
