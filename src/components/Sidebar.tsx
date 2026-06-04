import { tagColor } from '../utils/colors'
import type { Table } from '../types/schema'
import { T, type Lang } from '../i18n'

export const SIDEBAR_W = 300

interface Props {
  tables: Table[]
  lang: Lang
  onLangToggle: () => void
  onNew: () => void
  onEdit: (table: Table) => void
  onDelete: (tableName: string) => void
  onExit: () => void
}

export function Sidebar({ tables, lang, onLangToggle, onNew, onEdit, onDelete, onExit }: Props) {
  const t = T[lang]

  return (
    <div
      className="flex flex-col border-r border-white/10 shrink-0"
      style={{ width: SIDEBAR_W, background: '#13151f' }}
    >
      {/* New table button */}
      <div className="px-5 pt-6 pb-4">
        <button
          onClick={onNew}
          className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-95"
          style={{ background: '#6366f1', fontSize: 15 }}
        >
          {t.newTable}
        </button>
      </div>

      {/* Table count info */}
      <div className="px-6 mb-4 flex items-center justify-between">
        <div style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Tables
        </div>
        <div className="text-gray-600 font-bold" style={{ fontSize: 11 }}>{tables.length}</div>
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-3">
        {tables.map(table => {
          const color = tagColor(table.tags)
          return (
            <div
              key={table.name}
              className="flex items-center gap-3 rounded-xl hover:bg-white/[0.06] group cursor-default transition-colors"
              style={{ padding: '10px 14px' }}
            >
              {/* Color dot */}
              <span
                className="rounded-full shrink-0"
                style={{ width: 10, height: 10, background: color, boxShadow: `0 0 6px ${color}88` }}
              />

              {/* Name and Tags */}
              <div className="flex-1 min-w-0 flex flex-col">
                <span
                  className="truncate cursor-pointer hover:text-white transition-colors"
                  style={{ color: '#d1d5db', fontSize: 15, fontWeight: 500 }}
                  onClick={() => onEdit(table)}
                >
                  {table.name}
                </span>
                {table.tags && table.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {table.tags.map(tag => (
                      <span key={tag} className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-400/80 border border-indigo-500/10">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Column count badge */}
              <span
                className="rounded-md shrink-0"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#6b7280',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '2px 7px',
                  minWidth: 26,
                  textAlign: 'center',
                }}
              >
                {table.columns.length}
              </span>

              {/* Actions — visible on hover */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => onEdit(table)}
                  className="rounded-lg transition-colors hover:bg-indigo-500/20"
                  style={{ fontSize: 15, padding: '2px 5px', color: '#6b7280' }}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => onDelete(table.name)}
                  className="rounded-lg transition-colors hover:bg-red-500/20"
                  style={{ fontSize: 15, padding: '2px 5px', color: '#6b7280' }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <button
          onClick={onExit}
          className="w-full py-2.5 rounded-xl font-medium transition-colors hover:bg-white/5 hover:text-white"
          style={{ fontSize: 14, color: '#6b7280', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {T[lang].exitBtn}
        </button>
      </div>
    </div>
  )
}
