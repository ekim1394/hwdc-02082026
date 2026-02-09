import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as dotenv from 'dotenv'
import { getEmails as getMockEmails, getEvents as getMockEvents } from './services/mock-data'
import { runResearchAgent } from './services/research-agent'
import { authenticate, getAuthStatus, signOut } from './services/google-auth'
import { getGmailEmails } from './services/gmail-service'
import { getCalendarEvents } from './services/calendar-service'
import type { ResearchInput } from './services/mock-data'

// Load environment variables
dotenv.config()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- IPC Handlers ---

function registerIpcHandlers(): void {
  // Google Auth
  ipcMain.handle('google-auth', async () => {
    try {
      const success = await authenticate()
      return { success }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('google-auth-status', () => {
    return { authenticated: getAuthStatus() }
  })

  ipcMain.handle('google-sign-out', () => {
    signOut()
    return { success: true }
  })

  // Emails — use Gmail API if authenticated, otherwise mock data
  ipcMain.handle('get-emails', async () => {
    if (getAuthStatus()) {
      try {
        return await getGmailEmails()
      } catch (error) {
        console.error('Failed to fetch Gmail, falling back to mock:', error)
        return getMockEmails()
      }
    }
    return getMockEmails()
  })

  // Events — use Calendar API if authenticated, otherwise mock data
  ipcMain.handle('get-events', async () => {
    if (getAuthStatus()) {
      try {
        return await getCalendarEvents()
      } catch (error) {
        console.error('Failed to fetch Calendar, falling back to mock:', error)
        return getMockEvents()
      }
    }
    return getMockEvents()
  })

  // Research agent
  ipcMain.handle('run-research', async (_event, input: ResearchInput) => {
    try {
      const result = await runResearchAgent(input)
      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
