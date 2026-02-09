import * as fs from 'fs'
import * as path from 'path'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { ollama } from 'ollama-ai-provider'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelProvider = 'anthropic' | 'openai' | 'ollama'

export interface AppSettings {
  modelProvider: ModelProvider
  modelName: string
  ollamaBaseUrl: string
}

// ---------------------------------------------------------------------------
// Defaults & persistence
// ---------------------------------------------------------------------------

const SETTINGS_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.research-agent-settings.json'
)

const DEFAULT_SETTINGS: AppSettings = {
  modelProvider: 'anthropic',
  modelName: 'claude-haiku-4-5',
  ollamaBaseUrl: 'http://localhost:11434/api'
}

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
      return { ...DEFAULT_SETTINGS, ...raw }
    }
  } catch {
    console.warn('⚠️ Could not load settings, using defaults')
  }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSettings(): AppSettings {
  return loadSettings()
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings()
  const updated = { ...current, ...partial }
  saveSettings(updated)
  console.log('⚙️ Settings updated:', JSON.stringify(updated))
  return updated
}

/**
 * Returns a Vercel AI SDK model instance based on current settings.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModelConfig(): any {
  const settings = loadSettings()

  switch (settings.modelProvider) {
    case 'openai':
      return openai(settings.modelName)
    case 'ollama':
      return ollama(settings.modelName)
    default:
      return anthropic(settings.modelName)
  }
}
