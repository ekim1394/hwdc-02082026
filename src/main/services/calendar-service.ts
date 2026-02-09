import { google } from 'googleapis'
import { getAuthClient } from './google-auth'
import type { CalendarEvent } from './mock-data'

/**
 * Fetch upcoming calendar events from Google Calendar API.
 * Returns data in the same shape as the mock CalendarEvent interface.
 */
export async function getCalendarEvents(maxResults = 10): Promise<CalendarEvent[]> {
  const auth = getAuthClient()
  if (!auth) {
    throw new Error('Not authenticated with Google')
  }

  const calendar = google.calendar({ version: 'v3', auth })

  console.log(`📅 Fetching ${maxResults} upcoming events from Google Calendar...`)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime'
  })

  const items = res.data.items || []
  if (items.length === 0) {
    console.log('📅 No upcoming events found')
    return []
  }

  const events: CalendarEvent[] = items.map((item) => {
    const attendees = (item.attendees || []).map((a) => ({
      name: a.displayName || a.email?.split('@')[0] || 'Unknown',
      email: a.email || '',
      company: a.email ? a.email.split('@')[1]?.split('.')[0] : undefined
    }))

    return {
      id: item.id || '',
      summary: item.summary || '(No title)',
      description: item.description || '',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      attendees,
      location: item.location || undefined
    }
  })

  console.log(`📅 Fetched ${events.length} events`)
  return events
}
