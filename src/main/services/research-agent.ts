import { generateText, stepCountIs, type Tool } from 'ai'
import { LinkupClient } from 'linkup-sdk'
import { z } from 'zod'
import type { ResearchInput, EmailMessage, CalendarEvent } from './mock-data'
import * as db from './database'
import { getModelConfig } from './settings-store'

// Initialize Linkup client
const linkup = new LinkupClient({ apiKey: '6bb8e0c3-3011-4ea9-a8ef-d72fe2be697d' })

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
    .map((a) => `- ${a.name}${a.company ? ` (${a.company})` : ''}`)
    .join('\n')

  return `Prepare a brief meeting briefing. Research the attendees and topic, then provide ONLY the following — keep it concise:

Meeting: ${event.summary}
Date: ${event.start}
${event.location ? `Location: ${event.location}` : ''}
Description: ${event.description}

Attendees:
${attendeeList}

Your output format (use markdown):

## Who You're Meeting
One line per attendee: their name, title, and one key fact.

## Talking Points
3-5 bullet points. Each should be specific and informed by your research.

## Key Context
2-3 bullets of important background (company news, industry trends, anything relevant).

Be direct. No filler. No "here's what I found" preamble.`
}

function buildDraftEmailPrompt(email: EmailMessage): string {
  return `Draft a reply to this email. Research the sender and topics first, then write ONLY the email reply — nothing else.

From: ${email.from}
Subject: ${email.subject}
Body:
${email.body}

Rules:
- Output ONLY the email body text, ready to send
- Be professional, concise, and informed by your research
- Reference 1-2 specific facts you discovered to show you've done your homework
- Do NOT include subject line, headers, greetings analysis, or commentary
- Start with an appropriate greeting and end with a sign-off
- Keep it under 200 words`
}

// --- Agent runner ---

export interface AgentResult {
  output: string
  toolCalls: { tool: string; query: string }[]
}

function getSourceId(input: ResearchInput): string {
  return 'id' in input.data ? (input.data as { id: string }).id : ''
}

export async function runResearchAgent(input: ResearchInput): Promise<AgentResult> {
  const sourceId = getSourceId(input)

  // Check DB cache first
  const cached = db.getResearch(input.type, sourceId)
  if (cached) {
    console.log(`⚡ DB cache hit for ${input.type}:${sourceId}`)
    return cached
  }

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
    model: getModelConfig(),
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

  const agentResult: AgentResult = {
    output: result.text,
    toolCalls: toolCallLog
  }

  // Save to DB and mark as processed
  db.saveResearch(input.type, sourceId, agentResult)
  db.markProcessed(input.type, sourceId)
  console.log(`   💾 Saved result to DB for ${input.type}:${sourceId}`)

  return agentResult
}

// ---------------------------------------------------------------------------
// Auto-processing pipeline
// ---------------------------------------------------------------------------

let isProcessing = false

/**
 * Process all unprocessed items in the database.
 * Runs sequentially to avoid hammering the APIs.
 * Calls onItemProcessed callback after each item completes.
 */
export async function processNewItems(
  onItemProcessed?: (type: string, id: string) => void
): Promise<number> {
  if (isProcessing) {
    console.log('⏳ Already processing — skipping')
    return 0
  }

  const items = db.getUnprocessedItems()
  if (items.length === 0) return 0

  isProcessing = true
  console.log(`\n🔄 Auto-processing ${items.length} new items...`)
  let processed = 0

  for (const item of items) {
    try {
      console.log(`\n🔄 [${processed + 1}/${items.length}] Processing ${item.type}:${item.id}`)
      await runResearchAgent({ type: item.type, data: item.data })
      processed++
      onItemProcessed?.(item.type, item.id)
    } catch (err) {
      console.error(`❌ Failed to process ${item.type}:${item.id}:`, err)
      // Mark as processed to avoid retrying forever
      db.markProcessed(item.type, item.id)
    }
  }

  isProcessing = false
  console.log(`\n✅ Auto-processing complete: ${processed}/${items.length} items`)
  return processed
}
