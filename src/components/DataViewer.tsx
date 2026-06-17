import { useState, useRef, useEffect, useMemo } from 'react'
import type { Schema } from '../types/schema'
import { tableColor } from '../utils/colors'
import { T, type Lang } from '../i18n'
import styles from './DataViewer.module.css'

const FONT_SIZES = [13, 14, 15, 16, 18, 20]
const DEFAULT_SIZE_IDX = 2

interface Props {
  schema: Schema
  lang: Lang
  onDataChange: (tableName: string, rows: Record<string, unknown>[]) => void
}

function EditableCell({
  value, rowH,
  onCommit,
}: {
  value: unknown
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
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false) }
        }}
        className={styles.cellInput}
      />
    )
  }

  return (
    <span
      onDoubleClick={() => { setDraft(display === 'null' ? '' : display); setEditing(true) }}
      title="Двойной клик для редактирования"
      className={styles.cellDisplay}
      style={{
        '--cell-color': isNull ? '#374151' : '#d1d5db',
        '--cell-style': isNull ? 'italic' : 'normal',
        '--cell-lh': `${rowH * 0.7}px`,
      } as React.CSSProperties}
    >
      {display}
    </span>
  )
}

export function DataViewer({ schema, lang, onDataChange }: Props) {
  const t = T[lang]
  const tableNames = useMemo(() => schema.tables.map(t => t.name), [schema.tables])
  const [selectedTable, setSelectedTable] = useState(tableNames[0] ?? '')
  const [sizeIdx, setSizeIdx] = useState(DEFAULT_SIZE_IDX)

  useEffect(() => {
    if (!tableNames.includes(selectedTable)) setSelectedTable(tableNames[0] ?? '')
  }, [tableNames, selectedTable])

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
    <div
      className={styles.root}
      style={{ '--fs': `${fontSize}px`, '--accent': accent } as React.CSSProperties}
    >
      {/* Left: table list */}
      <div className={styles.tableList}>
        <div className={styles.tableListHeader}>{t.dataTab}</div>
        <div className={styles.tableListBody}>
          {schema.tables.map(tbl => {
            const rowCount = schema.data?.[tbl.name]?.length ?? 0
            const color = tableColor(tbl.name)
            const active = tbl.name === selectedTable
            return (
              <button
                key={tbl.name}
                onClick={() => setSelectedTable(tbl.name)}
                className={styles.tableItem}
                style={{
                  '--item-color': color,
                  '--item-bg': active ? `${color}1a` : 'transparent',
                  '--item-border': active ? color : 'transparent',
                  '--item-weight': active ? 600 : 400,
                  '--item-name-color': active ? 'white' : '#9ca3af',
                } as React.CSSProperties}
              >
                <span className={styles.tableItemDot} />
                <span className={styles.tableItemName}>{tbl.name}</span>
                <span className={styles.tableItemCount}>{rowCount}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main */}
      <div className={styles.main}>
        <div
          className={styles.toolbar}
          style={{
            '--toolbar-bg': `${accent}18`,
            '--accent-btn-bg': `${accent}22`,
            '--accent-btn-border': `${accent}44`,
          } as React.CSSProperties}
        >
          <div className={styles.toolbarLeft}>
            <span className={styles.toolbarTableName}>{selectedTable}</span>
            <span className={styles.toolbarRowCount}>{t.rowCount(rows.length)}</span>
            <button onClick={addRow} className={styles.addRowBtn}>
              + {lang === 'ru' ? 'Добавить строку' : 'Add row'}
            </button>
          </div>
          <div className={styles.toolbarRight}>
            <span className={styles.fontSmall}>Aa</span>
            <input
              type="range"
              min={0}
              max={FONT_SIZES.length - 1}
              value={sizeIdx}
              onChange={e => setSizeIdx(Number(e.target.value))}
              className={styles.fontSizeSlider}
            />
            <span className={styles.fontSizeLabel}>{fontSize}px</span>
          </div>
        </div>

        {rows.length === 0 && allCols.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyText}>{t.noData}</span>
            <button onClick={addRow} className={styles.emptyAddBtn}>
              + {lang === 'ru' ? 'Добавить первую строку' : 'Add first row'}
            </button>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead className={styles.thead}>
                <tr>
                  <th className={styles.thIndex}>#</th>
                  {columns.map(col => (
                    <th key={col.name} className={styles.th}>
                      <div className={styles.thColHeader}>
                        <span className={styles.thColName}>{col.name}</span>
                        <span className={styles.thColType}>{col.type}</span>
                        {col.primaryKey && (
                          <span
                            className={styles.thColPk}
                            style={{ '--accent-badge-bg': `${accent}2a` } as React.CSSProperties}
                          >
                            PK
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  {extraCols.map(k => (
                    <th key={k} className={styles.thExtra}>{k}</th>
                  ))}
                  <th className={styles.thActions} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={styles.row}>
                    <td className={styles.tdIndex}>{i + 1}</td>
                    {allCols.map(colName => (
                      <td key={colName} className={styles.td}>
                        <EditableCell
                          value={row[colName]}
                          rowH={rowH}
                          onCommit={v => updateCell(i, colName, v)}
                        />
                      </td>
                    ))}
                    <td className={styles.tdActions}>
                      <button
                        onClick={() => deleteRow(i)}
                        title={lang === 'ru' ? 'Удалить строку' : 'Delete row'}
                        className={styles.deleteBtn}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={allCols.length + 2} className={styles.addRowInlineWrap}>
                    <button onClick={addRow} className={styles.addRowInlineBtn}>
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
