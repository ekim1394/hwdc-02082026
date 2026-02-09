import { useState, useEffect } from 'react'

interface EmailReply {
  id: string
  from: string
  to: string
  subject: string
  body: string
  originalEmailSubject: string
  date: string
  threadId?: string
}

interface Transcript {
  id: string
  title: string
  date: string
  participants: { name: string; role?: string }[]
  transcript: string
}

interface InsightsSourcePickerProps {
  onSelect: (type: 'email-reply' | 'transcript', data: EmailReply | Transcript) => void
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

export default function InsightsSourcePicker({
  onSelect,
  disabled
}: InsightsSourcePickerProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'email-reply' | 'transcript'>('email-reply')
  const [replies, setReplies] = useState<EmailReply[]>([])
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    window.api.getExternalReplies().then((data) => setReplies(data as EmailReply[]))
    window.api.getMeetingTranscripts().then((data) => setTranscripts(data as Transcript[]))
  }, [])

  const handleSelect = (
    type: 'email-reply' | 'transcript',
    item: EmailReply | Transcript
  ): void => {
    setSelectedId(item.id)
    onSelect(type, item)
  }

  return (
    <div className="source-picker">
      <div className="picker-header">
        <h2>External Responses</h2>
        <div className="tab-bar">
          <button
            className={`tab ${activeTab === 'email-reply' ? 'active' : ''}`}
            onClick={() => setActiveTab('email-reply')}
            disabled={disabled}
          >
            <span className="tab-icon">💬</span>
            Replies
          </button>
          <button
            className={`tab ${activeTab === 'transcript' ? 'active' : ''}`}
            onClick={() => setActiveTab('transcript')}
            disabled={disabled}
          >
            <span className="tab-icon">🎙️</span>
            Transcripts
          </button>
        </div>
      </div>

      <div className="picker-list">
        {activeTab === 'email-reply' &&
          replies.map((reply) => (
            <button
              key={reply.id}
              className={`picker-item ${selectedId === reply.id ? 'selected' : ''}`}
              onClick={() => handleSelect('email-reply', reply)}
              disabled={disabled}
            >
              <div className="item-badge reply-badge">Reply</div>
              <div className="item-content">
                <div className="item-title">{reply.subject}</div>
                <div className="item-meta">
                  <span className="item-from">{reply.from}</span>
                  <span className="item-date">{formatDate(reply.date)}</span>
                </div>
                <div className="item-snippet">Re: {reply.originalEmailSubject}</div>
              </div>
            </button>
          ))}

        {activeTab === 'transcript' &&
          transcripts.map((transcript) => (
            <button
              key={transcript.id}
              className={`picker-item ${selectedId === transcript.id ? 'selected' : ''}`}
              onClick={() => handleSelect('transcript', transcript)}
              disabled={disabled}
            >
              <div className="item-badge transcript-badge">Transcript</div>
              <div className="item-content">
                <div className="item-title">{transcript.title}</div>
                <div className="item-meta">
                  <span className="item-from">
                    {transcript.participants.length} participant
                    {transcript.participants.length !== 1 ? 's' : ''}
                  </span>
                  <span className="item-date">{formatDate(transcript.date)}</span>
                </div>
                <div className="item-snippet">
                  {transcript.participants
                    .filter((p) => p.name !== 'Me')
                    .map((p) => p.name)
                    .join(', ')}
                </div>
              </div>
            </button>
          ))}
      </div>
    </div>
  )
}
