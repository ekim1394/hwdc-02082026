import { useState, useEffect, useCallback } from 'react'

type ModelProvider = 'anthropic' | 'openai' | 'ollama'

interface SettingsPageProps {
  googleAuth: boolean
  authLoading: boolean
  authUrl: string | null
  onGoogleConnect: () => void
  onGoogleDisconnect: () => void
}

const DEFAULT_MODELS: Record<ModelProvider, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  ollama: 'llama3'
}

export default function SettingsPage({
  googleAuth,
  authLoading,
  authUrl,
  onGoogleConnect,
  onGoogleDisconnect
}: SettingsPageProps): React.JSX.Element {
  // --- Model provider state ---
  const [provider, setProvider] = useState<ModelProvider>('anthropic')
  const [modelName, setModelName] = useState('claude-haiku-4-5')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434/api')
  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // --- Delete data state ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<'success' | 'error' | null>(null)

  // Load current settings on mount
  useEffect(() => {
    window.api.getSettings().then((s) => {
      setProvider(s.modelProvider)
      setModelName(s.modelName)
      setOllamaUrl(s.ollamaBaseUrl)
      setAnthropicApiKey(s.anthropicApiKey || '')
      setOpenaiApiKey(s.openaiApiKey || '')
    })
  }, [])

  const handleProviderChange = useCallback(
    (newProvider: ModelProvider) => {
      setProvider(newProvider)
      // If current model name matches the default of the OLD provider, switch to new default
      if (modelName === DEFAULT_MODELS[provider]) {
        setModelName(DEFAULT_MODELS[newProvider])
      }
      setSaved(false)
    },
    [provider, modelName]
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    await window.api.updateSettings({
      modelProvider: provider,
      modelName: modelName,
      ollamaBaseUrl: ollamaUrl,
      anthropicApiKey: anthropicApiKey,
      openaiApiKey: openaiApiKey
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }, [provider, modelName, ollamaUrl, anthropicApiKey, openaiApiKey])

  const handleDeleteAll = useCallback(async () => {
    setDeleting(true)
    const result = await window.api.deleteAllData()
    setDeleting(false)
    setShowDeleteConfirm(false)
    if (result.success) {
      setDeleteResult('success')
    } else {
      setDeleteResult('error')
    }
    setTimeout(() => setDeleteResult(null), 4000)
  }, [])

  return (
    <div className="settings-page">
      <div className="settings-container">
        {/* --- Google Account --- */}
        <section className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-icon">🔗</span>
            <h2>Google Account</h2>
          </div>
          <p className="settings-card-desc">
            Connect your Google account to fetch real emails and calendar events.
          </p>
          <div className="settings-auth-row">
            <div className={`auth-status ${googleAuth ? 'connected' : ''}`}>
              <span className="auth-dot" />
              {googleAuth ? 'Connected' : 'Not Connected'}
            </div>
            {googleAuth ? (
              <button className="settings-btn danger-outline" onClick={onGoogleDisconnect}>
                Disconnect
              </button>
            ) : (
              <button
                className="settings-btn primary"
                onClick={onGoogleConnect}
                disabled={authLoading}
              >
                {authLoading ? '⏳ Waiting...' : '🔗 Connect Google'}
              </button>
            )}
          </div>
          {authUrl && (
            <div className="settings-auth-banner">
              <span>Open this link in your browser to sign in:</span>
              <a href={authUrl} target="_blank" rel="noreferrer" className="auth-link">
                {authUrl.slice(0, 80)}...
              </a>
              <button
                className="settings-btn small"
                onClick={() => navigator.clipboard.writeText(authUrl)}
              >
                📋 Copy
              </button>
            </div>
          )}
        </section>

        {/* --- Model Provider --- */}
        <section className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-icon">🤖</span>
            <h2>Model Provider</h2>
          </div>
          <p className="settings-card-desc">
            Choose which AI provider and model to use for the research and insights agents.
          </p>

          <div className="settings-form">
            <div className="form-group">
              <label className="form-label">Provider</label>
              <div className="provider-select">
                {(['anthropic', 'openai', 'ollama'] as ModelProvider[]).map((p) => (
                  <button
                    key={p}
                    className={`provider-option ${provider === p ? 'active' : ''}`}
                    onClick={() => handleProviderChange(p)}
                  >
                    <span className="provider-option-name">
                      {p === 'anthropic'
                        ? '🟣 Anthropic'
                        : p === 'openai'
                          ? '🟢 OpenAI'
                          : '🦙 Ollama'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="model-name">
                Model Name
              </label>
              <input
                id="model-name"
                type="text"
                className="form-input"
                value={modelName}
                onChange={(e) => {
                  setModelName(e.target.value)
                  setSaved(false)
                }}
                placeholder={DEFAULT_MODELS[provider]}
              />
            </div>

            {provider === 'ollama' && (
              <div className="form-group">
                <label className="form-label" htmlFor="ollama-url">
                  Ollama Base URL
                </label>
                <input
                  id="ollama-url"
                  type="text"
                  className="form-input"
                  value={ollamaUrl}
                  onChange={(e) => {
                    setOllamaUrl(e.target.value)
                    setSaved(false)
                  }}
                  placeholder="http://localhost:11434/api"
                />
              </div>
            )}

            {(provider === 'anthropic' || provider === 'openai') && (
              <div className="form-group">
                <label className="form-label" htmlFor="api-key">
                  {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key
                </label>
                <input
                  id="api-key"
                  type="password"
                  className="form-input"
                  value={provider === 'anthropic' ? anthropicApiKey : openaiApiKey}
                  onChange={(e) => {
                    if (provider === 'anthropic') {
                      setAnthropicApiKey(e.target.value)
                    } else {
                      setOpenaiApiKey(e.target.value)
                    }
                    setSaved(false)
                  }}
                  placeholder={`Enter your ${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key`}
                />
                <span className="form-hint">Stored locally. Overrides the .env file value.</span>
              </div>
            )}

            <div className="form-actions">
              <button className="settings-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Settings'}
              </button>
            </div>
          </div>
        </section>

        {/* --- Danger Zone --- */}
        <section className="settings-card danger-card">
          <div className="settings-card-header">
            <span className="settings-card-icon">⚠️</span>
            <h2>Danger Zone</h2>
          </div>
          <p className="settings-card-desc">
            Delete all locally stored emails, events, research results, insights, and disconnect
            your Google account. This action cannot be undone.
          </p>

          {deleteResult === 'success' && (
            <div className="settings-result success">
              ✅ All data has been deleted successfully.
            </div>
          )}
          {deleteResult === 'error' && (
            <div className="settings-result error">❌ Something went wrong. Please try again.</div>
          )}

          {!showDeleteConfirm ? (
            <button className="settings-btn danger" onClick={() => setShowDeleteConfirm(true)}>
              🗑️ Delete All Data
            </button>
          ) : (
            <div className="delete-confirm">
              <p className="delete-confirm-text">
                Are you sure? This will permanently delete all data.
              </p>
              <div className="delete-confirm-actions">
                <button
                  className="settings-btn danger"
                  onClick={handleDeleteAll}
                  disabled={deleting}
                >
                  {deleting ? '⏳ Deleting...' : 'Yes, Delete Everything'}
                </button>
                <button
                  className="settings-btn secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
