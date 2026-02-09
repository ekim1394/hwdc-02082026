import { google } from 'googleapis'
import { getAuthClient } from './google-auth'
import type { EmailMessage } from './mock-data'

/**
 * Decode base64url-encoded email body content.
 */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

/**
 * Extract the plain-text body from a Gmail message payload.
 */
function extractBody(payload: {
  mimeType?: string
  body?: { data?: string }
  parts?: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }[]
}): string {
  // Simple text/plain message
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Multipart — find text/plain part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
    // Fallback: try text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data)
        // Strip HTML tags for plain text display
        return html.replace(/<[^>]*>/g, '').trim()
      }
    }
  }

  return '(No body content)'
}

/**
 * Get a header value from a Gmail message.
 */
function getHeader(headers: { name?: string; value?: string }[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

/**
 * Fetch recent emails from Gmail API.
 * Returns data in the same shape as the mock EmailMessage interface.
 */
export async function getGmailEmails(
  maxResults = 10,
  knownIds?: Set<string>
): Promise<EmailMessage[]> {
  const auth = getAuthClient()
  if (!auth) {
    throw new Error('Not authenticated with Google')
  }

  const gmail = google.gmail({ version: 'v1', auth })

  console.log(`📧 Fetching ${maxResults} recent emails from Gmail...`)

  // List message IDs
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    labelIds: ['INBOX']
  })

  const messageIds = listRes.data.messages || []
  if (messageIds.length === 0) {
    console.log('📧 No emails found')
    return []
  }

  // Filter out messages we already have
  const newMessageIds = knownIds ? messageIds.filter((msg) => !knownIds.has(msg.id!)) : messageIds

  if (newMessageIds.length === 0) {
    console.log('📧 No new emails to fetch (all already in DB)')
    return []
  }

  console.log(
    `📧 ${newMessageIds.length} new emails to fetch (${messageIds.length - newMessageIds.length} skipped)`
  )

  // Fetch full message details only for new messages
  const emails: EmailMessage[] = []

  for (const msg of newMessageIds) {
    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full'
      })

      const headers = detail.data.payload?.headers || []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = extractBody((detail.data.payload as any) || {})

      emails.push({
        id: detail.data.id || msg.id!,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: getHeader(headers as any, 'From'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: getHeader(headers as any, 'To'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subject: getHeader(headers as any, 'Subject'),
        snippet: detail.data.snippet || '',
        body: body.slice(0, 2000),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        date: getHeader(headers as any, 'Date')
      })
    } catch (err) {
      console.error(`📧 Failed to fetch message ${msg.id}:`, err)
    }
  }

  console.log(`📧 Fetched ${emails.length} new emails`)
  return emails
}
