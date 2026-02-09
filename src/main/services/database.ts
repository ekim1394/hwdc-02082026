import Database from 'better-sqlite3'
import * as path from 'path'
import type { EmailMessage, CalendarEvent } from './mock-data'
import type { AgentResult } from './research-agent'
import type { InsightsResult } from './insights-agent'
import type { InsightsInputType } from './insights-mock-data'

const DB_PATH = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.research-agent.db')

let db: Database.Database | null = null

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initDatabase(): void {
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      from_addr TEXT,
      to_addr TEXT,
      subject TEXT,
      snippet TEXT,
      body TEXT,
      date TEXT,
      processed INTEGER DEFAULT 0,
      fetched_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      summary TEXT,
      description TEXT,
      start_time TEXT,
      end_time TEXT,
      attendees TEXT,
      location TEXT,
      processed INTEGER DEFAULT 0,
      fetched_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS research_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      output TEXT NOT NULL,
      tool_calls TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source_type, source_id)
    );

    CREATE TABLE IF NOT EXISTS insights_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      key_insights TEXT NOT NULL,
      feedback TEXT NOT NULL,
      action_steps TEXT NOT NULL,
      raw_output TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source_type, source_id)
    );

    CREATE TABLE IF NOT EXISTS insights_action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      action_index INTEGER NOT NULL,
      status TEXT NOT NULL,
      executed_at TEXT DEFAULT (datetime('now'))
    );
  `)

  console.log('💾 Database initialized at', DB_PATH)
}

function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

/**
 * Upsert emails into the database. Returns the number of NEW emails inserted.
 */
export function upsertEmails(emails: EmailMessage[]): number {
  const d = getDb()
  const insert = d.prepare(`
    INSERT INTO emails (id, from_addr, to_addr, subject, snippet, body, date)
    VALUES (@id, @from, @to, @subject, @snippet, @body, @date)
    ON CONFLICT(id) DO UPDATE SET
      from_addr=excluded.from_addr, to_addr=excluded.to_addr,
      subject=excluded.subject, snippet=excluded.snippet,
      body=excluded.body, date=excluded.date
  `)

  // Check which IDs already exist
  const existingIds = new Set(
    d
      .prepare('SELECT id FROM emails')
      .all()
      .map((row) => (row as { id: string }).id)
  )

  let newCount = 0
  const tx = d.transaction(() => {
    for (const email of emails) {
      if (!existingIds.has(email.id)) newCount++
      insert.run({
        id: email.id,
        from: email.from,
        to: email.to,
        subject: email.subject,
        snippet: email.snippet,
        body: email.body,
        date: email.date
      })
    }
  })
  tx()

  return newCount
}

export function getExistingEmailIds(): Set<string> {
  return new Set(
    getDb()
      .prepare('SELECT id FROM emails')
      .all()
      .map((row) => (row as { id: string }).id)
  )
}

export function getExistingEventIds(): Set<string> {
  return new Set(
    getDb()
      .prepare('SELECT id FROM events')
      .all()
      .map((row) => (row as { id: string }).id)
  )
}

export function getAllEmails(): EmailMessage[] {
  return getDb()
    .prepare(
      'SELECT id, from_addr as "from", to_addr as "to", subject, snippet, body, date FROM emails ORDER BY date DESC'
    )
    .all() as EmailMessage[]
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Upsert events into the database. Returns the number of NEW events inserted.
 */
export function upsertEvents(events: CalendarEvent[]): number {
  const d = getDb()
  const insert = d.prepare(`
    INSERT INTO events (id, summary, description, start_time, end_time, attendees, location)
    VALUES (@id, @summary, @description, @start, @end, @attendees, @location)
    ON CONFLICT(id) DO UPDATE SET
      summary=excluded.summary, description=excluded.description,
      start_time=excluded.start_time, end_time=excluded.end_time,
      attendees=excluded.attendees, location=excluded.location
  `)

  const existingIds = new Set(
    d
      .prepare('SELECT id FROM events')
      .all()
      .map((row) => (row as { id: string }).id)
  )

  let newCount = 0
  const tx = d.transaction(() => {
    for (const event of events) {
      if (!existingIds.has(event.id)) newCount++
      insert.run({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        attendees: JSON.stringify(event.attendees),
        location: event.location || null
      })
    }
  })
  tx()

  return newCount
}

export function getAllEvents(): CalendarEvent[] {
  const rows = getDb()
    .prepare(
      'SELECT id, summary, description, start_time as start, end_time as "end", attendees, location FROM events ORDER BY start_time ASC'
    )
    .all() as {
    id: string
    summary: string
    description: string
    start: string
    end: string
    attendees: string
    location?: string
  }[]

  return rows.map((row) => ({
    ...row,
    attendees: JSON.parse(row.attendees)
  }))
}

// ---------------------------------------------------------------------------
// Unprocessed items
// ---------------------------------------------------------------------------

export interface UnprocessedItem {
  type: 'email' | 'calendar'
  id: string
  data: EmailMessage | CalendarEvent
}

export function getUnprocessedItems(): UnprocessedItem[] {
  const d = getDb()
  const items: UnprocessedItem[] = []

  const emails = d
    .prepare(
      'SELECT id, from_addr as "from", to_addr as "to", subject, snippet, body, date FROM emails WHERE processed = 0'
    )
    .all() as EmailMessage[]
  for (const email of emails) {
    items.push({ type: 'email', id: email.id, data: email })
  }

  const eventRows = d
    .prepare(
      'SELECT id, summary, description, start_time as start, end_time as "end", attendees, location FROM events WHERE processed = 0'
    )
    .all() as {
    id: string
    summary: string
    description: string
    start: string
    end: string
    attendees: string
    location?: string
  }[]
  for (const row of eventRows) {
    items.push({
      type: 'calendar',
      id: row.id,
      data: { ...row, attendees: JSON.parse(row.attendees) }
    })
  }

  return items
}

export function markProcessed(type: 'email' | 'calendar', id: string): void {
  const table = type === 'email' ? 'emails' : 'events'
  getDb().prepare(`UPDATE ${table} SET processed = 1 WHERE id = ?`).run(id)
}

// ---------------------------------------------------------------------------
// Research results
// ---------------------------------------------------------------------------

export function saveResearch(
  type: 'email' | 'calendar',
  sourceId: string,
  result: AgentResult
): void {
  getDb()
    .prepare(
      `INSERT INTO research_results (source_type, source_id, output, tool_calls)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(source_type, source_id) DO UPDATE SET
         output=excluded.output, tool_calls=excluded.tool_calls,
         created_at=datetime('now')`
    )
    .run(type, sourceId, result.output, JSON.stringify(result.toolCalls))
}

export function getResearch(type: 'email' | 'calendar', sourceId: string): AgentResult | null {
  const row = getDb()
    .prepare(
      'SELECT output, tool_calls FROM research_results WHERE source_type = ? AND source_id = ?'
    )
    .get(type, sourceId) as { output: string; tool_calls: string } | undefined

  if (!row) return null
  return {
    output: row.output,
    toolCalls: JSON.parse(row.tool_calls)
  }
}

export function getAllResearch(): {
  sourceType: string
  sourceId: string
  output: string
  toolCalls: { tool: string; query: string }[]
  createdAt: string
}[] {
  const rows = getDb()
    .prepare(
      'SELECT source_type, source_id, output, tool_calls, created_at FROM research_results ORDER BY created_at DESC'
    )
    .all() as {
    source_type: string
    source_id: string
    output: string
    tool_calls: string
    created_at: string
  }[]

  return rows.map((row) => ({
    sourceType: row.source_type,
    sourceId: row.source_id,
    output: row.output,
    toolCalls: JSON.parse(row.tool_calls),
    createdAt: row.created_at
  }))
}

/**
 * Get processing status for a specific item.
 */
export function getProcessingStatus(type: 'email' | 'calendar', id: string): 'pending' | 'done' {
  const table = type === 'email' ? 'emails' : 'events'
  const row = getDb().prepare(`SELECT processed FROM ${table} WHERE id = ?`).get(id) as
    | { processed: number }
    | undefined
  if (!row) return 'pending'
  return row.processed === 1 ? 'done' : 'pending'
}

/**
 * Get processing statuses for all items.
 */
export function getAllProcessingStatuses(): Record<string, 'pending' | 'done'> {
  const d = getDb()
  const statuses: Record<string, 'pending' | 'done'> = {}

  const emails = d.prepare('SELECT id, processed FROM emails').all() as {
    id: string
    processed: number
  }[]
  for (const e of emails) {
    statuses[`email:${e.id}`] = e.processed === 1 ? 'done' : 'pending'
  }

  const events = d.prepare('SELECT id, processed FROM events').all() as {
    id: string
    processed: number
  }[]
  for (const ev of events) {
    statuses[`calendar:${ev.id}`] = ev.processed === 1 ? 'done' : 'pending'
  }

  return statuses
}

// ---------------------------------------------------------------------------
// Insights results
// ---------------------------------------------------------------------------

export function saveInsights(
  type: InsightsInputType,
  sourceId: string,
  result: InsightsResult
): void {
  getDb()
    .prepare(
      `INSERT INTO insights_results (source_type, source_id, key_insights, feedback, action_steps, raw_output)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_type, source_id) DO UPDATE SET
         key_insights=excluded.key_insights, feedback=excluded.feedback,
         action_steps=excluded.action_steps, raw_output=excluded.raw_output,
         created_at=datetime('now')`
    )
    .run(
      type,
      sourceId,
      JSON.stringify(result.keyInsights),
      JSON.stringify(result.feedback),
      JSON.stringify(result.actionSteps),
      result.rawOutput
    )
}

export function getInsights(type: InsightsInputType, sourceId: string): InsightsResult | null {
  const row = getDb()
    .prepare(
      'SELECT key_insights, feedback, action_steps, raw_output FROM insights_results WHERE source_type = ? AND source_id = ?'
    )
    .get(type, sourceId) as
    | { key_insights: string; feedback: string; action_steps: string; raw_output: string }
    | undefined

  if (!row) return null
  return {
    keyInsights: JSON.parse(row.key_insights),
    feedback: JSON.parse(row.feedback),
    actionSteps: JSON.parse(row.action_steps),
    rawOutput: row.raw_output
  }
}

// ---------------------------------------------------------------------------
// Insights action log
// ---------------------------------------------------------------------------

export function logActionExecution(
  sourceType: InsightsInputType,
  sourceId: string,
  actionIndex: number,
  status: string
): void {
  getDb()
    .prepare(
      `INSERT INTO insights_action_log (source_type, source_id, action_index, status)
       VALUES (?, ?, ?, ?)`
    )
    .run(sourceType, sourceId, actionIndex, status)
}

export function getActionLog(
  sourceType: InsightsInputType,
  sourceId: string
): { actionIndex: number; status: string; executedAt: string }[] {
  const rows = getDb()
    .prepare(
      'SELECT action_index, status, executed_at FROM insights_action_log WHERE source_type = ? AND source_id = ? ORDER BY executed_at DESC'
    )
    .all(sourceType, sourceId) as {
    action_index: number
    status: string
    executed_at: string
  }[]

  return rows.map((r) => ({
    actionIndex: r.action_index,
    status: r.status,
    executedAt: r.executed_at
  }))
}
