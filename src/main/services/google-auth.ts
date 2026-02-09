import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import * as http from 'http'
import * as url from 'url'
import * as fs from 'fs'
import * as path from 'path'
import { shell } from 'electron'

// Scopes needed for Gmail and Calendar read access
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly'
]

const TOKEN_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.research-agent-tokens.json'
)

let oAuth2Client: OAuth2Client | null = null
let isAuthenticated = false

/**
 * Load client credentials from the client_secret JSON file in the project root.
 */
function loadCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const projectRoot = process.cwd()
  const files = fs.readdirSync(projectRoot)
  const secretFile = files.find((f) => f.startsWith('client_secret') && f.endsWith('.json'))

  if (!secretFile) {
    throw new Error(
      'No client_secret*.json file found in project root. Download it from Google Cloud Console.'
    )
  }

  const raw = JSON.parse(fs.readFileSync(path.join(projectRoot, secretFile), 'utf-8'))
  const creds = raw.installed || raw.web

  return {
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
    redirectUri: 'http://127.0.0.1'
  }
}

/**
 * Initialize the OAuth2 client. Tries to load saved tokens first.
 */
function initClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = loadCredentials()
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  // Try loading saved tokens
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
      client.setCredentials(tokens)
      isAuthenticated = true
      console.log('✅ Google auth: loaded saved tokens')
    } catch {
      console.log('⚠️ Google auth: could not load saved tokens')
    }
  }

  oAuth2Client = client
  return client
}

/**
 * Run the OAuth2 consent flow:
 * 1. Start a temp local server to catch the redirect
 * 2. Open system browser for Google consent
 * 3. Exchange code for tokens
 * 4. Save tokens to disk
 */
export async function authenticate(): Promise<{ success: boolean; authUrl?: string }> {
  const client = oAuth2Client || initClient()

  return new Promise((resolve) => {
    // Find a free port and start local server
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url || '', true)
        const code = parsedUrl.query.code as string

        if (!code) {
          res.writeHead(400)
          res.end('Missing authorization code')
          return
        }

        // Exchange code for tokens
        const { tokens } = await client.getToken({
          code,
          redirect_uri: `http://127.0.0.1:${(server.address() as { port: number }).port}`
        })
        client.setCredentials(tokens)
        isAuthenticated = true

        // Save tokens
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2))
        console.log('✅ Google auth: tokens saved to', TOKEN_PATH)

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>✅ Authentication successful!</h2><p>You can close this tab and return to the app.</p></body></html>'
        )

        server.close()
        resolve({ success: true })
      } catch (err) {
        console.error('❌ Google auth error:', err)
        res.writeHead(500)
        res.end('Authentication failed')
        server.close()
        resolve({ success: false })
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      const updatedRedirectUri = `http://127.0.0.1:${port}`

      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        redirect_uri: updatedRedirectUri,
        prompt: 'consent'
      })

      console.log('🔐 Google auth URL:', authUrl)

      // Try to open browser — may fail on WSL
      shell.openExternal(authUrl).catch(() => {
        console.log('⚠️ Could not open browser automatically. Use the URL in the app.')
      })

      // Return URL to renderer so user can click it
      resolve({ success: false, authUrl })
    })

    // Timeout after 3 minutes
    setTimeout(() => {
      if (!isAuthenticated) {
        server.close()
      }
    }, 180_000)
  })
}

/**
 * Get the authenticated OAuth2 client.
 * Returns null if not authenticated.
 */
export function getAuthClient(): OAuth2Client | null {
  if (!oAuth2Client) {
    initClient()
  }
  return isAuthenticated ? oAuth2Client : null
}

/**
 * Check if the user is currently authenticated.
 */
export function getAuthStatus(): boolean {
  if (!oAuth2Client) {
    initClient()
  }
  return isAuthenticated
}

/**
 * Sign out — clear tokens from memory and disk.
 */
export function signOut(): void {
  if (oAuth2Client) {
    oAuth2Client.revokeCredentials().catch(() => {})
    oAuth2Client = null
  }
  isAuthenticated = false
  if (fs.existsSync(TOKEN_PATH)) {
    fs.unlinkSync(TOKEN_PATH)
  }
  console.log('👋 Google auth: signed out')
}
