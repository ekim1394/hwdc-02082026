import { useState, useCallback, useRef, useEffect } from 'react'
import InsightsSourcePicker from './InsightsSourcePicker'
import InsightsOutput from './InsightsOutput'

interface ActionStep {
  type: 'email' | 'meeting'
  description: string
  details: string
}

export default function InsightsPage(): React.JSX.Element {
  const [keyInsights, setKeyInsights] = useState<string[] | null>(null)
  const [feedback, setFeedback] = useState<string[] | null>(null)
  const [actionSteps, setActionSteps] = useState<ActionStep[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputType, setInputType] = useState<'email-reply' | 'transcript' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedData, setSelectedData] = useState<unknown | null>(null)

  // --- Resizable split ---
  const [splitPercent, setSplitPercent] = useState(40)
  const isDragging = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current || !contentRef.current) return
      const rect = contentRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const percent = Math.min(Math.max((y / rect.height) * 100, 15), 85)
      setSplitPercent(percent)
    }

    const handleMouseUp = (): void => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleSelect = useCallback(async (type: 'email-reply' | 'transcript', data: unknown) => {
    setInputType(type)
    setSelectedData(data)
    setKeyInsights(null)
    setFeedback(null)
    setActionSteps(null)
    setError(null)

    const itemId = (data as { id: string }).id
    setSelectedId(itemId)

    // Check DB cache first
    const cached = await window.api.getInsights(type, itemId)
    if (cached) {
      setKeyInsights(cached.keyInsights)
      setFeedback(cached.feedback)
      setActionSteps(cached.actionSteps)
      return
    }

    // No cache — run the agent
    setLoading(true)
    try {
      const result = await window.api.runInsights({ type, data })
      if (result.success && result.data) {
        setKeyInsights(result.data.keyInsights)
        setFeedback(result.data.feedback)
        setActionSteps(result.data.actionSteps)
      } else {
        setError(result.error ?? 'Unknown error occurred')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run insights agent')
    } finally {
      setLoading(false)
    }
  }, [])

  const hasSelection = inputType !== null

  // Build a detail view for the selected item
  const renderSourceDetail = (): React.JSX.Element | null => {
    if (!selectedData || !inputType) return null

    if (inputType === 'email-reply') {
      const reply = selectedData as {
        from: string
        subject: string
        body: string
        originalEmailSubject: string
        date: string
      }
      return (
        <div className="source-detail">
          <div className="detail-header">
            <span className="detail-badge reply-badge">Email Reply</span>
            <span className="detail-date">
              {new Date(reply.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </span>
          </div>
          <h3 className="detail-title">{reply.subject}</h3>
          <div className="detail-meta">
            <span>
              <strong>From:</strong> {reply.from}
            </span>
            <span>
              <strong>Re:</strong> {reply.originalEmailSubject}
            </span>
          </div>
          <div className="detail-body">{reply.body}</div>
        </div>
      )
    }

    const transcript = selectedData as {
      title: string
      date: string
      participants: { name: string; role?: string }[]
      transcript: string
    }
    return (
      <div className="source-detail">
        <div className="detail-header">
          <span className="detail-badge transcript-badge">Transcript</span>
          <span className="detail-date">
            {new Date(transcript.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </span>
        </div>
        <h3 className="detail-title">{transcript.title}</h3>
        <div className="detail-attendees">
          <strong>Participants:</strong>
          <div className="attendee-list">
            {transcript.participants.map((p, i) => (
              <span key={i} className="attendee-chip">
                {p.name}
                {p.role && <span className="attendee-company">{p.role}</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="detail-body transcript-body">{transcript.transcript}</div>
      </div>
    )
  }

  return (
    <div className="insights-page-content">
      <InsightsSourcePicker onSelect={handleSelect} disabled={false} />
      <div ref={contentRef} className={`content-area ${hasSelection ? 'has-selection' : ''}`}>
        {hasSelection ? (
          <>
            <div className="content-top" style={{ height: `${splitPercent}%` }}>
              {renderSourceDetail()}
            </div>
            <div
              className="resize-handle"
              onMouseDown={handleMouseDown}
              role="separator"
              aria-orientation="horizontal"
              title="Drag to resize"
            >
              <div className="resize-handle-bar" />
            </div>
            <div className="content-bottom" style={{ height: `${100 - splitPercent}%` }}>
              <InsightsOutput
                keyInsights={keyInsights}
                feedback={feedback}
                actionSteps={actionSteps}
                loading={loading}
                error={error}
                sourceType={inputType}
                sourceId={selectedId}
              />
            </div>
          </>
        ) : (
          <InsightsOutput
            keyInsights={null}
            feedback={null}
            actionSteps={null}
            loading={false}
            error={null}
            sourceType={null}
            sourceId={null}
          />
        )}
      </div>
    </div>
  )
}
