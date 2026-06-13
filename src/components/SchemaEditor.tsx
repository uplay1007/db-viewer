import { useState, useEffect, useRef, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { StreamLanguage } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { schemaToDSL, dslToSchema } from '../utils/schemaDSL'
import type { Schema } from '../types/schema'

// ── Minimal DSL syntax highlighting ──────────────────────────────────────────

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

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0f17' }}
      onFocus={() => { isFocused.current = true }}
      onBlur={handleBlur}
    >
      {/* Header */}
      <div style={{
        padding: '10px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Schema
        </span>
        <span style={{ fontSize: 10, color: '#374151', fontFamily: 'monospace' }}>
          Table Name {'{'} col type [pk|unique|null|{'>'} ref.col] {'}'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: error ? '#ef4444' : '#22c55e' }}>
          {error ? `⚠ ${error}` : '✓'}
        </span>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <CodeMirror
          value={text}
          onChange={handleChange}
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
