import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { StreamLanguage } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { schemaToDSL, dslToSchema } from '../utils/schemaDSL'
import type { Schema } from '../types/schema'

// ── DSL syntax highlighting ───────────────────────────────────────────────────

const KEYWORDS = new Set(['Table'])
const MODIFIERS = new Set(['pk', 'unique', 'null'])

const schemaLang = StreamLanguage.define<Record<string, never>>({
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.match(/\/\/[^\n]*/)) return 'comment'
    if (stream.match(/--[^\n]*/)) return 'comment'
    if (stream.eat('{') || stream.eat('}')) return 'bracket'
    if (stream.eat('>')) return 'operator'
    if (stream.match(/[\w]+(?:\([^)]*\))?(?:\.\w+)*/)) {
      const w = stream.current()
      if (KEYWORDS.has(w)) return 'keyword'
      if (MODIFIERS.has(w)) return 'typeName'
      return null
    }
    stream.next()
    return null
  },
  blankLine() {},
  copyState: s => ({ ...s }),
  indent: () => null,
  languageData: {},
  tokenTable: {},
})

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  schema: Schema
  onSchemaChange: (schema: Schema) => void
}

export function SchemaEditor({ schema, onSchemaChange }: Props) {
  const schemaRef = useRef(schema)
  schemaRef.current = schema

  const [text, setText] = useState(() => schemaToDSL(schema))
  const [error, setError] = useState<string | null>(null)
  const isFocused = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorViewRef = useRef<EditorView | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [visibleCount, setVisibleCount] = useState(12)

  // Push external schema changes into editor when not focused
  useEffect(() => {
    if (!isFocused.current) {
      setText(schemaToDSL(schema))
      setError(null)
    }
  }, [schema])

  const handleChange = useCallback((value: string) => {
    setText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        const parsed = dslToSchema(value, schemaRef.current)
        setError(null)
        onSchemaChange(parsed)
      } catch (e) {
        setError((e as Error).message)
      }
    }, 400)
  }, [onSchemaChange])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      isFocused.current = false
      if (!error) setText(schemaToDSL(schemaRef.current))
    }
  }, [error])

  // ── Search ────────────────────────────────────────────────────────────────

  const tableNames = useMemo(
    () => schema.tables.map(t => t.name),
    [schema.tables]
  )

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return tableNames
    const q = searchQuery.toLowerCase()
    return tableNames.filter(n => n.toLowerCase().includes(q))
  }, [searchQuery, tableNames])

  const scrollToTable = useCallback((name: string) => {
    const view = editorViewRef.current
    if (!view) return

    const doc = view.state.doc.toString()
    const re = new RegExp(`^Table\\s+${name}\\s*\\{`, 'm')
    const match = re.exec(doc)
    if (!match) return

    view.dispatch({
      selection: { anchor: match.index },
      effects: EditorView.scrollIntoView(match.index, { y: 'start', yMargin: 24 }),
    })
    view.focus()
    setSearchOpen(false)
    setSearchQuery('')
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, searchResults.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && searchResults[selectedIdx]) scrollToTable(searchResults[selectedIdx])
  }, [searchResults, selectedIdx, scrollToTable])

  // Reset selection and visible count when query changes
  useEffect(() => { setSelectedIdx(0); setVisibleCount(12) }, [searchQuery])

  // Focus search input when opened
  useEffect(() => { if (searchOpen) searchRef.current?.focus() }, [searchOpen])

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0f17' }}
      onFocus={() => { isFocused.current = true }}
      onBlur={handleBlur}
    >
      {/* Header */}
      <div style={{
        padding: '8px 12px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Schema
        </span>

        {/* Search toggle */}
        <button
          onClick={() => setSearchOpen(o => !o)}
          title="Search table (Ctrl+F)"
          style={{
            marginLeft: 4,
            background: searchOpen ? 'rgba(99,102,241,0.2)' : 'transparent',
            border: `1px solid ${searchOpen ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6, color: searchOpen ? '#818cf8' : '#4b5563',
            cursor: 'pointer', padding: '3px 8px', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
          }}
        >
          <span>⌕</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>Find table</span>
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: error ? '#ef4444' : '#22c55e' }}>
          {error ? `⚠ ${error}` : '✓'}
        </span>
      </div>

      {/* Search bar (collapsible) */}
      {searchOpen && (
        <div style={{
          padding: '6px 12px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#0a0c14', position: 'relative',
        }}>
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={`Search in ${tableNames.length} tables...`}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
              color: '#e5e7eb', padding: '6px 10px', fontSize: 12,
              outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
            }}
          />

          {/* Results dropdown */}
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 12, right: 12,
              background: '#13151f', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, zIndex: 100, overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              maxHeight: 220, overflowY: 'auto',
            }}>
              {searchResults.slice(0, visibleCount).map((name, i) => (
                <button
                  key={name}
                  onMouseDown={() => scrollToTable(name)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '7px 12px',
                    background: i === selectedIdx ? 'rgba(99,102,241,0.15)' : 'transparent',
                    border: 'none', cursor: 'pointer', color: i === selectedIdx ? '#818cf8' : '#9ca3af',
                    fontSize: 12, fontFamily: 'monospace', display: 'block',
                    borderLeft: i === selectedIdx ? '2px solid #6366f1' : '2px solid transparent',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span style={{ color: '#4b5563', marginRight: 6, fontSize: 10 }}>Table</span>
                  {name}
                </button>
              ))}
              {searchResults.length > visibleCount && (
                <div style={{ padding: '5px 12px 7px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <button
                    onMouseDown={e => { e.preventDefault(); setVisibleCount(c => c + 5) }}
                    style={{
                      background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                      borderRadius: 4, color: '#818cf8', cursor: 'pointer', fontSize: 10,
                      fontWeight: 600, padding: '2px 8px',
                    }}
                  >
                    Show +5
                  </button>
                  <span style={{ fontSize: 10, color: '#374151' }}>
                    +{searchResults.length - visibleCount} more...
                  </span>
                </div>
              )}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 12, right: 12,
              background: '#13151f', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#4b5563',
              zIndex: 100,
            }}>
              No table found
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <CodeMirror
          value={text}
          onChange={handleChange}
          onCreateEditor={view => { editorViewRef.current = view }}
          extensions={[schemaLang]}
          theme={oneDark}
          style={{ fontSize: 13 }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            bracketMatching: true,
            closeBrackets: false,
            autocompletion: false,
            highlightActiveLine: true,
          }}
        />
      </div>
    </div>
  )
}
