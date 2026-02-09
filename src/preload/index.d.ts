import { ElectronAPI } from '@electron-toolkit/preload'

interface ResearchApiResult {
  success: boolean
  data?: {
    output: string
    toolCalls: { tool: string; query: string }[]
  }
  error?: string
}

interface InsightsApiResult {
  success: boolean
  data?: {
    keyInsights: string[]
    feedback: string[]
    actionSteps: { type: 'email' | 'meeting'; description: string; details: string }[]
    rawOutput: string
  }
  error?: string
}

interface Api {
  getEmails: () => Promise<
    {
      id: string
      from: string
      to: string
      subject: string
      snippet: string
      body: string
      date: string
    }[]
  >
  getEvents: () => Promise<
    {
      id: string
      summary: string
      description: string
      start: string
      end: string
      attendees: { name: string; email: string; company?: string }[]
      location?: string
    }[]
  >
  runResearch: (input: { type: string; data: unknown }) => Promise<ResearchApiResult>
  googleAuth: () => Promise<{ success: boolean; error?: string; authUrl?: string }>
  googleAuthStatus: () => Promise<{ authenticated: boolean }>
  googleSignOut: () => Promise<{ success: boolean }>
  getResearch: (
    type: 'email' | 'calendar',
    sourceId: string
  ) => Promise<{ output: string; toolCalls: { tool: string; query: string }[] } | null>
  getProcessingStatuses: () => Promise<Record<string, 'pending' | 'done'>>
  onItemProcessed: (callback: (data: { type: string; id: string }) => void) => void
  onProcessingComplete: (callback: () => void) => void

  // Insights Agent
  getExternalReplies: () => Promise<
    {
      id: string
      from: string
      to: string
      subject: string
      body: string
      originalEmailSubject: string
      date: string
    }[]
  >
  getMeetingTranscripts: () => Promise<
    {
      id: string
      title: string
      date: string
      participants: { name: string; role?: string }[]
      transcript: string
    }[]
  >
  runInsights: (input: { type: string; data: unknown }) => Promise<InsightsApiResult>
  getInsights: (
    type: string,
    sourceId: string
  ) => Promise<{
    keyInsights: string[]
    feedback: string[]
    actionSteps: { type: 'email' | 'meeting'; description: string; details: string }[]
    rawOutput: string
  } | null>
  executeInsightAction: (
    sourceType: string,
    sourceId: string,
    actionIndex: number
  ) => Promise<{ success: boolean; error?: string }>
  getActionLog: (
    sourceType: string,
    sourceId: string
  ) => Promise<{ actionIndex: number; status: string; executedAt: string }[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
