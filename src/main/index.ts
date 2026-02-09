import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as dotenv from 'dotenv'
import { getEmails as getMockEmails, getEvents as getMockEvents } from './services/mock-data'
import { runResearchAgent, processNewItems } from './services/research-agent'
import { authenticate, getAuthStatus, signOut } from './services/google-auth'
import { getGmailEmails } from './services/gmail-service'
import { getCalendarEvents } from './services/calendar-service'
import * as db from './services/database'
import type { ResearchInput, EmailMessage, CalendarEvent } from './services/mock-data'

// Load environment variables
dotenv.config()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
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
    mainWindow!.show()
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

// ---------------------------------------------------------------------------
// Fetch + upsert + auto-process pipeline
// ---------------------------------------------------------------------------

async function fetchAndUpsertEmails(): Promise<EmailMessage[]> {
  let emails: EmailMessage[]

  if (getAuthStatus()) {
    try {
      emails = await getGmailEmails()
    } catch (error) {
      console.error('Failed to fetch Gmail, falling back to mock:', error)
      emails = getMockEmails()
    }
  } else {
    emails = getMockEmails()
  }

  const newCount = db.upsertEmails(emails)
  if (newCount > 0) {
    console.log(`📧 ${newCount} new emails → queuing auto-processing`)
    triggerAutoProcess()
  }

  return db.getAllEmails()
}

async function fetchAndUpsertEvents(): Promise<CalendarEvent[]> {
  let events: CalendarEvent[]

  if (getAuthStatus()) {
    try {
      events = await getCalendarEvents()
    } catch (error) {
      console.error('Failed to fetch Calendar, falling back to mock:', error)
      events = getMockEvents()
    }
  } else {
    events = getMockEvents()
  }

  const newCount = db.upsertEvents(events)
  if (newCount > 0) {
    console.log(`📅 ${newCount} new events → queuing auto-processing`)
    triggerAutoProcess()
  }

  return db.getAllEvents()
}

/**
 * Trigger auto-processing in the background.
 * Sends IPC events to the renderer when items are processed.
 */
function triggerAutoProcess(): void {
  // Debounce — wait 1s for both emails and events to upsert
  setTimeout(async () => {
    await processNewItems((type, id) => {
      // Notify renderer that an item was processed
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('item-processed', { type, id })
      }
    })
    // Notify renderer to refresh statuses
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('processing-complete')
    }
  }, 1000)
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
  // Google Auth
  ipcMain.handle('google-auth', async () => {
    try {
      const result = await authenticate()
      return result
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

  // Emails — fetch, upsert to DB, return from DB
  ipcMain.handle('get-emails', async () => {
    return await fetchAndUpsertEmails()
  })

  // Events — fetch, upsert to DB, return from DB
  ipcMain.handle('get-events', async () => {
    return await fetchAndUpsertEvents()
  })

  // Research agent — manual trigger (also checks DB cache)
  ipcMain.handle('run-research', async (_event, input: ResearchInput) => {
    try {
      const result = await runResearchAgent(input)
      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  })

  // Get cached research from DB
  ipcMain.handle('get-research', (_event, type: 'email' | 'calendar', sourceId: string) => {
    return db.getResearch(type, sourceId)
  })

  // Get processing statuses for all items
  ipcMain.handle('get-processing-statuses', () => {
    return db.getAllProcessingStatuses()
  })
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  db.initDatabase()

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
