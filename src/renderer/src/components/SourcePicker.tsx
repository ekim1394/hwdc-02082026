import { useState, useEffect } from 'react'

interface Email {
  id: string
  from: string
  to: string
  subject: string
  snippet: string
  body: string
  date: string
  threadId?: string
}

interface CalendarEvent {
  id: string
  summary: string
  description: string
  start: string
  end: string
  attendees: { name: string; email: string; company?: string }[]
  location?: string
}

interface SourcePickerProps {
  onSelect: (type: 'email' | 'calendar', data: Email | CalendarEvent) => void
  disabled: boolean
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function SourcePicker({ onSelect, disabled }: SourcePickerProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'email' | 'calendar'>('email')
  const [emails, setEmails] = useState<Email[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, 'pending' | 'done'>>({})

  // Thread expansion: maps an email id → fetched thread messages (excluding the clicked email)
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<Email[]>([])
  const [threadLoading, setThreadLoading] = useState(false)

  // Fetch data + statuses
  useEffect(() => {
    const fetchData = (): void => {
      window.api.getEmails().then(setEmails)
      window.api.getEvents().then(setEvents)
      window.api.getProcessingStatuses().then(setStatuses)
    }
    fetchData()
    const interval = setInterval(fetchData, 5_000)
    return () => clearInterval(interval)
  }, [])

  // Listen for processing updates from main process
  useEffect(() => {
    window.api.onItemProcessed(() => {
      window.api.getProcessingStatuses().then(setStatuses)
    })
    window.api.onProcessingComplete(() => {
      window.api.getProcessingStatuses().then(setStatuses)
    })
  }, [])

  const handleSelect = (type: 'email' | 'calendar', item: Email | CalendarEvent): void => {
    setSelectedId(item.id)
    onSelect(type, item)
  }

  const getStatus = (type: 'email' | 'calendar', id: string): 'pending' | 'done' | 'new' => {
    const key = `${type}:${id}`
    return statuses[key] || 'new'
  }

  const handleEmailClick = async (email: Email): Promise<void> => {
    handleSelect('email', email)

    // Toggle thread expansion
    if (expandedEmailId === email.id) {
      // Collapse if already expanded
      setExpandedEmailId(null)
      setThreadMessages([])
      return
    }

    // If the email has a threadId, fetch the thread
    if (email.threadId) {
      setExpandedEmailId(email.id)
      setThreadLoading(true)
      try {
        const thread = (await window.api.getEmailThread(email.threadId)) as Email[]
        // Filter out the clicked email and sort oldest-first for conversation order
        const others = thread
          .filter((m) => m.id !== email.id)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        setThreadMessages(others)
      } catch {
        setThreadMessages([])
      } finally {
        setThreadLoading(false)
      }
    } else {
      setExpandedEmailId(null)
      setThreadMessages([])
    }
  }

  return (
    <div className="source-picker">
      <div className="picker-header">
        <h2>Sources</h2>
        <div className="tab-bar">
          <button
            className={`tab ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => setActiveTab('email')}
            disabled={disabled}
          >
            <span className="tab-icon">✉️</span>
            Emails
          </button>
          <button
            className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
            disabled={disabled}
          >
            <span className="tab-icon">📅</span>
            Events
          </button>
        </div>
      </div>

      <div className="picker-list">
        {activeTab === 'email' &&
          emails.map((email) => {
            const status = getStatus('email', email.id)
            const isExpanded = expandedEmailId === email.id
            const hasThread = !!email.threadId

            return (
              <div
                key={email.id}
                className={`thread-group ${isExpanded ? 'thread-group-active' : ''}`}
              >
                <button
                  className={`picker-item ${selectedId === email.id ? 'selected' : ''}`}
                  onClick={() => handleEmailClick(email)}
                  disabled={disabled}
                >
                  <div className="item-badge email-badge">Email</div>
                  <div className="item-content">
                    <div className="item-title">
                      {email.subject}
                      {status === 'done' && (
                        <span className="status-dot done" title="Research ready" />
                      )}
                      {status === 'pending' && (
                        <span className="status-dot processing" title="Processing..." />
                      )}
                    </div>
                    <div className="item-meta">
                      <span className="item-from">{email.from}</span>
                      <span className="item-date">{formatDate(email.date)}</span>
                    </div>
                    <div className="item-snippet">{email.snippet}</div>
                  </div>
                  {hasThread && (
                    <span className={`thread-chevron ${isExpanded ? 'expanded' : ''}`}>›</span>
                  )}
                </button>

                {isExpanded && threadLoading && (
                  <div className="thread-children">
                    <div className="thread-loading">Loading thread…</div>
                  </div>
                )}

                {isExpanded && !threadLoading && threadMessages.length > 0 && (
                  <div className="thread-children">
                    {threadMessages.map((msg) => (
                      <button
                        key={msg.id}
                        className={`picker-item thread-child ${selectedId === msg.id ? 'selected' : ''}`}
                        onClick={() => handleSelect('email', msg)}
                        disabled={disabled}
                      >
                        <div className="item-content">
                          <div className="item-title">
                            {msg.from.split('<')[0].trim() || msg.from}
                          </div>
                          <div className="item-meta">
                            <span className="item-date">{formatDate(msg.date)}</span>
                          </div>
                          <div className="item-snippet">{msg.snippet}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {isExpanded && !threadLoading && threadMessages.length === 0 && (
                  <div className="thread-children">
                    <div className="thread-loading">No other messages in thread</div>
                  </div>
                )}
              </div>
            )
          })}

        {activeTab === 'calendar' &&
          events.map((event) => {
            const status = getStatus('calendar', event.id)
            return (
              <button
                key={event.id}
                className={`picker-item ${selectedId === event.id ? 'selected' : ''}`}
                onClick={() => handleSelect('calendar', event)}
                disabled={disabled}
              >
                <div className="item-badge event-badge">Event</div>
                <div className="item-content">
                  <div className="item-title">
                    {event.summary}
                    {status === 'done' && (
                      <span className="status-dot done" title="Research ready" />
                    )}
                    {status === 'pending' && (
                      <span className="status-dot processing" title="Processing..." />
                    )}
                  </div>
                  <div className="item-meta">
                    <span className="item-from">
                      {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                    </span>
                    <span className="item-date">{formatDate(event.start)}</span>
                  </div>
                  <div className="item-snippet">{event.description}</div>
                </div>
              </button>
            )
          })}
      </div>
    </div>
  )
}
