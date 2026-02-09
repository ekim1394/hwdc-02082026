// Mock data for external responses — email replies and meeting transcripts

export interface ExternalEmailReply {
  id: string
  from: string
  to: string
  subject: string
  body: string
  originalEmailSubject: string
  date: string
  threadId?: string
}

export interface MeetingTranscript {
  id: string
  title: string
  date: string
  participants: { name: string; role?: string }[]
  transcript: string
}

export type InsightsInputType = 'email-reply' | 'transcript'

export interface InsightsInput {
  type: InsightsInputType
  data: ExternalEmailReply | MeetingTranscript
}

export const MOCK_EMAIL_REPLIES: ExternalEmailReply[] = [
  {
    id: 'reply-1',
    from: 'guillermo@vercel.com',
    to: 'me@mycompany.com',
    subject: 'Re: Partnership Discussion — AI SDK Integration',
    originalEmailSubject: 'Partnership Discussion with Vercel',
    body: `Hey,

Thanks for the demo last week — the team was impressed by how your agent handles multi-step research with tool-use. A few thoughts from our side:

1. We'd love to feature your agent as an official AI SDK template. The integration with Linkup for web search is a strong differentiator vs. vanilla RAG examples.

2. Pricing: we'd want this to be free for developers in the template gallery. We can discuss revenue sharing on a premium tier if there's interest.

3. Timeline concern: our AI SDK v4 launch is March 15. If we want to ship together, we'd need a working integration by ~March 1. Is that realistic?

4. One technical flag — your agent currently hardcodes the Anthropic provider. For the template, we'd need it to be provider-agnostic (OpenAI, Google, Anthropic all supported via the AI SDK).

Let me know your thoughts on timing and the provider-agnostic requirement. Happy to jump on a quick call this week.

Best,
Guillermo`,
    date: '2026-02-09T09:30:00Z'
  },
  {
    id: 'reply-2',
    from: 'pat@sequoiacap.com',
    to: 'me@mycompany.com',
    subject: 'Re: Follow-up from Sequoia Meeting',
    originalEmailSubject: 'Investor Meeting — Sequoia Capital',
    body: `Hi,

Great meeting yesterday. Sonya and I discussed afterward and have a few follow-up points:

Strengths we see:
- Clear product vision — the "research agent for every knowledge worker" framing resonates
- Strong technical demo — the multi-step tool-use with real web search was impressive
- Early traction with 2,400 weekly active users is encouraging for the stage

Concerns:
- Competitive moat: Perplexity just raised $500M and is building similar agentic features. How do you defend against them moving downmarket?
- Unit economics: at ~$0.12 per research query (Anthropic API + Linkup), the margins feel tight. What's the path to profitability?
- Team: you're currently solo. We'd want to see a co-founder or at least 2 key hires before leading a round.

We're interested but not ready to commit to leading. If you can address the moat and team questions, we'd like to continue the conversation. Would a follow-up in 3-4 weeks work?

Best,
Pat Grady
Sequoia Capital`,
    date: '2026-02-09T11:15:00Z'
  },
  {
    id: 'reply-3',
    from: 'speakers@websummit.com',
    to: 'me@mycompany.com',
    subject: 'Re: Speaker Invitation — Confirmation Needed',
    originalEmailSubject: 'Speaker Invitation — Web Summit 2026 AI Stage',
    body: `Hello,

Thank you for your interest in speaking at Web Summit 2026! We're thrilled.

A few logistics we need confirmed by February 28:

1. Speaker bio (250 words max) and a high-res headshot
2. Talk title confirmation — we proposed "Beyond Search: How AI Agents Are Redefining Knowledge Work" but you're welcome to adjust
3. Any A/V requirements beyond standard setup (screen + mic)
4. Travel preferences — we book flights and 3 nights at the venue hotel. Please share your departure city.

Also, we'd love to schedule a 15-minute prep call in October to align on content and messaging. Our content team will reach out closer to the date.

One note: we've had strong interest in the AI Stage this year. If you're open to it, we may also invite you to a fireside chat on Day 3 with a founder from Anthropic or Cohere. Let us know if you'd be interested.

Looking forward to your confirmation!

Best,
Web Summit Programming Team`,
    date: '2026-02-08T14:00:00Z'
  }
]

export const MOCK_TRANSCRIPTS: MeetingTranscript[] = [
  {
    id: 'transcript-1',
    title: 'Anthropic Technical Deep Dive — Claude Tool-Use Patterns',
    date: '2026-02-14T11:00:00Z',
    participants: [
      { name: 'Alex Albert', role: 'Developer Relations Lead, Anthropic' },
      { name: 'Amanda Askell', role: 'Researcher, Anthropic' },
      { name: 'Me', role: 'Founder' }
    ],
    transcript: `[00:00] Alex: Thanks for joining. We've been looking at your agent implementation and have some specific feedback on optimizing tool-use patterns.

[02:15] Amanda: First, on your system prompt — you're instructing the model to "always search before responding." That's good for thoroughness but we're seeing it add 2-3 unnecessary searches per query. Consider adding a condition: "search only when the information is not already in your context."

[05:30] Me: That makes sense. We've noticed the cost per query is higher than expected. About $0.12 on average.

[06:00] Alex: Right, and with the optimized prompt pattern we can probably cut that to $0.06-0.08. The key is better stop conditions. Right now you're using stepCountIs(10) which is very generous. Most research tasks complete in 3-5 steps.

[08:45] Amanda: Another thing — for your meeting briefing use case, you should consider parallel tool calls. Claude supports calling multiple tools simultaneously. So instead of searching each attendee sequentially, you batch all attendee searches in one step.

[11:20] Me: That's a great point. How do we enable parallel tool calls?

[12:00] Alex: It's default behavior in the API. The model will naturally batch when the queries are independent. But your current prompt structure forces sequential thinking. We can share a revised prompt template.

[15:30] Amanda: One more thing — we're launching a new "research" mode in Claude 4 next month that's specifically optimized for multi-step information gathering. It'll have better cost efficiency and a native "search and synthesize" flow. We'd love to give you early access.

[18:00] Me: Absolutely, that would be huge for us. When would early access start?

[18:30] Alex: We're targeting late February. I'll add you to the beta list. Also, we should discuss the prompt caching feature — it could cut your repeated context costs by 90%.

[22:00] Amanda: Let's schedule a follow-up in two weeks to review the optimized prompts and get you set up with the beta.

[23:00] Alex: Sounds good. We'll send over the revised prompt templates and parallel tool-call examples by end of week.`
  },
  {
    id: 'transcript-2',
    title: 'Product Strategy Review — Q1 Priorities',
    date: '2026-02-10T15:00:00Z',
    participants: [
      { name: 'Sarah Chen', role: 'Product Advisor' },
      { name: 'Marcus Johnson', role: 'Engineering Advisor' },
      { name: 'Me', role: 'Founder' }
    ],
    transcript: `[00:00] Sarah: Let's review where we are on Q1 priorities. Last month we said the top 3 were: multi-provider support, team collaboration, and the insights agent.

[01:30] Me: Multi-provider is about 60% done. We have OpenAI and Anthropic working. Google Gemini is next. The main blocker is that each provider handles tool-use slightly differently.

[03:00] Marcus: On the engineering side, I'd push back on building team collaboration this quarter. Your user base is still primarily individual users. The usage data shows 92% of sessions are single-user. I'd focus on making the single-user experience exceptional first.

[05:15] Sarah: I agree with Marcus. The insights agent feature feels higher impact. If you can analyze meeting transcripts and email threads automatically, that's a real time-saver for busy professionals. What's the competitive landscape there?

[07:00] Me: Otter.ai does transcription and basic summaries, but they don't do actionable insights with follow-up triggers. Fireflies is similar. Nobody is connecting transcript analysis to automated next-steps — like drafting follow-up emails or scheduling meetings.

[09:30] Marcus: That's your wedge. The "insight to action" pipeline. Most tools stop at summarization. If you can go from transcript → insights → draft email, that's a 10x improvement.

[12:00] Sarah: For the MVP, I'd scope it to: analyze input, extract 3-5 key insights, surface any concerns or objections, and suggest 2-3 concrete next steps. Keep the action execution manual with an option to automate later.

[14:30] Me: That's exactly what I was thinking. Human-in-the-loop by default, with a toggle for power users who want auto-execution.

[16:00] Marcus: On the technical side, this should be a separate agent with its own prompt, not an extension of the research agent. Different input, different output structure, different tools.

[18:00] Sarah: Agreed. Ship the MVP this month, get feedback from 50 users, then iterate. Don't over-build V1.

[20:00] Me: Perfect. I'll have the insights agent MVP ready by end of February.`
  }
]

export function getExternalReplies(): ExternalEmailReply[] {
  return MOCK_EMAIL_REPLIES
}

export function getMeetingTranscripts(): MeetingTranscript[] {
  return MOCK_TRANSCRIPTS
}
