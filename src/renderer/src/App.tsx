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

  const hasSelection = inputType !== null

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
        <div
          ref={contentRef}
          className={`content-area ${hasSelection ? 'has-selection' : ''}`}
        >
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
