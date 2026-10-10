import type { CompiledDiagram } from '@packagelab/idocs-core'
import type { CompileResult, RootInput } from '@packagelab/idocs-core/browser'
import { DiagramView } from '@packagelab/idocs-react'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Document } from 'yaml'
import { Builder } from './Builder'
import { examples } from './examples'
import { editSource, readModel, type Selection } from './model'
import './playground.css'
import '@packagelab/idocs-react/styles.css'

const STORAGE_KEY = 'idocs-playground-v1'
interface History {
  past: string[]
  present: string
  future: string[]
}
interface Props {
  iconsUrl: string
  starterIconsUrl: string
  formatUrl: string
}

export default function Playground({ iconsUrl, starterIconsUrl, formatUrl }: Props) {
  const [history, setHistory] = useState<History>({
    past: [],
    present: examples[0]!.text,
    future: [],
  })
  const source = history.present
  const [tab, setTab] = useState<'yaml' | 'builder'>('yaml')
  const [selection, setSelection] = useState<Selection>(null)
  const [result, setResult] = useState<CompileResult & { text: string }>({
    diagnostics: [],
    text: '',
  })
  const [diagram, setDiagram] = useState<CompiledDiagram | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  const [compilerError, setCompilerError] = useState<string | null>(null)
  const [example, setExample] = useState('starter')
  const workerRef = useRef<Worker | null>(null)
  const revision = useRef(0)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const numbersRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const lastTyping = useRef(0)
  const model = useMemo(() => readModel(source), [source])
  const pending = source !== result.text && !compilerError
  const errors = result.diagnostics.filter((d) => d.severity === 'error')
  const builderReady = !!model && (pending || !errors.length)

  const change = (text: string, typing = false) => {
    const now = Date.now()
    const merge = typing && now - lastTyping.current < 700
    lastTyping.current = typing ? now : 0
    setHistory((current) =>
      text === current.present
        ? current
        : {
            past: merge ? current.past : [...current.past, current.present].slice(-100),
            present: text,
            future: [],
          },
    )
    setSaved(false)
    setMessage('')
  }
  const undo = () => {
    lastTyping.current = 0
    setHistory((current) =>
      !current.past.length
        ? current
        : {
            past: current.past.slice(0, -1),
            present: current.past.at(-1)!,
            future: [current.present, ...current.future],
          },
    )
  }
  const redo = () => {
    lastTyping.current = 0
    setHistory((current) =>
      !current.future.length
        ? current
        : {
            past: [...current.past, current.present],
            present: current.future[0]!,
            future: current.future.slice(1),
          },
    )
  }

  useEffect(() => {
    try {
      const draft = localStorage.getItem(STORAGE_KEY)
      if (draft !== null) {
        setHistory({ past: [], present: draft, future: [] })
        setExample('custom')
      }
    } catch {
      /* Drafts still work in memory when storage is unavailable. */
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    setSaved(false)
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, source)
        setSaved(true)
      } catch {
        setSaved(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [source, loaded])

  useEffect(() => {
    const worker = new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = ({
      data,
    }: MessageEvent<CompileResult & { text: string; revision: number }>) => {
      if (data.revision !== revision.current) return
      setResult(data)
      if (data.diagram) setDiagram(data.diagram)
    }
    worker.onerror = () => {
      const error = 'The live compiler could not start. Reload the page to try again.'
      setCompilerError(error)
      setResult({
        text: '',
        diagnostics: [{ severity: 'error', file: 'diagram.yaml', message: error }],
      })
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    const current = ++revision.current
    const timer = setTimeout(
      () =>
        workerRef.current?.postMessage({
          revision: current,
          text: source,
          iconsUrl,
          starterIconsUrl,
        }),
      250,
    )
    return () => clearTimeout(timer)
  }, [source, iconsUrl, starterIconsUrl, loaded])

  useEffect(() => {
    if (!selection || !model) return
    const exists =
      selection.entity === 'edges'
        ? model.edges?.[Number(selection.id)]
        : model[selection.entity]?.[selection.id]
    if (!exists) setSelection(null)
  }, [model, selection])

  const edit = (action: (doc: Document, model: RootInput) => void) => {
    try {
      change(editSource(source, action))
      setExample('custom')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }
  const shortcut = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    if (event.key.toLowerCase() === 'y') {
      event.preventDefault()
      redo()
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source)
      setMessage('YAML copied to clipboard.')
    } catch {
      setMessage('Could not access the clipboard. Select and copy the YAML in the editor.')
    }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/yaml;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'diagram.yaml'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('Downloaded diagram.yaml.')
  }
  const lines = source.split('\n').length
  return (
    // Keyboard shortcuts apply to both the text editor and builder inputs.
    // biome-ignore lint/a11y/noStaticElementInteractions: bubbling keyboard shortcuts do not make the container interactive
    <div className="pg" onKeyDown={shortcut}>
      <div className="pg-toolbar">
        <label className="pg-example">
          Start from
          <select
            aria-label="Example diagram"
            value={example}
            onChange={(event) => {
              const chosen = examples.find((item) => item.id === event.target.value)
              if (!chosen) return
              change(chosen.text)
              setExample(chosen.id)
              setSelection(null)
            }}
          >
            <option value="custom" disabled>
              Your draft
            </option>
            {examples.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="pg-actions">
          <button
            type="button"
            className="pg-button"
            disabled={!history.past.length}
            onClick={undo}
            title="Ctrl/⌘ Z"
          >
            Undo
          </button>
          <button
            type="button"
            className="pg-button"
            disabled={!history.future.length}
            onClick={redo}
            title="Ctrl/⌘ Shift Z"
          >
            Redo
          </button>
          <span className="pg-divider" />
          <button type="button" className="pg-button" onClick={() => importRef.current?.click()}>
            Import YAML
          </button>
          <button type="button" className="pg-button" onClick={copy}>
            Copy YAML
          </button>
          <button type="button" className="pg-button pg-primary" onClick={download}>
            Download
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".yaml,.yml,.json,text/yaml,application/json"
            hidden
            aria-label="Import diagram file"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (file.size > 1_000_000) {
                setMessage('Choose a YAML file smaller than 1 MB.')
                return
              }
              try {
                change(await file.text())
                setExample('custom')
                setSelection(null)
              } catch {
                setMessage('Could not read that file. Please try again.')
              }
            }}
          />
        </div>
      </div>
      <div className="pg-workspace">
        <section className="pg-source" aria-label="Diagram editor">
          <div className="pg-panel-heading">
            <fieldset className="pg-segments" aria-label="Editor mode">
              <button type="button" aria-pressed={tab === 'yaml'} onClick={() => setTab('yaml')}>
                YAML
              </button>
              <button
                type="button"
                aria-pressed={tab === 'builder'}
                onClick={() => setTab('builder')}
              >
                Visual builder
              </button>
            </fieldset>
            <a href={formatUrl} target="_blank" rel="noreferrer">
              Syntax guide ↗
            </a>
          </div>
          {tab === 'yaml' ? (
            <div className="pg-code">
              <div className="pg-line-numbers" ref={numbersRef} aria-hidden="true">
                {Array.from({ length: lines }, (_, index) => index + 1).map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
              <textarea
                ref={editorRef}
                className="pg-editor"
                aria-label="Diagram YAML"
                value={source}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                wrap="off"
                onChange={(event) => {
                  change(event.target.value, true)
                  setExample('custom')
                }}
                onScroll={(event) => {
                  if (numbersRef.current)
                    numbersRef.current.scrollTop = event.currentTarget.scrollTop
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Tab' || event.shiftKey) return
                  event.preventDefault()
                  const { selectionStart: start, selectionEnd: end } = event.currentTarget
                  change(`${source.slice(0, start)}  ${source.slice(end)}`, true)
                  requestAnimationFrame(() =>
                    editorRef.current?.setSelectionRange(start + 2, start + 2),
                  )
                }}
              />
            </div>
          ) : (
            <div className="pg-builder-scroll">
              {builderReady && model ? (
                <Builder
                  model={model}
                  selection={selection}
                  onSelect={setSelection}
                  onEdit={edit}
                />
              ) : (
                <div className="pg-empty">
                  <strong>Fix the YAML to continue building</strong>
                  <p>
                    The visual builder needs a valid diagram. Your draft and last valid preview are
                    still here.
                  </p>
                  <button type="button" className="pg-button" onClick={() => setTab('yaml')}>
                    Open YAML editor
                  </button>
                </div>
              )}
              <details className="pg-generated">
                <summary>Generated YAML</summary>
                <pre>{source}</pre>
              </details>
            </div>
          )}
          <div className="pg-editor-footer">
            <span>{lines} lines · diagram.yaml</span>
            <span>{saved ? 'Draft saved in this browser' : 'Local draft'}</span>
          </div>
        </section>
        <section className="pg-preview" aria-label="Live diagram preview">
          <div className="pg-panel-heading">
            <strong>Live preview</strong>
            <span
              className={`pg-status ${!pending && errors.length ? 'pg-status-error' : ''}`}
              role="status"
            >
              {pending ? 'Updating…' : errors.length ? 'Needs a fix' : '● Up to date'}
            </span>
          </div>
          <div className="pg-preview-body">
            {!pending && errors.length > 0 && diagram && (
              <p className="pg-preview-notice">
                Showing the last valid diagram. Fix the errors below to update it.
              </p>
            )}
            {diagram && Object.keys(diagram.nodes).length ? (
              <DiagramView
                diagram={diagram}
                hash={false}
                showTitle
                maxHeight={640}
                selectedNode={selection?.entity === 'nodes' ? selection.id : null}
                onNodeSelect={(id) => {
                  if (model?.nodes[id]) {
                    setSelection({ entity: 'nodes', id })
                    setTab('builder')
                  }
                }}
              />
            ) : (
              <div className="pg-empty">
                <span className="pg-empty-symbol" aria-hidden="true">
                  ◇
                </span>
                <strong>
                  {diagram
                    ? 'Your canvas is ready'
                    : pending
                      ? 'Preparing your diagram…'
                      : 'Start with a valid diagram'}
                </strong>
                <p>
                  {diagram
                    ? 'Add a node in the visual builder, or write one in YAML.'
                    : 'Write YAML on the left and watch your diagram appear here.'}
                </p>
              </div>
            )}
          </div>
          <p className="pg-preview-footer">
            Click a node to edit · Drag to pan · Ctrl / ⌘ + scroll to zoom
          </p>
        </section>
      </div>
      {message && (
        <div className="pg-message" role="status">
          <span>{message}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
      {!pending && result.diagnostics.length > 0 && (
        <section className="pg-diagnostics" aria-label="Diagram diagnostics" aria-live="polite">
          {result.diagnostics.map((diagnostic) => (
            <div
              key={`${diagnostic.path}-${diagnostic.line}-${diagnostic.col}-${diagnostic.message}`}
              className={`pg-diagnostic pg-${diagnostic.severity}`}
            >
              <strong>{diagnostic.severity === 'error' ? 'Error' : 'Warning'}</strong>
              {diagnostic.line && (
                <button
                  type="button"
                  className="pg-diagnostic-location"
                  onClick={() => {
                    setTab('yaml')
                    requestAnimationFrame(() => {
                      const editor = editorRef.current
                      if (!editor) return
                      const start =
                        source
                          .split('\n')
                          .slice(0, diagnostic.line! - 1)
                          .reduce((length, line) => length + line.length + 1, 0) +
                        (diagnostic.col ?? 1) -
                        1
                      editor.focus()
                      editor.setSelectionRange(start, start)
                      editor.scrollTop = Math.max(0, (diagnostic.line! - 4) * 22)
                      if (numbersRef.current) numbersRef.current.scrollTop = editor.scrollTop
                    })
                  }}
                >
                  Line {diagnostic.line}
                  {diagnostic.col ? `:${diagnostic.col}` : ''}
                </button>
              )}
              <span>
                {diagnostic.message}
                {diagnostic.hint && <small>{diagnostic.hint}</small>}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
