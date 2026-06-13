import { useState, useEffect } from 'react'
import type { Table, Column, Schema } from '../types/schema'
import { tableColor, tagColor } from '../utils/colors'
import { T, type Lang } from '../i18n'
import { useDialog } from '../contexts/DialogContext'
import { FKPicker } from './FKPicker'

const COMMON_TYPES = [
  'integer', 'bigint', 'smallint', 'serial', 'bigserial',
  'varchar', 'text', 'char', 'uuid',
  'boolean',
  'float', 'double precision', 'decimal', 'numeric', 'real',
  'date', 'datetime', 'timestamp', 'timestamptz', 'time',
  'json', 'jsonb', 'binary', 'blob', 'bytea',
  'enum', 'array',
]

function emptyCol(): Column {
  return { name: '', type: 'varchar', nullable: true }
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-center rounded transition-all"
      style={{
        width: 20, height: 20, flexShrink: 0,
        background: checked ? '#6366f1' : 'transparent',
        border: `2px solid ${checked ? '#6366f1' : 'rgba(255,255,255,0.15)'}`,
      }}
    >
      {checked && (
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
          <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

interface Props {
  table: Table | null
  schema: Schema
  lang: Lang
  onSave: (updated: Table, originalName: string | null) => void
  onClose: () => void
}

export function TableEditor({ table, schema, lang, onSave, onClose }: Props) {
  const t = T[lang]
  const dialog = useDialog()
  const isNew = table === null
  const [name, setName] = useState(table?.name ?? '')
  const [columns, setColumns] = useState<Column[]>(
    table ? [...table.columns] : [{ name: 'id', type: 'integer', primaryKey: true, nullable: false }]
  )
  const [nameError, setNameError] = useState('')
  const [tags, setTags] = useState<string[]>(table?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [fkPickerRow, setFkPickerRow] = useState<number | null>(null)

  // Sync local state when table prop changes (guards against stale state if component isn't remounted)
  useEffect(() => {
    setName(table?.name ?? '')
    setColumns(table ? [...table.columns] : [{ name: 'id', type: 'integer', primaryKey: true, nullable: false }])
    setTags(table?.tags ?? [])
    setNameError('')
    setTagInput('')
    setIsDirty(false)
  }, [table])

  const handleClose = async () => {
    if (isDirty) {
      const ok = await dialog.confirm(
        lang === 'ru' ? 'Несохраненные изменения' : 'Unsaved changes',
        lang === 'ru' ? 'Выйти без сохранения изменений?' : 'Discard unsaved changes?'
      )
      if (!ok) return
    }
    onClose()
  }

  const accent = tagColor(tags.length > 0 ? tags : undefined)

  const updateCol = (i: number, patch: Partial<Column>) => {
    setColumns(cols => cols.map((c, idx) => idx === i ? { ...c, ...patch } : c))
    setIsDirty(true)
  }
  const deleteCol = (i: number) => {
    setColumns(cols => cols.filter((_, idx) => idx !== i))
    setIsDirty(true)
  }
  const moveUp = (i: number) => {
    if (i === 0) return
    setColumns(cols => { const n = [...cols]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n })
    setIsDirty(true)
  }
  const moveDown = (i: number) => {
    setColumns(cols => {
      if (i >= cols.length - 1) return cols
      const n = [...cols]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n
    })
    setIsDirty(true)
  }

  const save = () => {
    const trimmedName = name.trim()

    // Auto-add pending tag if user forgot Enter
    const finalTags = [...tags]
    const pendingTag = tagInput.trim().toLowerCase().replace(/\s+/g, '_')
    if (pendingTag && !finalTags.includes(pendingTag)) finalTags.push(pendingTag)

    if (!trimmedName) {
      setNameError(t.tableName + ' required')
      return
    }

    const nameConflict = schema.tables.find(tb => tb.name === trimmedName && tb.name !== table?.name)
    if (nameConflict) {
      setNameError('Already exists')
      return
    }

    onSave({ name: trimmedName, columns, tags: finalTags }, isNew ? null : table!.name)
  }

  const otherTables = schema.tables.filter(tb => tb.name !== (table?.name ?? ''))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="flex flex-col rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: '#1a1d27', width: 'min(95vw, 1100px)', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ background: accent, padding: '18px 28px' }}
        >
          <div className="flex items-center gap-4">
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: 500 }}>
              {isNew ? t.createTable : t.editTable}
            </span>
            <input
              className="bg-white/20 text-white font-bold rounded-xl outline-none placeholder-white/50 border border-transparent focus:border-white/40"
              style={{ fontSize: 20, padding: '6px 14px', minWidth: 200 }}
              value={name}
              onChange={e => { setName(e.target.value); setNameError(''); setIsDirty(true) }}
              placeholder="table_name"
              autoFocus={isNew}
            />
            {nameError && (
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, background: 'rgba(0,0,0,0.25)', padding: '3px 10px', borderRadius: 8 }}>
                {nameError}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            style={{ color: 'rgba(255,255,255,0.6)', fontSize: 28, lineHeight: 1, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
            className="hover:bg-white/20 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="border-collapse" style={{ width: '100%', tableLayout: 'fixed', fontSize: 15 }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#0f1117' }}>
                {[t.colName, t.type, 'PK', 'NN', 'UQ', 'AI', t.foreignKey, ''].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '14px 14px',
                      color: '#6b7280',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      textAlign: i >= 2 && i <= 5 ? 'center' : 'left',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  className="hover:bg-white/[0.03] transition-colors"
                >
                  {/* Name */}
                  <td style={{ padding: '10px 14px' }}>
                    <input
                      className="w-full outline-none border border-white/10 focus:border-white/30 font-mono rounded-lg transition-colors"
                      style={{ background: '#0f1117', color: 'white', fontSize: 15, padding: '8px 12px' }}
                      value={col.name}
                      onChange={e => updateCol(i, { name: e.target.value })}
                      placeholder="column_name"
                    />
                  </td>

                  {/* Type */}
                  <td style={{ padding: '10px 14px' }}>
                    <select
                      className="w-full outline-none border border-white/10 focus:border-white/30 rounded-lg cursor-pointer transition-colors"
                      style={{ background: '#0f1117', color: 'white', fontSize: 15, padding: '8px 12px' }}
                      value={COMMON_TYPES.includes(col.type) ? col.type : '__custom__'}
                      onChange={e => { if (e.target.value !== '__custom__') updateCol(i, { type: e.target.value }) }}
                    >
                      {COMMON_TYPES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                      {!COMMON_TYPES.includes(col.type) && <option value="__custom__">{col.type}</option>}
                    </select>
                  </td>

                  {/* PK */}
                  <td style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div className="flex justify-center">
                      <Checkbox checked={!!col.primaryKey} onChange={v => updateCol(i, { primaryKey: v, nullable: v ? false : col.nullable })} />
                    </div>
                  </td>

                  {/* NN */}
                  <td style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div className="flex justify-center">
                      <Checkbox checked={!col.nullable} onChange={v => updateCol(i, { nullable: !v })} />
                    </div>
                  </td>

                  {/* UQ */}
                  <td style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div className="flex justify-center">
                      <Checkbox checked={!!col.unique} onChange={v => updateCol(i, { unique: v })} />
                    </div>
                  </td>

                  {/* AI */}
                  <td style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div className="flex justify-center">
                      <Checkbox checked={col.type === 'serial' || col.type === 'bigserial'} onChange={v => updateCol(i, { type: v ? 'serial' : 'integer' })} />
                    </div>
                  </td>

                  {/* FK */}
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => setFkPickerRow(i)}
                      className="w-full rounded-lg border border-white/10 hover:border-yellow-500/40 transition-colors text-left flex items-center justify-between gap-2"
                      style={{ background: '#0f1117', padding: '8px 12px', fontSize: 13 }}
                    >
                      {col.foreignKey ? (
                        <>
                          <span className="font-mono truncate" style={{ color: tableColor(col.foreignKey.table) }}>
                            {col.foreignKey.table}
                          </span>
                          <span style={{ color: '#6b7280' }}>.</span>
                          <span className="font-mono truncate" style={{ color: '#e5e7eb' }}>
                            {col.foreignKey.column}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#4b5563' }}>Link →</span>
                      )}
                    </button>
                    {fkPickerRow === i && (
                      <FKPicker
                        tables={otherTables}
                        value={col.foreignKey}
                        onChange={fk => { updateCol(i, { foreignKey: fk }); setFkPickerRow(null) }}
                        onClose={() => setFkPickerRow(null)}
                      />
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '10px 14px' }}>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => moveUp(i)}
                        className="hover:bg-white/10 rounded transition-colors"
                        style={{ color: '#6b7280', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
                      <button onClick={() => moveDown(i)}
                        className="hover:bg-white/10 rounded transition-colors"
                        style={{ color: '#6b7280', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↓</button>
                      <button onClick={() => deleteCol(i)}
                        className="hover:bg-red-500/15 rounded transition-colors"
                        style={{ color: '#6b7280', fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add column */}
        <div style={{ padding: '14px 28px 6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => { setColumns(c => [...c, emptyCol()]); setIsDirty(true) }}
            className="hover:text-indigo-400 transition-colors flex items-center gap-2"
            style={{ color: '#6b7280', fontSize: 15 }}
          >
            {t.addColumn}
          </button>
        </div>

        {/* Tags */}
        <div style={{ padding: '10px 28px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 13, color: '#6b7280', marginRight: 4 }}>Tags:</span>
            {tags.map(tag => (
              <span key={tag} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                fontSize: 13, padding: '3px 10px', borderRadius: 20,
                border: '1px solid rgba(99,102,241,0.3)',
              }}>
                {tag}
                <button
                  onClick={() => { setTags(ts => ts.filter(t => t !== tag)); setIsDirty(true) }}
                  style={{ color: '#a5b4fc', fontSize: 14, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >×</button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                e.stopPropagation()
                const v = tagInput.trim().toLowerCase().replace(/\s+/g, '_')
                if (v && !tags.includes(v)) { setTags(ts => [...ts, v]); setIsDirty(true) }
                setTagInput('')
              }}
              placeholder="add tag…"
              style={{
                background: '#0f1117', color: 'white', fontSize: 13,
                padding: '4px 10px', borderRadius: 8, outline: 'none',
                border: '1px solid rgba(255,255,255,0.1)', width: 110,
              }}
            />
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                const v = tagInput.trim().toLowerCase().replace(/\s+/g, '_')
                if (v && !tags.includes(v)) { setTags(ts => [...ts, v]); setIsDirty(true) }
                setTagInput('')
              }}
              style={{
                background: 'rgba(99,102,241,0.2)', color: '#a5b4fc',
                fontSize: 13, padding: '4px 12px', borderRadius: 8,
                border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
              }}
            >+</button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: '4px 28px 10px', fontSize: 12, color: '#4b5563' }}>{t.legend}</div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-4 shrink-0"
          style={{ padding: '18px 28px', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <button
            onClick={handleClose}
            className="hover:text-white hover:bg-white/5 transition-colors rounded-xl"
            style={{ color: '#9ca3af', fontSize: 15, padding: '10px 22px' }}
          >
            {t.cancel}
          </button>
          <button
            onClick={save}
            className="font-semibold text-white rounded-xl transition-all hover:brightness-110 active:scale-95"
            style={{ background: accent, fontSize: 15, padding: '10px 28px' }}
          >
            {isNew ? t.create : t.save}
          </button>
        </div>
      </div>
    </div>
  )
}

