import { useState, useEffect } from 'react'

interface Email {
  id: string
  from: string
  to: string
  subject: string
  snippet: string
  body: string
  date: string
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

  useEffect(() => {
    window.api.getEmails().then(setEmails)
    window.api.getEvents().then(setEvents)
  }, [])

  const handleSelect = (type: 'email' | 'calendar', item: Email | CalendarEvent): void => {
    setSelectedId(item.id)
    onSelect(type, item)
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
          emails.map((email) => (
            <button
              key={email.id}
              className={`picker-item ${selectedId === email.id ? 'selected' : ''}`}
              onClick={() => handleSelect('email', email)}
              disabled={disabled}
            >
              <div className="item-badge email-badge">Email</div>
              <div className="item-content">
                <div className="item-title">{email.subject}</div>
                <div className="item-meta">
                  <span className="item-from">{email.from}</span>
                  <span className="item-date">{formatDate(email.date)}</span>
                </div>
                <div className="item-snippet">{email.snippet}</div>
              </div>
            </button>
          ))}

        {activeTab === 'calendar' &&
          events.map((event) => (
            <button
              key={event.id}
              className={`picker-item ${selectedId === event.id ? 'selected' : ''}`}
              onClick={() => handleSelect('calendar', event)}
              disabled={disabled}
            >
              <div className="item-badge event-badge">Event</div>
              <div className="item-content">
                <div className="item-title">{event.summary}</div>
                <div className="item-meta">
                  <span className="item-from">
                    {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                  </span>
                  <span className="item-date">{formatDate(event.start)}</span>
                </div>
                <div className="item-snippet">{event.description}</div>
              </div>
            </button>
          ))}
      </div>
    </div>
  )
}
