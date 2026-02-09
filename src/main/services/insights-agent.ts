import { generateText, Output } from 'ai'
import { z } from 'zod'
import type {
  InsightsInput,
  ExternalEmailReply,
  MeetingTranscript,
  InsightsInputType
} from './insights-mock-data'
import * as db from './database'
import { getModelConfig } from './settings-store'
import { sendGmailReply } from './gmail-service'
import { createCalendarEvent } from './calendar-service'

// --- Action step types ---

export interface ActionStep {
  type: 'email' | 'meeting'
  description: string
  details: string
  // Structured fields for email actions
  to?: string
  subject?: string
  body?: string
  // Structured fields for meeting actions
  meetingSummary?: string
  attendees?: string[]
  durationMinutes?: number
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
        details: z.string().describe('Specific details about what the action should accomplish'),
        // Email-specific fields
        to: z
          .string()
          .optional()
          .describe(
            'For email actions: the recipient email address. Extract from the From field of the input.'
          ),
        subject: z
          .string()
          .optional()
          .describe('For email actions: the email subject line for the follow-up'),
        body: z
          .string()
          .optional()
          .describe(
            'For email actions: the full email body to send. Write a professional, complete email.'
          ),
        // Meeting-specific fields
        meetingSummary: z
          .string()
          .optional()
          .describe('For meeting actions: the calendar event title'),
        attendees: z
          .array(z.string())
          .optional()
          .describe(
            'For meeting actions: list of attendee email addresses to invite. Extract from the input.'
          ),
        durationMinutes: z
          .number()
          .optional()
          .describe('For meeting actions: suggested meeting duration in minutes (default 30)')
      })
    )
    .describe('2-3 concrete next action steps')
})

// --- Prompt builders ---

function buildEmailReplyPrompt(reply: ExternalEmailReply): string {
  return `Analyze this email reply from an external party and extract structured insights.

Original email thread subject: ${reply.originalEmailSubject}
From: ${reply.from}
To: ${reply.to}
Date: ${reply.date}

Email body:
${reply.body}

Instructions:
- Extract 3-5 key insights (the most important takeaways)
- Identify 2-4 feedback points (sentiment, concerns, objections, positive signals, deadlines)
- Suggest 2-3 concrete next action steps, each as either a follow-up email or a meeting to schedule
- Be specific and actionable — don't give generic advice

IMPORTANT for action steps:
- For EMAIL actions: you MUST include "to" (recipient email from the From field), "subject" (a clear subject line), and "body" (full professional email text ready to send)
- For MEETING actions: you MUST include "meetingSummary" (calendar event title), "attendees" (email addresses extracted from the email), and "durationMinutes" (suggested duration)
- Write email bodies as if they will be sent directly — use a professional but warm tone`
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

IMPORTANT for action steps:
- For EMAIL actions: you MUST include "to" (recipient email — infer from participant info), "subject" (a clear subject line), and "body" (full professional email text ready to send)
- For MEETING actions: you MUST include "meetingSummary" (calendar event title), "attendees" (email addresses from the participants), and "durationMinutes" (suggested duration)
- Write email bodies as if they will be sent directly — use a professional but warm tone`
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
    model: getModelConfig(),
    system: 'Analyze the provided communication and extract structured insights.',
    prompt,
    output: Output.object({
      schema: insightsSchema
    })
  })

  const insightsData = result.output
  console.log(insightsData)

  if (!insightsData) {
    console.error(
      '❌ Insights extraction failed. Result structure:',
      JSON.stringify({
        finishReason: result.finishReason,
        textLength: result.text?.length
      })
    )
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

// --- Action execution ---

export interface ActionExecution {
  actionIndex: number
  action: ActionStep
  status: 'pending' | 'executed' | 'failed'
  executedAt?: string
  messageId?: string
  eventId?: string
  error?: string
}

/**
 * Compute the next weekday at 10:00 AM local time.
 * Used as the default start time for meeting actions.
 */
function getNextBusinessDayStart(): Date {
  const now = new Date()
  const next = new Date(now)
  next.setDate(next.getDate() + 1)

  // Skip weekends
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1)
  }

  next.setHours(10, 0, 0, 0)
  return next
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

  if (action.type === 'email') {
    return await executeEmailAction(sourceType, sourceId, actionIndex, action)
  } else {
    return await executeMeetingAction(sourceType, sourceId, actionIndex, action)
  }
}

async function executeEmailAction(
  sourceType: InsightsInputType,
  sourceId: string,
  actionIndex: number,
  action: ActionStep
): Promise<ActionExecution> {
  const to = action.to
  const subject = action.subject
  const body = action.body

  if (!to || !subject || !body) {
    const execution: ActionExecution = {
      actionIndex,
      action,
      status: 'failed',
      error: 'Missing email fields (to, subject, or body). Cannot send.'
    }
    db.logActionExecution(sourceType, sourceId, actionIndex, 'failed')
    return execution
  }

  console.log(`   📧 Sending email to: ${to}`)
  console.log(`   📧 Subject: ${subject}`)

  const result = await sendGmailReply(to, subject, body)

  if (result.success) {
    console.log(`   ✅ Email sent successfully (id: ${result.messageId})`)
    const execution: ActionExecution = {
      actionIndex,
      action,
      status: 'executed',
      executedAt: new Date().toISOString(),
      messageId: result.messageId
    }
    db.logActionExecution(sourceType, sourceId, actionIndex, 'executed')
    return execution
  } else {
    console.error(`   ❌ Email send failed: ${result.error}`)
    const execution: ActionExecution = {
      actionIndex,
      action,
      status: 'failed',
      error: result.error
    }
    db.logActionExecution(sourceType, sourceId, actionIndex, 'failed')
    return execution
  }
}

async function executeMeetingAction(
  sourceType: InsightsInputType,
  sourceId: string,
  actionIndex: number,
  action: ActionStep
): Promise<ActionExecution> {
  const summary = action.meetingSummary || action.description
  const attendees = action.attendees || []
  const durationMinutes = action.durationMinutes || 30

  const start = getNextBusinessDayStart()
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

  console.log(`   📅 Creating event: ${summary}`)
  console.log(`   📅 Start: ${start.toISOString()}`)
  console.log(`   📅 Attendees: ${attendees.join(', ') || 'none'}`)

  const result = await createCalendarEvent({
    summary,
    description: action.details,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    attendees
  })

  if (result.success) {
    console.log(`   ✅ Calendar event created (id: ${result.eventId})`)
    const execution: ActionExecution = {
      actionIndex,
      action,
      status: 'executed',
      executedAt: new Date().toISOString(),
      eventId: result.eventId
    }
    db.logActionExecution(sourceType, sourceId, actionIndex, 'executed')
    return execution
  } else {
    console.error(`   ❌ Calendar event creation failed: ${result.error}`)
    const execution: ActionExecution = {
      actionIndex,
      action,
      status: 'failed',
      error: result.error
    }
    db.logActionExecution(sourceType, sourceId, actionIndex, 'failed')
    return execution
  }
}
