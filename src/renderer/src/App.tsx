import { useState, useCallback, useRef, useEffect } from 'react'
import SourcePicker from './components/SourcePicker'
import SourceDetail from './components/SourceDetail'
import ResearchOutput from './components/ResearchOutput'

function App(): React.JSX.Element {
  const [output, setOutput] = useState<string | null>(null)
  const [toolCalls, setToolCalls] = useState<{ tool: string; query: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputType, setInputType] = useState<'email' | 'calendar' | null>(null)
  const [selectedData, setSelectedData] = useState<unknown | null>(null)

  // Google auth state
  const [googleAuth, setGoogleAuth] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [authKey, setAuthKey] = useState(0) // bump to force SourcePicker re-fetch

  useEffect(() => {
    window.api.googleAuthStatus().then((res) => setGoogleAuth(res.authenticated))
  }, [])

  // Poll for auth completion when authUrl is shown
  useEffect(() => {
    if (!authUrl) return
    const interval = setInterval(async () => {
      const res = await window.api.googleAuthStatus()
      if (res.authenticated) {
        setGoogleAuth(true)
        setAuthUrl(null)
        setAuthLoading(false)
        setAuthKey((k) => k + 1)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [authUrl])

  const handleGoogleConnect = useCallback(async () => {
    setAuthLoading(true)
    const result = await window.api.googleAuth()
    if (result.success) {
      setGoogleAuth(true)
      setAuthKey((k) => k + 1)
      setAuthLoading(false)
    } else if (result.authUrl) {
      // Browser may not have opened — show the URL
      setAuthUrl(result.authUrl)
    } else {
      setAuthLoading(false)
    }
  }, [])

  const handleGoogleDisconnect = useCallback(async () => {
    await window.api.googleSignOut()
    setGoogleAuth(false)
    setAuthUrl(null)
    setAuthKey((k) => k + 1) // force re-fetch with mock data
  }, [])

  // --- Resizable split ---
  const [splitPercent, setSplitPercent] = useState(40)
  const isDragging = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current || !contentRef.current) return
      const rect = contentRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const percent = Math.min(Math.max((y / rect.height) * 100, 15), 85)
      setSplitPercent(percent)
    }

    const handleMouseUp = (): void => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleSelect = useCallback(async (type: 'email' | 'calendar', data: unknown) => {
    setInputType(type)
    setSelectedData(data)
    setOutput(null)
    setToolCalls([])
    setError(null)

    const itemId = (data as { id: string }).id

    // Check DB cache first — show instantly if available
    const cached = await window.api.getResearch(type, itemId)
    if (cached) {
      setOutput(cached.output)
      setToolCalls(cached.toolCalls)
      return
    }

    // No cache — run the agent
    setLoading(true)
    try {
      const result = await window.api.runResearch({ type, data })
      if (result.success && result.data) {
        setOutput(result.data.output)
        setToolCalls(result.data.toolCalls)
      } else {
        setError(result.error ?? 'Unknown error occurred')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run research agent')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-load research when background processing completes for current selection
  useEffect(() => {
    window.api.onItemProcessed(async (data) => {
      if (inputType && selectedData) {
        const currentId = (selectedData as { id: string }).id
        if (data.type === inputType && data.id === currentId) {
          const cached = await window.api.getResearch(inputType, currentId)
          if (cached) {
            setOutput(cached.output)
            setToolCalls(cached.toolCalls)
            setLoading(false)
          }
        }
      }
    })
  }, [inputType, selectedData])

  const hasSelection = inputType !== null

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span className="logo-icon">🧠</span>
          <h1>Research Agent</h1>
        </div>
        <div className="header-right">
          <div className={`auth-status ${googleAuth ? 'connected' : ''}`}>
            <span className="auth-dot" />
            {googleAuth ? 'Google Connected' : 'Using Mock Data'}
          </div>
          {googleAuth ? (
            <button className="auth-btn disconnect" onClick={handleGoogleDisconnect}>
              Disconnect
            </button>
          ) : (
            <button
              className="auth-btn connect"
              onClick={handleGoogleConnect}
              disabled={authLoading}
            >
              {authLoading ? '⏳ Waiting...' : '🔗 Connect Google'}
            </button>
          )}
        </div>
      </header>

      {authUrl && (
        <div className="auth-banner">
          <span>Open this link in your browser to sign in:</span>
          <a href={authUrl} target="_blank" rel="noreferrer" className="auth-link">
            {authUrl.slice(0, 80)}...
          </a>
          <button className="action-btn" onClick={() => navigator.clipboard.writeText(authUrl)}>
            📋 Copy URL
          </button>
        </div>
      )}

      <main className="app-main">
        <SourcePicker key={authKey} onSelect={handleSelect} disabled={loading} />
        <div ref={contentRef} className={`content-area ${hasSelection ? 'has-selection' : ''}`}>
          {hasSelection ? (
            <>
              <div className="content-top" style={{ height: `${splitPercent}%` }}>
                <SourceDetail type={inputType} data={selectedData as never} />
              </div>
              <div
                className="resize-handle"
                onMouseDown={handleMouseDown}
                role="separator"
                aria-orientation="horizontal"
                title="Drag to resize"
              >
                <div className="resize-handle-bar" />
              </div>
              <div className="content-bottom" style={{ height: `${100 - splitPercent}%` }}>
                <ResearchOutput
                  output={output}
                  toolCalls={toolCalls}
                  loading={loading}
                  error={error}
                  inputType={inputType}
                />
              </div>
            </>
          ) : (
            <ResearchOutput
              output={null}
              toolCalls={[]}
              loading={false}
              error={null}
              inputType={null}
            />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
