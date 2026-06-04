import { useState, useRef, memo, useContext, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { tagColor } from '../utils/colors'
import { MultiSelectCtx } from './TableNode.multiselect'
import { HighlightCtx } from '../contexts/highlight'
import { ViewModeCtx } from '../contexts/viewMode'
import type { Table, Column } from '../types/schema'

export interface TableNodeData extends Record<string, unknown> {
  table: Table
  onEdit: (table: Table) => void
}

export { MultiSelectCtx }

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wide"
      style={{ background: color + '33', color }}
    >
      {label}
    </span>
  )
}

function ColumnRow({ col, accent }: { col: Column; accent: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 hover:bg-white/5 rounded">
      <span className="flex-1 text-xs text-gray-200 font-mono truncate">{col.name}</span>
      <span className="text-[10px] text-gray-500 font-mono">{col.type}</span>
      <div className="flex gap-1">
        {col.primaryKey && <Badge label="PK" color={accent} />}
        {col.foreignKey && <Badge label="FK" color="#f59e0b" />}
        {col.unique && !col.primaryKey && <Badge label="UQ" color="#06b6d4" />}
        {col.nullable && <Badge label="?" color="#6b7280" />}
      </div>
    </div>
  )
}

export const TableNode = memo(({ data, selected }: NodeProps) => {
  const { table, onEdit } = data as TableNodeData
  const [expanded, setExpanded] = useState(true)
  const multiSelectActive = useContext(MultiSelectCtx)
  const hl = useContext(HighlightCtx)
  const { mode: viewMode, bulkKey, bulkExpand } = useContext(ViewModeCtx)
  const accent = tagColor(table.tags)
  const lastAppliedKey = useRef(0)

  useEffect(() => {
    if (bulkKey > lastAppliedKey.current) {
      setExpanded(bulkExpand)
      lastAppliedKey.current = bulkKey
    }
  }, [bulkKey, bulkExpand])

  const isHighlighted = hl.active && hl.highlighted.has(table.name)
  const isDimmed = hl.active && !hl.highlighted.has(table.name)
  const isMultiSelected = multiSelectActive && selected

  // In collapsed mode: triangle still works (expanded overrides); multiSelect always hides
  const showColumns = isMultiSelected ? false : expanded

  // In compact mode, only show PK and FK columns
  const visibleColumns = viewMode === 'compact'
    ? table.columns.filter(c => c.primaryKey || c.foreignKey)
    : table.columns

  const handleHeaderClick = () => {
    if (hl.active) {
      // clicking any highlighted table → clear; clicking dimmed → focus it
      if (isHighlighted) hl.onClear()
      else hl.onHighlight(table.name)
    } else {
      hl.onHighlight(table.name)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl min-w-[220px] max-w-[300px]"
      style={{
        background: '#1a1d27',
        border: isMultiSelected
          ? `2px solid ${accent}`
          : isHighlighted
          ? `2px solid ${accent}`
          : '1px solid rgba(255,255,255,0.1)',
        boxShadow: isHighlighted
          ? `0 0 0 3px ${accent}55, 0 8px 32px rgba(0,0,0,0.6)`
          : isMultiSelected
          ? `0 0 0 2px ${accent}44`
          : undefined,
        opacity: isDimmed ? 0.15 : 1,
        transition: 'opacity .2s, box-shadow .15s, border .15s',
        pointerEvents: isDimmed ? 'none' : 'all',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: accent, border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: accent, border: 'none', width: 8, height: 8 }} />

      {/* Header — click = highlight */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        style={{ background: accent }}
        onClick={handleHeaderClick}
      >
        <span className="text-white font-semibold text-sm tracking-wide truncate">{table.name}</span>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          <span className="text-white/70 text-[10px]">{visibleColumns.length}{viewMode === 'compact' ? `/${table.columns.length}` : ''} cols</span>
          {!isMultiSelected && (
            <button
              className="text-white/70 hover:text-white text-[11px] px-1.5 py-0.5 rounded hover:bg-white/20 transition-colors font-medium"
              onClick={e => { e.stopPropagation(); onEdit(table) }}
              title="Edit table"
            >
              Edit
            </button>
          )}
          {/* Triangle — ONLY this toggles collapse */}
          <button
            className="text-white/70 hover:text-white text-xs px-1 rounded hover:bg-white/20 transition-colors"
            onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {showColumns ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Tags — show if present and not multi-selected */}
      {!isMultiSelected && table.tags && table.tags.length > 0 && (
        <div className="px-3 py-1.5 flex flex-wrap gap-1 bg-black/10 border-b border-white/5">
          {table.tags.map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Columns */}
      {showColumns && (
        <div className="py-1">
          {[
            ...visibleColumns.filter(c => c.primaryKey),
            ...visibleColumns.filter(c => c.foreignKey && !c.primaryKey),
            ...visibleColumns.filter(c => !c.primaryKey && !c.foreignKey),
          ].map(col => (
            <ColumnRow key={col.name} col={col} accent={accent} />
          ))}
        </div>
      )}
    </div>
  )
})
