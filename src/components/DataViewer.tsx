import { useState, useRef, useEffect } from 'react'
import type { Schema } from '../types/schema'
import { tableColor } from '../utils/colors'
import { T, type Lang } from '../i18n'

const FONT_SIZES = [13, 14, 15, 16, 18, 20]
const DEFAULT_SIZE_IDX = 2

interface CellKey { row: number; col: string }

interface Props {
  schema: Schema
  lang: Lang
  onDataChange: (tableName: string, rows: Record<string, unknown>[]) => void
}

function EditableCell({
  value, fontSize, rowH,
  onCommit,
}: {
  value: unknown
  fontSize: number
  rowH: number
  onCommit: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => { setEditing(false); onCommit(draft) }

  const isNull = value === null || value === undefined
  const display = isNull ? 'null' : String(value)

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false) } }}
        style={{
          width: '100%', background: '#0f1117', color: 'white',
          border: '1px solid #6366f1', borderRadius: 6,
          padding: `2px 8px`, fontSize, fontFamily: 'monospace',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <span
      onDoubleClick={() => { setDraft(display === 'null' ? '' : display); setEditing(true) }}
      title="Двойной клик для редактирования"
      style={{
        display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: 280, cursor: 'text', borderRadius: 4, padding: '1px 4px',
        color: isNull ? '#374151' : '#d1d5db',
        fontStyle: isNull ? 'italic' : 'normal',
        fontSize, fontFamily: 'monospace',
        lineHeight: `${rowH * 0.7}px`,
      }}
    >
      {display}
    </span>
  )
}

export function DataViewer({ schema, lang, onDataChange }: Props) {
  const t = T[lang]
  const [selectedTable, setSelectedTable] = useState(schema.tables[0]?.name ?? '')
  const [sizeIdx, setSizeIdx] = useState(DEFAULT_SIZE_IDX)
  const fontSize = FONT_SIZES[sizeIdx]
  const rowH = Math.round(fontSize * 2.8)

  const table = schema.tables.find(tb => tb.name === selectedTable)
  const rows: Record<string, unknown>[] = (schema.data?.[selectedTable] ?? []).map(r => ({ ...r }))
  const columns = table?.columns ?? []
  const accent = selectedTable ? tableColor(selectedTable) : '#6366f1'
  const extraCols = Object.keys(rows[0] ?? {}).filter(k => !columns.find(c => c.name === k))
  const allCols = [...columns.map(c => c.name), ...extraCols]

  const updateCell = (rowIdx: number, colName: string, rawVal: string) => {
    const col = columns.find(c => c.name === colName)
    const isNumericType = col && /int|float|decimal|numeric|real|double|serial/i.test(col.type)

    const updated = rows.map((r, i) => {
      if (i !== rowIdx) return r
      let val: unknown
      if (rawVal === '' || rawVal.toLowerCase() === 'null') {
        val = null
      } else if (isNumericType) {
        const num = Number(rawVal)
        val = isNaN(num) ? rawVal : num
      } else {
        val = rawVal
      }
      return { ...r, [colName]: val }
    })
    onDataChange(selectedTable, updated)
  }

  const deleteRow = (rowIdx: number) => {
    onDataChange(selectedTable, rows.filter((_, i) => i !== rowIdx))
  }

  const addRow = () => {
    const empty: Record<string, unknown> = {}
    allCols.forEach(c => { empty[c] = null })
    onDataChange(selectedTable, [...rows, empty])
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0f1117', fontSize }}>

      {/* Left: table list */}
      <div style={{ width: 220, background: '#13151f', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px 8px', fontSize: fontSize - 2, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {t.dataTab}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {schema.tables.map(tbl => {
            const rowCount = schema.data?.[tbl.name]?.length ?? 0
            const color = tableColor(tbl.name)
            const active = tbl.name === selectedTable
            return (
              <button key={tbl.name} onClick={() => setSelectedTable(tbl.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: `${rowH * 0.3}px 16px`, textAlign: 'left', border: 'none',
                  background: active ? color + '1a' : 'transparent',
                  borderLeft: `3px solid ${active ? color : 'transparent'}`,
                  cursor: 'pointer', transition: 'background .15s',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize, color: active ? 'white' : '#9ca3af', fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tbl.name}
                </span>
                <span style={{ fontSize: fontSize - 2, color: '#4b5563' }}>{rowCount}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', minHeight: 48, background: accent + '18', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, color: accent, fontSize: fontSize + 1 }}>{selectedTable}</span>
            <span style={{ fontSize: fontSize - 2, color: '#6b7280' }}>{t.rowCount(rows.length)}</span>
            <button
              onClick={addRow}
              style={{ fontSize: fontSize - 1, fontWeight: 600, padding: '4px 12px', borderRadius: 8, background: accent + '22', color: accent, border: `1px solid ${accent}44`, cursor: 'pointer' }}
            >
              + {lang === 'ru' ? 'Добавить строку' : 'Add row'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: fontSize - 3, color: '#4b5563' }}>Aa</span>
            <input type="range" min={0} max={FONT_SIZES.length - 1} value={sizeIdx}
              onChange={e => setSizeIdx(Number(e.target.value))}
              style={{ width: 80, accentColor: '#6366f1', cursor: 'pointer' }} />
            <span style={{ fontSize: fontSize - 2, color: '#4b5563', minWidth: 32 }}>{fontSize}px</span>
          </div>
        </div>

        {rows.length === 0 && allCols.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
            <span style={{ color: '#4b5563', fontSize }}>{t.noData}</span>
            <button onClick={addRow} style={{ fontSize, fontWeight: 600, padding: '8px 20px', borderRadius: 10, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer' }}>
              + {lang === 'ru' ? 'Добавить первую строку' : 'Add first row'}
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize, minWidth: 'max-content' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#181b26' }}>
                <tr>
                  <th style={{ padding: `10px 14px`, color: '#374151', fontWeight: 400, fontSize: fontSize - 2, borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right', width: 44 }}>#</th>
                  {columns.map(col => (
                    <th key={col.name} style={{ padding: `10px 16px`, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: accent }}>{col.name}</span>
                        <span style={{ fontSize: fontSize - 3, color: '#4b5563', fontWeight: 400, textTransform: 'uppercase' }}>{col.type}</span>
                        {col.primaryKey && <span style={{ fontSize: fontSize - 4, padding: '1px 5px', borderRadius: 4, background: accent + '2a', color: accent, fontWeight: 700 }}>PK</span>}
                      </div>
                    </th>
                  ))}
                  {extraCols.map(k => (
                    <th key={k} style={{ padding: `10px 16px`, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</th>
                  ))}
                  <th style={{ padding: `10px 8px`, width: 36, borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="group" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: `${rowH * 0.2}px 14px`, color: '#374151', fontSize: fontSize - 2, textAlign: 'right', fontFamily: 'monospace', userSelect: 'none' }}>{i + 1}</td>
                    {allCols.map(colName => (
                      <td key={colName} style={{ padding: `${rowH * 0.15}px 16px` }}>
                        <EditableCell
                          value={row[colName]}
                          fontSize={fontSize}
                          rowH={rowH}
                          onCommit={v => updateCell(i, colName, v)}
                        />
                      </td>
                    ))}
                    <td style={{ padding: `${rowH * 0.2}px 8px`, textAlign: 'center' }}>
                      <button
                        onClick={() => deleteRow(i)}
                        title={lang === 'ru' ? 'Удалить строку' : 'Delete row'}
                        style={{ fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', opacity: 0, transition: 'opacity .15s', padding: '2px 4px', borderRadius: 4 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; (e.currentTarget as HTMLElement).style.color = '#4b5563' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Add row inline */}
                <tr>
                  <td colSpan={allCols.length + 2} style={{ padding: '8px 16px' }}>
                    <button onClick={addRow} style={{ fontSize: fontSize - 1, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', padding: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#6366f1')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
                    >
                      + {lang === 'ru' ? 'Добавить строку' : 'Add row'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
