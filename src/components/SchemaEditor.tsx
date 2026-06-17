import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { StreamLanguage } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { schemaToDSL, dslToSchema } from '../utils/schemaDSL'
import type { Schema } from '../types/schema'
import styles from './SchemaEditor.module.css'

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

interface Props {
  schema: Schema
  onSchemaChange: (schema: Schema) => void
  width?: number
}

export function SchemaEditor({ schema, onSchemaChange, width = 380 }: Props) {
  const fontSize = Math.max(11, Math.min(16, Math.round(13 * width / 380)))
  const schemaRef = useRef(schema)
  schemaRef.current = schema

  const [text, setText] = useState(() => schemaToDSL(schema))
  const [error, setError] = useState<string | null>(null)
  const isFocused = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorViewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [visibleCount, setVisibleCount] = useState(12)

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

  useEffect(() => { setSelectedIdx(0); setVisibleCount(12) }, [searchQuery])
  useEffect(() => { if (searchOpen) searchRef.current?.focus() }, [searchOpen])

  return (
    <div
      ref={containerRef}
      className={styles.root}
      onFocus={() => { isFocused.current = true }}
      onBlur={handleBlur}
    >
      <div className={styles.header}>
        <span className={styles.headerLabel}>Schema</span>

        <button
          onClick={() => setSearchOpen(o => !o)}
          title="Search table (Ctrl+F)"
          className={`${styles.searchBtn} ${searchOpen ? styles.searchBtnActive : ''}`}
        >
          <span>⌕</span>
          <span>Find table</span>
        </button>

        <span className={`${styles.statusIndicator} ${error ? styles.statusError : styles.statusOk}`}>
          {error ? `⚠ ${error}` : '✓'}
        </span>
      </div>

      {searchOpen && (
        <div className={styles.searchBar}>
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={`Search in ${tableNames.length} tables...`}
            className={styles.searchInput}
          />

          {searchResults.length > 0 && (
            <div className={styles.dropdown}>
              {searchResults.slice(0, visibleCount).map((name, i) => (
                <button
                  key={name}
                  onMouseDown={() => scrollToTable(name)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`${styles.dropdownItem} ${i === selectedIdx ? styles.dropdownItemSelected : ''}`}
                >
                  <span className={styles.dropdownItemTableLabel}>Table</span>
                  {name}
                </button>
              ))}
              {searchResults.length > visibleCount && (
                <div className={styles.dropdownFooter}>
                  <button
                    onMouseDown={e => { e.preventDefault(); setVisibleCount(c => c + 5) }}
                    className={styles.showMoreBtn}
                  >
                    Show +5
                  </button>
                  <span className={styles.showMoreLabel}>
                    +{searchResults.length - visibleCount} more...
                  </span>
                </div>
              )}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && (
            <div className={styles.noResults}>No table found</div>
          )}
        </div>
      )}

      <div className={styles.editorWrap}>
        <CodeMirror
          value={text}
          onChange={handleChange}
          onCreateEditor={view => { editorViewRef.current = view }}
          extensions={[schemaLang]}
          theme={oneDark}
          style={{ fontSize }}
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
