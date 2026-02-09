import { generateText, type Tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type {
  InsightsInput,
  ExternalEmailReply,
  MeetingTranscript,
  InsightsInputType
} from './insights-mock-data'
import * as db from './database'

// --- Action step types ---

export interface ActionStep {
  type: 'email' | 'meeting'
  description: string
  details: string
}

export interface InsightsResult {
  keyInsights: string[]
  feedback: string[]
  actionSteps: ActionStep[]
  rawOutput: string
}

// --- Parsing tool (structured output) ---

const insightsSchema = z.object({
  keyInsights: z.array(z.string()).describe('3-5 key insights extracted from the input'),
  feedback: z
    .array(z.string())
    .describe('2-4 feedback points — sentiment, concerns, objections, or positive signals'),
  actionSteps: z
    .array(
      z.object({
        type: z.enum(['email', 'meeting']).describe('The type of follow-up action'),
        description: z.string().describe('Short action title, e.g. "Send pricing clarification"'),
        details: z.string().describe('Specific details about what the action should accomplish')
      })
    )
    .describe('2-3 concrete next action steps')
})

type InsightsSchema = z.infer<typeof insightsSchema>

const extractInsightsTool: Tool<InsightsSchema, InsightsSchema> = {
  description:
    'Extract structured insights from the analysis. Call this tool with the final structured result.',
  inputSchema: insightsSchema,
  execute: async (input: InsightsSchema): Promise<InsightsSchema> => input
}

// --- Prompt builders ---

function buildEmailReplyPrompt(reply: ExternalEmailReply): string {
  return `Analyze this email reply from an external party and extract structured insights.

Original email thread subject: ${reply.originalEmailSubject}
From: ${reply.from}
Date: ${reply.date}

Email body:
${reply.body}

Instructions:
- Extract 3-5 key insights (the most important takeaways)
- Identify 2-4 feedback points (sentiment, concerns, objections, positive signals, deadlines)
- Suggest 2-3 concrete next action steps, each as either a follow-up email or a meeting to schedule
- Be specific and actionable — don't give generic advice
- Use the extractInsights tool to return your structured analysis`
}

function buildTranscriptPrompt(transcript: MeetingTranscript): string {
  const participantList = transcript.participants
    .map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ''}`)
    .join('\n')

  return `Analyze this meeting transcript and extract structured insights.

Meeting: ${transcript.title}
Date: ${transcript.date}

Participants:
${participantList}

Transcript:
${transcript.transcript}

Instructions:
- Extract 3-5 key insights (the most important takeaways and decisions)
- Identify 2-4 feedback points (concerns raised, pushback, agreements, sentiment)
- Suggest 2-3 concrete next action steps, each as either a follow-up email or a meeting to schedule
- Be specific — reference actual discussion points and names from the transcript
- Use the extractInsights tool to return your structured analysis`
}

// --- Agent runner ---

function getSourceId(input: InsightsInput): string {
  return (input.data as { id: string }).id
}

export async function runInsightsAgent(input: InsightsInput): Promise<InsightsResult> {
  const sourceId = getSourceId(input)

  // Check DB cache first
  const cached = db.getInsights(input.type, sourceId)
  if (cached) {
    console.log(`⚡ Insights cache hit for ${input.type}:${sourceId}`)
    return cached
  }

  const prompt =
    input.type === 'transcript'
      ? buildTranscriptPrompt(input.data as MeetingTranscript)
      : buildEmailReplyPrompt(input.data as ExternalEmailReply)

  console.log('\n' + '='.repeat(60))
  console.log(`🔎 Insights Agent Started`)
  console.log(`   Type: ${input.type}`)
  console.log(
    `   Input: ${input.type === 'transcript' ? (input.data as MeetingTranscript).title : (input.data as ExternalEmailReply).subject}`
  )
  console.log('='.repeat(60))

  const result = await generateText({
    model: anthropic('claude-haiku-4-5'),
    tools: { extractInsights: extractInsightsTool },
    toolChoice: { type: 'tool', toolName: 'extractInsights' },
    system:
      'You are an expert business analyst. Analyze the provided communication and extract structured insights. Always use the extractInsights tool to return your analysis in the required format.',
    prompt
  })

  // Extract the tool call result
  let insightsData: InsightsSchema | null = null
  for (const step of result.steps) {
    for (const tc of step.toolCalls) {
      if (tc.toolName === 'extractInsights') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        insightsData = (tc as any).args as InsightsSchema
      }
    }
  }

  if (!insightsData) {
    throw new Error('Insights agent did not produce structured output')
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Insights Complete`)
  console.log(`   Key Insights: ${insightsData.keyInsights.length}`)
  console.log(`   Feedback: ${insightsData.feedback.length}`)
  console.log(`   Actions: ${insightsData.actionSteps.length}`)
  console.log('='.repeat(60) + '\n')

  const agentResult: InsightsResult = {
    keyInsights: insightsData.keyInsights,
    feedback: insightsData.feedback,
    actionSteps: insightsData.actionSteps,
    rawOutput: JSON.stringify(insightsData)
  }

  // Save to DB
  db.saveInsights(input.type, sourceId, agentResult)
  console.log(`   💾 Saved insights to DB for ${input.type}:${sourceId}`)

  return agentResult
}

// --- Action execution (stub) ---

export interface ActionExecution {
  actionIndex: number
  action: ActionStep
  status: 'pending' | 'executed' | 'failed'
  executedAt?: string
}

export async function executeAction(
  sourceType: InsightsInputType,
  sourceId: string,
  actionIndex: number
): Promise<ActionExecution> {
  const insights = db.getInsights(sourceType, sourceId)
  if (!insights) {
    throw new Error('No insights found for this source')
  }

  const action = insights.actionSteps[actionIndex]
  if (!action) {
    throw new Error(`Action at index ${actionIndex} not found`)
  }

  console.log(`\n🚀 Executing action: ${action.description}`)
  console.log(`   Type: ${action.type}`)
  console.log(`   Details: ${action.details}`)

  // TODO: Implement actual email sending / calendar event creation
  // For now, log the action execution
  const execution: ActionExecution = {
    actionIndex,
    action,
    status: 'executed',
    executedAt: new Date().toISOString()
  }

  db.logActionExecution(sourceType, sourceId, actionIndex, 'executed')

  return execution
}
