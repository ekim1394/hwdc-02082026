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
 * Encode a string to base64url (for sending emails).
 */
function encodeBase64Url(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
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
 * Parse a Gmail message detail into our EmailMessage shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGmailMessage(detail: any): EmailMessage {
  const headers = detail.payload?.headers || []
  const body = extractBody(detail.payload || {})

  return {
    id: detail.id!,
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject'),
    snippet: detail.snippet || '',
    body: body.slice(0, 2000),
    date: getHeader(headers, 'Date'),
    threadId: detail.threadId || undefined,
    messageId: getHeader(headers, 'Message-ID') || undefined
  }
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

      emails.push(parseGmailMessage(detail.data))
    } catch (err) {
      console.error(`📧 Failed to fetch message ${msg.id}:`, err)
    }
  }

  console.log(`📧 Fetched ${emails.length} new emails`)
  return emails
}

/**
 * Fetch all messages in a Gmail thread.
 * Returns messages newest-first.
 */
export async function getGmailThread(threadId: string): Promise<EmailMessage[]> {
  const auth = getAuthClient()
  if (!auth) {
    throw new Error('Not authenticated with Google')
  }

  const gmail = google.gmail({ version: 'v1', auth })

  console.log(`📧 Fetching thread ${threadId}...`)

  const threadRes = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full'
  })

  const messages = threadRes.data.messages || []
  return messages.map(parseGmailMessage).reverse()
}

/**
 * Send an email reply via Gmail API.
 * If threadId and inReplyTo are provided, the reply is threaded properly.
 */
export async function sendGmailReply(
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  inReplyTo?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const auth = getAuthClient()
  if (!auth) {
    return { success: false, error: 'Not authenticated with Google' }
  }

  const gmail = google.gmail({ version: 'v1', auth })

  // Build RFC 2822 message
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`
  const headers = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0'
  ]

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`)
    headers.push(`References: ${inReplyTo}`)
  }

  const rawMessage = `${headers.join('\r\n')}\r\n\r\n${body}`
  const encodedMessage = encodeBase64Url(rawMessage)

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: threadId || undefined
      }
    })

    console.log(`✉️ Email sent successfully, id: ${res.data.id}`)
    return { success: true, messageId: res.data.id || undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('✉️ Failed to send email:', message)
    return { success: false, error: message }
  }
}
