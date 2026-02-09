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
    from: 'partnerships@stripe.com',
    to: 'me@mycompany.com',
    subject: 'Stripe Partner Program — AI Integration Opportunity',
    snippet:
      'We noticed your work with AI agents and want to discuss a potential integration with Stripe...',
    body: `Hi,

I'm reaching out from the Stripe Partnerships team. We've been following the growth of AI-powered research tools and believe there's a compelling opportunity to integrate intelligent research capabilities into the Stripe ecosystem.

Specifically, we're exploring how AI agents could help our enterprise merchants with:

1. Automated competitor pricing analysis
2. Market expansion research for new geographies
3. Regulatory compliance monitoring across jurisdictions

We'd love to set up a 30-minute call to discuss how your research agent technology could complement Stripe's platform. Our Head of AI Partnerships, who previously led product at Plaid, would join the call.

Would next Tuesday or Wednesday work?

Best regards,
Stripe Partnerships Team
partnerships@stripe.com`,
    date: '2026-02-08T14:30:00Z'
  },
  {
    id: 'email-2',
    from: 'info@a]6z.com',
    to: 'me@mycompany.com',
    subject: 'a16z — Interested in Your AI Agent Platform',
    snippet: 'Our team at Andreessen Horowitz has been tracking the AI agent space closely...',
    body: `Hi,

I'm a partner at Andreessen Horowitz focused on AI infrastructure investments. We've been tracking the AI agent space closely and your approach to combining web research with structured output generation caught our attention.

We recently published our "Big Ideas in Tech 2026" list and AI agents that can autonomously research and synthesize information is one of our top themes. Companies like Perplexity, Tavily, and Exa have shown strong traction, and we see room for differentiated approaches.

A few questions we'd love to discuss:
1. How does your agent architecture differ from retrieval-augmented generation (RAG)?
2. What's your current usage and retention metrics?
3. How are you thinking about the competitive moat as foundation models improve?

Would you be open to a meeting at our Menlo Park office? We can also do a video call if that's easier.

Looking forward,
a16z AI Infrastructure Team`,
    date: '2026-02-07T09:15:00Z'
  },
  {
    id: 'email-3',
    from: 'speakers@websummit.com',
    to: 'me@mycompany.com',
    subject: 'Speaker Invitation — Web Summit 2026 AI Stage',
    snippet: 'We would love to invite you to speak at Web Summit 2026 in Lisbon...',
    body: `Hello,

I'm part of the programming team at Web Summit. We're assembling the speaker lineup for Web Summit 2026 taking place November 11-14 in Lisbon, Portugal.

We've been following your work on AI research agents and would love to invite you to speak on the AI Stage. The session we have in mind:

Title: "Beyond Search: How AI Agents Are Redefining Knowledge Work"
Format: 20-minute talk + 10-minute audience Q&A
Date: November 12, 2026 (Day 2)
Expected audience: ~5,000 on the AI Stage

Web Summit has grown to 70,000+ attendees from 160+ countries. Past AI Stage speakers include Sam Altman (OpenAI), Dario Amodei (Anthropic), and Demis Hassabis (Google DeepMind).

We cover flights, accommodation, and a full conference pass. Please let us know if you're interested by March 15th.

Best,
Web Summit Programming Team
speakers@websummit.com`,
    date: '2026-02-06T16:45:00Z'
  }
]

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'event-1',
    summary: 'Partnership Discussion with Vercel',
    description:
      'Discuss potential integration of our research agent as a Vercel AI SDK template. Review the v0 platform and explore co-marketing opportunities for AI-powered apps built on Next.js.',
    start: '2026-02-12T10:00:00Z',
    end: '2026-02-12T11:00:00Z',
    attendees: [
      { name: 'Guillermo Rauch', email: 'guillermo@vercel.com', company: 'Vercel' },
      { name: 'Jared Palmer', email: 'jared@vercel.com', company: 'Vercel' },
      { name: 'Me', email: 'me@mycompany.com' }
    ],
    location: 'Zoom'
  },
  {
    id: 'event-2',
    summary: 'Investor Meeting — Sequoia Capital',
    description:
      'First meeting with Sequoia Capital to discuss seed/Series A funding. Prepare product demo, traction metrics, and competitive positioning against Perplexity AI and Tavily.',
    start: '2026-02-13T14:00:00Z',
    end: '2026-02-13T15:30:00Z',
    attendees: [
      {
        name: 'Pat Grady',
        email: 'pat@sequoiacap.com',
        company: 'Sequoia Capital'
      },
      {
        name: 'Sonya Huang',
        email: 'sonya@sequoiacap.com',
        company: 'Sequoia Capital'
      },
      { name: 'Me', email: 'me@mycompany.com' }
    ],
    location: 'Sequoia Capital — 2800 Sand Hill Rd, Menlo Park, CA'
  },
  {
    id: 'event-3',
    summary: 'Technical Deep Dive with Anthropic',
    description:
      'Technical discussion with the Anthropic developer relations team about optimizing Claude tool-use patterns for multi-step research agents. Review prompt engineering best practices and discuss early access to new API features.',
    start: '2026-02-14T11:00:00Z',
    end: '2026-02-14T12:00:00Z',
    attendees: [
      { name: 'Alex Albert', email: 'alex@anthropic.com', company: 'Anthropic' },
      { name: 'Amanda Askell', email: 'amanda@anthropic.com', company: 'Anthropic' },
      { name: 'Me', email: 'me@mycompany.com' }
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
