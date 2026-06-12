import { useState, useEffect, useRef, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Schema } from '../types/schema'

interface Props {
  schema: Schema
  onSchemaChange: (schema: Schema) => void
}

export function SchemaEditor({ schema, onSchemaChange }: Props) {
  const [text, setText] = useState(() => JSON.stringify(schema, null, 2))
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isFocused = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Push schema changes (from visual edits) into editor when not focused
  useEffect(() => {
    if (!isFocused.current) {
      setText(JSON.stringify(schema, null, 2))
      setError(null)
    }
  }, [schema])

  const handleChange = useCallback((value: string) => {
    setText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(value) as Schema
        if (parsed && Array.isArray(parsed.tables)) {
          setError(null)
          onSchemaChange(parsed)
        } else {
          setError('"tables" array required')
        }
      } catch (e) {
        setError((e as Error).message)
      }
    }, 400)
  }, [onSchemaChange])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      isFocused.current = false
      // Re-format to canonical JSON on blur (if valid)
      if (!error) setText(JSON.stringify(schema, null, 2))
    }
  }, [error, schema])

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0f17' }}
      onFocus={() => { isFocused.current = true }}
      onBlur={handleBlur}
    >
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Schema JSON
        </span>
        {error ? (
          <span style={{
            fontSize: 11, color: '#ef4444', fontFamily: 'monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            ⚠ {error}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✓ valid</span>
        )}
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <CodeMirror
          value={text}
          onChange={handleChange}
          extensions={[json()]}
          theme={oneDark}
          style={{ fontSize: 12, minHeight: '100%' }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
          }}
        />
      </div>
    </div>
  )
}
