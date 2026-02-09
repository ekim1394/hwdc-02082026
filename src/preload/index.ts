import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface ResearchApiResult {
  success: boolean
  data?: {
    output: string
    toolCalls: { tool: string; query: string }[]
  }
  error?: string
}

export interface ActionStepData {
  type: 'email' | 'meeting'
  description: string
  details: string
  to?: string
  subject?: string
  body?: string
  meetingSummary?: string
  attendees?: string[]
  durationMinutes?: number
}

export interface InsightsApiResult {
  success: boolean
  data?: {
    keyInsights: string[]
    feedback: string[]
    actionSteps: ActionStepData[]
    rawOutput: string
  }
  error?: string
}

const api = {
  getEmails: (): Promise<unknown[]> => ipcRenderer.invoke('get-emails'),
  getEvents: (): Promise<unknown[]> => ipcRenderer.invoke('get-events'),
  runResearch: (input: { type: string; data: unknown }): Promise<ResearchApiResult> =>
    ipcRenderer.invoke('run-research', input),
  googleAuth: (): Promise<{ success: boolean; error?: string; authUrl?: string }> =>
    ipcRenderer.invoke('google-auth'),
  googleAuthStatus: (): Promise<{ authenticated: boolean }> =>
    ipcRenderer.invoke('google-auth-status'),
  googleSignOut: (): Promise<{ success: boolean }> => ipcRenderer.invoke('google-sign-out'),

  // DB queries
  getResearch: (
    type: 'email' | 'calendar',
    sourceId: string
  ): Promise<{ output: string; toolCalls: { tool: string; query: string }[] } | null> =>
    ipcRenderer.invoke('get-research', type, sourceId),
  getProcessingStatuses: (): Promise<Record<string, 'pending' | 'done'>> =>
    ipcRenderer.invoke('get-processing-statuses'),

  // IPC events from main process
  onItemProcessed: (callback: (data: { type: string; id: string }) => void): void => {
    ipcRenderer.on('item-processed', (_event, data) => callback(data))
  },
  onProcessingComplete: (callback: () => void): void => {
    ipcRenderer.on('processing-complete', () => callback())
  },

  // Insights Agent
  getExternalReplies: (): Promise<unknown[]> => ipcRenderer.invoke('get-external-replies'),
  getMeetingTranscripts: (): Promise<unknown[]> => ipcRenderer.invoke('get-meeting-transcripts'),
  runInsights: (input: { type: string; data: unknown }): Promise<InsightsApiResult> =>
    ipcRenderer.invoke('run-insights', input),
  getInsights: (
    type: string,
    sourceId: string
  ): Promise<{
    keyInsights: string[]
    feedback: string[]
    actionSteps: ActionStepData[]
    rawOutput: string
  } | null> => ipcRenderer.invoke('get-insights', type, sourceId),
  executeInsightAction: (
    sourceType: string,
    sourceId: string,
    actionIndex: number
  ): Promise<{ success: boolean; messageId?: string; eventId?: string; error?: string }> =>
    ipcRenderer.invoke('execute-insight-action', sourceType, sourceId, actionIndex),
  getActionLog: (
    sourceType: string,
    sourceId: string
  ): Promise<{ actionIndex: number; status: string; executedAt: string }[]> =>
    ipcRenderer.invoke('get-action-log', sourceType, sourceId),

  // Email thread & send
  getEmailThread: (threadId: string): Promise<unknown[]> =>
    ipcRenderer.invoke('get-email-thread', threadId),
  sendEmailReply: (
    to: string,
    subject: string,
    body: string,
    threadId?: string,
    messageId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> =>
    ipcRenderer.invoke('send-email-reply', to, subject, body, threadId, messageId),

  // Settings
  getSettings: (): Promise<{
    modelProvider: 'anthropic' | 'openai' | 'ollama'
    modelName: string
    ollamaBaseUrl: string
    anthropicApiKey: string
    openaiApiKey: string
  }> => ipcRenderer.invoke('get-settings'),
  updateSettings: (partial: {
    modelProvider?: 'anthropic' | 'openai' | 'ollama'
    modelName?: string
    ollamaBaseUrl?: string
    anthropicApiKey?: string
    openaiApiKey?: string
  }): Promise<{
    modelProvider: 'anthropic' | 'openai' | 'ollama'
    modelName: string
    ollamaBaseUrl: string
    anthropicApiKey: string
    openaiApiKey: string
  }> => ipcRenderer.invoke('update-settings', partial),
  deleteAllData: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('delete-all-data')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
