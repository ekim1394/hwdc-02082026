import { useState, useEffect, useMemo } from 'react'

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

interface ThreadGroup {
  threadId: string
  emails: Email[]
  representative: Email
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

/** Strip Re:/Fwd:/FW: prefixes and normalize whitespace for grouping. */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw)\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Group emails by threadId, then merge groups with the same normalized subject. */
function groupEmailsByThread(emails: Email[]): ThreadGroup[] {
  // Step 1: group by threadId (or email id if no threadId)
  const threadMap = new Map<string, Email[]>()
  for (const email of emails) {
    const key = email.threadId || email.id
    const group = threadMap.get(key)
    if (group) {
      group.push(email)
    } else {
      threadMap.set(key, [email])
    }
  }

  // Step 2: merge thread groups that share the same normalized subject
  const subjectMap = new Map<string, Email[]>()
  for (const threadEmails of threadMap.values()) {
    // Use the first email's subject as the group key
    const normSubject = normalizeSubject(threadEmails[0].subject)
    const existing = subjectMap.get(normSubject)
    if (existing) {
      existing.push(...threadEmails)
    } else {
      subjectMap.set(normSubject, [...threadEmails])
    }
  }

  // Step 3: build final groups sorted newest-first
  const groups: ThreadGroup[] = []
  for (const [, groupEmails] of subjectMap) {
    groupEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const threadId = groupEmails[0].threadId || groupEmails[0].id
    groups.push({ threadId, emails: groupEmails, representative: groupEmails[0] })
  }

  groups.sort(
    (a, b) => new Date(b.representative.date).getTime() - new Date(a.representative.date).getTime()
  )
  return groups
}

export default function SourcePicker({ onSelect, disabled }: SourcePickerProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'email' | 'calendar'>('email')
  const [emails, setEmails] = useState<Email[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, 'pending' | 'done'>>({})
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())

  const threadGroups = useMemo(() => groupEmailsByThread(emails), [emails])

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

  const toggleThread = (threadId: string): void => {
    setExpandedThreads((prev) => {
      const next = new Set(prev)
      if (next.has(threadId)) {
        next.delete(threadId)
      } else {
        next.add(threadId)
      }
      return next
    })
  }

  const renderEmailItem = (email: Email, isChild = false): React.JSX.Element => {
    const status = getStatus('email', email.id)
    return (
      <button
        key={email.id}
        className={`picker-item ${isChild ? 'thread-child' : ''} ${selectedId === email.id ? 'selected' : ''}`}
        onClick={() => handleSelect('email', email)}
        disabled={disabled}
      >
        {!isChild && <div className="item-badge email-badge">Email</div>}
        <div className="item-content">
          <div className="item-title">
            {isChild ? email.from.split('<')[0].trim() || email.from : email.subject}
            {status === 'done' && <span className="status-dot done" title="Research ready" />}
            {status === 'pending' && (
              <span className="status-dot processing" title="Processing..." />
            )}
          </div>
          <div className="item-meta">
            {!isChild && <span className="item-from">{email.from}</span>}
            <span className="item-date">{formatDate(email.date)}</span>
          </div>
          <div className="item-snippet">{email.snippet}</div>
        </div>
      </button>
    )
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
          threadGroups.map((group) => {
            // Single-email thread — render as before
            if (group.emails.length === 1) {
              return renderEmailItem(group.representative)
            }

            // Multi-email thread — collapsible group
            const isExpanded = expandedThreads.has(group.threadId)
            const rep = group.representative
            const anySelected = group.emails.some((e) => e.id === selectedId)
            return (
              <div
                key={group.threadId}
                className={`thread-group ${anySelected ? 'thread-group-active' : ''}`}
              >
                <button
                  className={`thread-header ${anySelected ? 'selected' : ''}`}
                  onClick={() => {
                    toggleThread(group.threadId)
                    handleSelect('email', rep)
                  }}
                  disabled={disabled}
                >
                  <div className="item-badge email-badge">Email</div>
                  <div className="item-content">
                    <div className="item-title">
                      {rep.subject}
                      <span className="thread-count">{group.emails.length}</span>
                    </div>
                    <div className="item-meta">
                      <span className="item-from">{rep.from}</span>
                      <span className="item-date">{formatDate(rep.date)}</span>
                    </div>
                    <div className="item-snippet">{rep.snippet}</div>
                  </div>
                  <span className={`thread-chevron ${isExpanded ? 'expanded' : ''}`}>›</span>
                </button>
                {isExpanded && (
                  <div className="thread-children">
                    {group.emails.map((email) => renderEmailItem(email, true))}
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
