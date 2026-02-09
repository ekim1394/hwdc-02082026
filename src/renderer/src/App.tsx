import { useState, useCallback } from 'react'
import SourcePicker from './components/SourcePicker'
import ResearchOutput from './components/ResearchOutput'

function App(): React.JSX.Element {
  const [output, setOutput] = useState<string | null>(null)
  const [toolCalls, setToolCalls] = useState<{ tool: string; query: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputType, setInputType] = useState<'email' | 'calendar' | null>(null)

  const handleSelect = useCallback(async (type: 'email' | 'calendar', data: unknown) => {
    setInputType(type)
    setOutput(null)
    setToolCalls([])
    setError(null)
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span className="logo-icon">🧠</span>
          <h1>Research Agent</h1>
        </div>
        <p className="app-subtitle">
          Powered by <strong>Linkup</strong> + <strong>Vercel AI SDK</strong>
        </p>
      </header>

      <main className="app-main">
        <SourcePicker onSelect={handleSelect} disabled={loading} />
        <ResearchOutput
          output={output}
          toolCalls={toolCalls}
          loading={loading}
          error={error}
          inputType={inputType}
        />
      </main>
    </div>
  )
}

export default App
