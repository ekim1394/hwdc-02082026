import { ElectronAPI } from '@electron-toolkit/preload'

interface ResearchApiResult {
  success: boolean
  data?: {
    output: string
    toolCalls: { tool: string; query: string }[]
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
  googleAuth: () => Promise<{ success: boolean; error?: string }>
  googleAuthStatus: () => Promise<{ authenticated: boolean }>
  googleSignOut: () => Promise<{ success: boolean }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
