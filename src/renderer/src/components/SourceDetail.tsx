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

interface SourceDetailProps {
  type: 'email' | 'calendar' | null
  data: Email | CalendarEvent | null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function SourceDetail({ type, data }: SourceDetailProps): React.JSX.Element | null {
  if (!data || !type) return null

  if (type === 'email') {
    const email = data as Email
    return (
      <div className="source-detail">
        <div className="detail-header">
          <span className="detail-badge email-badge">Email</span>
          <span className="detail-date">{formatDate(email.date)}</span>
        </div>
        <h2 className="detail-title">{email.subject}</h2>
        <div className="detail-meta">
          <span>
            <strong>From:</strong> {email.from}
          </span>
          <span>
            <strong>To:</strong> {email.to}
          </span>
        </div>
        <div className="detail-body">{email.body}</div>
      </div>
    )
  }

  const event = data as CalendarEvent
  return (
    <div className="source-detail">
      <div className="detail-header">
        <span className="detail-badge event-badge">Event</span>
        <span className="detail-date">{formatDate(event.start)}</span>
      </div>
      <h2 className="detail-title">{event.summary}</h2>
      <div className="detail-meta">
        {event.location && (
          <span>
            <strong>📍</strong> {event.location}
          </span>
        )}
        <span>
          <strong>⏱</strong> {formatDate(event.start)} — {formatDate(event.end)}
        </span>
      </div>
      {event.description && <div className="detail-body">{event.description}</div>}
      <div className="detail-attendees">
        <strong>Attendees:</strong>
        <div className="attendee-list">
          {event.attendees.map((a) => (
            <span key={a.email} className="attendee-chip">
              {a.name}
              {a.company && <span className="attendee-company">{a.company}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
