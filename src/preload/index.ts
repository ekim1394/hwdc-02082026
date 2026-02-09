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
  googleAuth: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('google-auth'),
  googleAuthStatus: (): Promise<{ authenticated: boolean }> =>
    ipcRenderer.invoke('google-auth-status'),
  googleSignOut: (): Promise<{ success: boolean }> => ipcRenderer.invoke('google-sign-out')
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
