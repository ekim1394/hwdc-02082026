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
  }
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
