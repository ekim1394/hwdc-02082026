// Mock data service — stands in for Google API integration
// These interfaces should match what the Google integration team provides

export interface EmailMessage {
  id: string
  from: string
  to: string
  subject: string
  snippet: string
  body: string
  date: string
}

export interface CalendarEvent {
  id: string
  summary: string
  description: string
  start: string
  end: string
  attendees: { name: string; email: string; company?: string }[]
  location?: string
}

export type InputType = 'email' | 'calendar'

export interface ResearchInput {
  type: InputType
  data: EmailMessage | CalendarEvent
}

export const MOCK_EMAILS: EmailMessage[] = [
  {
    id: 'email-1',
    from: 'sarah.chen@acmecorp.com',
    to: 'me@mycompany.com',
    subject: 'Partnership Opportunity — AI-Powered Analytics Platform',
    snippet: 'Hi, I wanted to reach out about a potential partnership between our companies...',
    body: `Hi,

I'm Sarah Chen, VP of Business Development at Acme Corp. I wanted to reach out about a potential partnership between our companies.

We've been building an AI-powered analytics platform that helps enterprise customers make sense of their data at scale. We've seen your work in the research agent space and think there could be a strong synergy.

Specifically, we're looking for partners who can integrate deep web research capabilities into our platform. Our customers frequently need to cross-reference their internal data with external market intelligence, competitor analysis, and industry trends.

Would you be open to a 30-minute introductory call next week to explore this further? I'd love to share more about our platform and learn about your technology.

Best regards,
Sarah Chen
VP Business Development, Acme Corp
sarah.chen@acmecorp.com`,
    date: '2026-02-08T14:30:00Z'
  },
  {
    id: 'email-2',
    from: 'james.rodriguez@ventureflow.vc',
    to: 'me@mycompany.com',
    subject: 'Series A Follow-Up — Due Diligence Questions',
    snippet:
      'Thank you for the great pitch yesterday. Our investment committee had a few questions...',
    body: `Hi,

Thank you for the excellent pitch yesterday. The team was genuinely impressed by your demo and the traction you've shown.

Our investment committee met this morning and we'd like to move forward with due diligence. Before our next session, we have a few questions:

1. Can you share your current MRR breakdown by customer segment?
2. What does your competitive landscape look like, particularly against Perplexity and Tavily?
3. We'd love to understand your unit economics — CAC, LTV, and payback period.
4. Any pending IP or patent applications?

We're looking at a $5-8M Series A round and would like to lead. Let's schedule a follow-up for early next week.

Best,
James Rodriguez
Partner, VentureFlow Capital`,
    date: '2026-02-07T09:15:00Z'
  },
  {
    id: 'email-3',
    from: 'priya.patel@techconf2026.io',
    to: 'me@mycompany.com',
    subject: 'Speaker Invitation — TechConf 2026 AI Summit',
    snippet: 'We would love to invite you to speak at TechConf 2026...',
    body: `Hello,

I'm Priya Patel, Program Director for TechConf 2026. We're organizing our annual AI Summit taking place March 15-17 in San Francisco.

We've been following your work on research agents and would love to invite you as a keynote speaker. The session we have in mind is:

Title: "The Future of AI-Powered Research: From Search to Synthesis"
Format: 30-minute keynote + 15-minute Q&A
Date: March 16, 2026 (Day 2, Morning Slot)
Expected attendance: ~2,000

We cover travel, accommodation, and offer a $5,000 speaker honorarium. Past speakers include leaders from OpenAI, Anthropic, Google DeepMind, and Microsoft Research.

Could you let us know if you're interested? We'd need to confirm by February 20th.

Warm regards,
Priya Patel
Program Director, TechConf 2026`,
    date: '2026-02-06T16:45:00Z'
  }
]

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'event-1',
    summary: 'Product Strategy Review with Acme Corp',
    description:
      'Discuss potential integration of our research agent into Acme Corp analytics platform. Review technical requirements and partnership terms.',
    start: '2026-02-12T10:00:00Z',
    end: '2026-02-12T11:00:00Z',
    attendees: [
      { name: 'Sarah Chen', email: 'sarah.chen@acmecorp.com', company: 'Acme Corp' },
      { name: 'David Kim', email: 'david.kim@acmecorp.com', company: 'Acme Corp' },
      { name: 'Me', email: 'me@mycompany.com' }
    ],
    location: 'Zoom'
  },
  {
    id: 'event-2',
    summary: 'Series A Due Diligence — VentureFlow Capital',
    description:
      'Follow-up meeting with VentureFlow Capital investment team. Prepare MRR breakdown, competitive analysis, and unit economics for discussion.',
    start: '2026-02-13T14:00:00Z',
    end: '2026-02-13T15:30:00Z',
    attendees: [
      {
        name: 'James Rodriguez',
        email: 'james.rodriguez@ventureflow.vc',
        company: 'VentureFlow Capital'
      },
      { name: 'Lisa Wang', email: 'lisa.wang@ventureflow.vc', company: 'VentureFlow Capital' },
      { name: 'Me', email: 'me@mycompany.com' },
      { name: 'Alex Turner', email: 'alex@mycompany.com' }
    ],
    location: 'VentureFlow Office — 123 Sand Hill Rd, Menlo Park'
  },
  {
    id: 'event-3',
    summary: 'Weekly Engineering Sync',
    description:
      'Review sprint progress, discuss blockers, and plan next week priorities. Demo new Linkup integration.',
    start: '2026-02-10T09:00:00Z',
    end: '2026-02-10T09:45:00Z',
    attendees: [
      { name: 'Me', email: 'me@mycompany.com' },
      { name: 'Jordan Lee', email: 'jordan@mycompany.com' },
      { name: 'Sam Nakamura', email: 'sam@mycompany.com' }
    ],
    location: 'Google Meet'
  }
]

export function getEmails(): EmailMessage[] {
  return MOCK_EMAILS
}

export function getEvents(): CalendarEvent[] {
  return MOCK_EVENTS
}
