import { generateText, stepCountIs, type Tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { LinkupClient } from 'linkup-sdk'
import { z } from 'zod'
import type { ResearchInput, EmailMessage, CalendarEvent } from './mock-data'

// Initialize Linkup client
const linkup = new LinkupClient({ apiKey: process.env.LINKUP_API_KEY ?? '' })

// --- Tool schema ---

const searchInputSchema = z.object({
  query: z.string().describe('The search query — be specific and targeted'),
  depth: z
    .enum(['standard', 'deep'])
    .default('standard')
    .describe(
      'Use "deep" for complex queries requiring thorough research, "standard" for quick lookups'
    )
})

type SearchInput = z.infer<typeof searchInputSchema>

interface SearchOutput {
  answer: string
  sources: { name: string; url: string }[]
  error?: string
}

// --- Tool definition ---

const linkupSearchTool: Tool<SearchInput, SearchOutput> = {
  description:
    'Search the web for information using Linkup. Use this to research people, companies, topics, competitors, or any external context relevant to the task.',
  inputSchema: searchInputSchema,
  execute: async (input: SearchInput): Promise<SearchOutput> => {
    console.log(`   [Linkup] Searching: "${input.query}" (depth: ${input.depth})`)
    try {
      const result = await linkup.search({
        query: input.query,
        depth: input.depth,
        outputType: 'sourcedAnswer'
      })
      console.log(
        `   [Linkup] ✓ Got answer (${result.answer.length} chars, ${result.sources.length} sources)`
      )
      return {
        answer: result.answer,
        sources: result.sources.map((s) => ({
          name: s.name,
          url: s.url
        }))
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error(`   [Linkup] ✗ Search failed:`, errMsg)
      if (error instanceof Error && error.stack) {
        console.error(`   [Linkup] Stack:`, error.stack)
      }
      // Log the full error object for API errors
      console.error(`   [Linkup] Full error:`, JSON.stringify(error, null, 2))
      return {
        answer: '',
        sources: [],
        error: `Search failed: ${errMsg}`
      }
    }
  }
}

// --- Prompt builders ---

function buildMeetingGuidePrompt(event: CalendarEvent): string {
  const attendeeList = event.attendees
    .filter((a) => a.email !== 'me@mycompany.com')
    .map((a) => `- ${a.name} (${a.email}${a.company ? `, ${a.company}` : ''})`)
    .join('\n')

  return `You are a research assistant preparing a comprehensive meeting guide.

## Meeting Details
- **Title:** ${event.summary}
- **Date:** ${event.start} to ${event.end}
- **Location:** ${event.location ?? 'TBD'}
- **Description:** ${event.description}

## Attendees
${attendeeList}

## Your Task
Research the attendees, their companies, and the meeting topic to produce a meeting preparation guide. Use the linkupSearch tool to gather information.

Your output MUST follow this exact structure:

# Meeting Guide: ${event.summary}

## Attendee Profiles
For each external attendee, provide:
- Their role and background
- Their company overview and recent news
- Any relevant connections or shared interests

## Key Talking Points
- 3-5 specific, informed talking points based on your research
- Reference specific facts you discovered

## Suggested Agenda
- A structured agenda for the meeting duration
- Include time allocations

## Potential Questions to Ask
- 3-4 thoughtful questions informed by your research

## Background Context
- Relevant industry trends or news
- Any competitive intelligence

## Sources
- List all sources used with URLs`
}

function buildDraftEmailPrompt(email: EmailMessage): string {
  return `You are a research assistant helping draft a reply to an email.

## Original Email
- **From:** ${email.from}
- **Subject:** ${email.subject}
- **Date:** ${email.date}
- **Body:**
${email.body}

## Your Task
Research the sender, their company, and the topics mentioned in the email. Then draft a professional, informed reply. Use the linkupSearch tool to gather context.

Your output MUST follow this exact structure:

# Draft Reply: Re: ${email.subject}

## Research Summary
Brief summary of what you learned about the sender and context.

## Draft Email

\`\`\`
Subject: Re: ${email.subject}

[Write a professional, well-informed reply here. Reference specific facts from your research to show you've done your homework. Be concise but thorough.]
\`\`\`

## Key Insights
- Bullet points of important context that informed the reply
- Things to be aware of before sending

## Alternative Angles
- 1-2 alternative approaches to consider for the reply

## Sources
- List all sources used with URLs`
}

// --- Agent runner ---

export interface AgentResult {
  output: string
  toolCalls: { tool: string; query: string }[]
}

export async function runResearchAgent(input: ResearchInput): Promise<AgentResult> {
  const prompt =
    input.type === 'calendar'
      ? buildMeetingGuidePrompt(input.data as CalendarEvent)
      : buildDraftEmailPrompt(input.data as EmailMessage)

  const toolCallLog: { tool: string; query: string }[] = []
  let stepCount = 0

  console.log('\n' + '='.repeat(60))
  console.log(`🧠 Research Agent Started`)
  console.log(`   Type: ${input.type}`)
  console.log(
    `   Input: ${input.type === 'calendar' ? (input.data as CalendarEvent).summary : (input.data as EmailMessage).subject}`
  )
  console.log('='.repeat(60))

  const result = await generateText({
    model: anthropic('claude-haiku-4-5'),
    tools: { linkupSearch: linkupSearchTool },
    stopWhen: stepCountIs(10),
    system:
      'You are a thorough research agent. Always use the linkupSearch tool to gather real information before writing your response. Make multiple searches to build comprehensive context. Never fabricate information — only include facts you found through search.',
    prompt,
    onStepFinish: ({ toolCalls, text, finishReason }) => {
      stepCount++
      console.log(`\n--- Step ${stepCount} (reason: ${finishReason}) ---`)

      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if ('input' in tc && tc.toolName === 'linkupSearch') {
            const toolInput = tc.input as { query: string }
            console.log(`   🔍 Search: "${toolInput.query}"`)
            toolCallLog.push({
              tool: 'linkupSearch',
              query: toolInput.query
            })
          }
        }
      }

      if (text) {
        console.log(`   📝 Generated ${text.length} chars of text`)
      }
    }
  })

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Research Complete`)
  console.log(`   Steps: ${stepCount}`)
  console.log(`   Searches: ${toolCallLog.length}`)
  console.log(`   Output: ${result.text.length} chars`)
  console.log('='.repeat(60) + '\n')

  return {
    output: result.text,
    toolCalls: toolCallLog
  }
}
