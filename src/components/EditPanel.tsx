import { useState } from 'react'
import type { Table, Column } from '../types/schema'

const COMMON_TYPES = [
  'integer', 'bigint', 'smallint', 'serial', 'bigserial',
  'varchar', 'text', 'char', 'uuid',
  'boolean',
  'float', 'double', 'decimal', 'numeric',
  'date', 'datetime', 'timestamp', 'time',
  'json', 'jsonb', 'binary', 'blob',
  'enum',
]

interface Props {
  table: Table
  onSave: (updated: Table) => void
  onClose: () => void
}

export function EditPanel({ table, onSave, onClose }: Props) {
  const [name, setName] = useState(table.name)
  const [columns, setColumns] = useState<Column[]>([...table.columns])
  const [newCol, setNewCol] = useState<Column>({ name: '', type: 'varchar', nullable: true })

  const updateCol = (i: number, patch: Partial<Column>) => {
    setColumns(cols => cols.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  }

  const deleteCol = (i: number) => {
    setColumns(cols => cols.filter((_, idx) => idx !== i))
  }

  const addCol = () => {
    if (!newCol.name.trim()) return
    setColumns(cols => [...cols, { ...newCol }])
    setNewCol({ name: '', type: 'varchar', nullable: true })
  }

  const save = () => onSave({ name, columns })

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-[#1a1d27] border-l border-white/10 flex flex-col z-50 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <input
          className="bg-transparent text-white font-semibold text-sm outline-none border-b border-transparent hover:border-white/30 focus:border-white/60 transition-colors"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
      </div>

      {/* Columns list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {columns.map((col, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-2.5 space-y-1.5">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-[#0f1117] text-white text-xs px-2 py-1 rounded outline-none border border-white/10 focus:border-white/30"
                value={col.name}
                onChange={e => updateCol(i, { name: e.target.value })}
                placeholder="column name"
              />
              <select
                className="bg-[#0f1117] text-white text-xs px-2 py-1 rounded outline-none border border-white/10 focus:border-white/30"
                value={col.type}
                onChange={e => updateCol(i, { type: e.target.value })}
              >
                {COMMON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                {!COMMON_TYPES.includes(col.type) && <option value={col.type}>{col.type}</option>}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                <input type="checkbox" checked={!!col.primaryKey} onChange={e => updateCol(i, { primaryKey: e.target.checked })} />
                PK
              </label>
              <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                <input type="checkbox" checked={!!col.nullable} onChange={e => updateCol(i, { nullable: e.target.checked })} />
                nullable
              </label>
              <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                <input type="checkbox" checked={!!col.unique} onChange={e => updateCol(i, { unique: e.target.checked })} />
                unique
              </label>
              <button onClick={() => deleteCol(i)} className="ml-auto text-red-500/60 hover:text-red-400 text-xs">✕</button>
            </div>
            {col.foreignKey && (
              <div className="text-[10px] text-yellow-500/70 font-mono">
                FK → {col.foreignKey.table}.{col.foreignKey.column}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add column */}
      <div className="px-3 py-3 border-t border-white/10 space-y-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Add column</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#0f1117] text-white text-xs px-2 py-1 rounded outline-none border border-white/10 focus:border-white/30"
            value={newCol.name}
            onChange={e => setNewCol(c => ({ ...c, name: e.target.value }))}
            placeholder="name"
            onKeyDown={e => e.key === 'Enter' && addCol()}
          />
          <select
            className="bg-[#0f1117] text-white text-xs px-2 py-1 rounded outline-none border border-white/10 focus:border-white/30"
            value={newCol.type}
            onChange={e => setNewCol(c => ({ ...c, type: e.target.value }))}
          >
            {COMMON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button
          onClick={addCol}
          className="w-full text-xs py-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Save */}
      <div className="px-3 pb-4">
        <button
          onClick={save}
          className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ background: '#6366f1' }}
        >
          Save changes
        </button>
      </div>
    </div>
  )
}
