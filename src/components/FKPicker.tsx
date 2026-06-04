import { useState, useEffect } from 'react'
import type { Table, ForeignKey } from '../types/schema'
import { tableColor } from '../utils/colors'

interface Props {
  tables: Table[]
  value: ForeignKey | undefined
  onChange: (fk: ForeignKey | undefined) => void
  onClose: () => void
}

export function FKPicker({ tables, value, onChange, onClose }: Props) {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTable) setSelectedTable(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedTable, onClose])

  const handlePickColumn = (table: Table, colName: string) => {
    onChange({ table: table.name, column: colName })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={() => selectedTable ? setSelectedTable(null) : onClose()}
    >
      <div
        className="rounded-2xl border border-white/10 shadow-2xl flex flex-col"
        style={{ background: '#1a1d27', width: 420, maxHeight: 520 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            {selectedTable && (
              <button
                onClick={() => setSelectedTable(null)}
                className="hover:bg-white/10 rounded-lg transition-colors p-1 mr-1"
                style={{ color: '#9ca3af', fontSize: 18, lineHeight: 1 }}
              >
                ←
              </button>
            )}
            <span className="text-white font-semibold text-sm">
              {selectedTable
                ? <><span style={{ color: tableColor(selectedTable.name) }}>{selectedTable.name}</span><span className="text-gray-500 ml-1">— pick column</span></>
                : 'Link foreign key'
              }
            </span>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/10 rounded-lg transition-colors"
            style={{ color: '#6b7280', fontSize: 22, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-2">
          {!selectedTable ? (
            <>
              {value && (
                <>
                  <button
                    onClick={() => { onChange(undefined); onClose() }}
                    className="w-full px-5 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-white/5 transition-colors"
                    style={{ color: '#f87171' }}
                  >
                    <span style={{ fontSize: 13 }}>✕</span>
                    <span>Clear link</span>
                    <span className="ml-auto font-mono text-xs opacity-40">{value.table}.{value.column}</span>
                  </button>
                  <div className="h-px mx-4 my-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
                </>
              )}
              {tables.map(tbl => (
                <button
                  key={tbl.name}
                  onClick={() => setSelectedTable(tbl)}
                  className="w-full px-5 py-3 text-left flex items-center justify-between hover:bg-white/5 transition-colors group"
                >
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{ color: tableColor(tbl.name) }}
                  >
                    {tbl.name}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[55%]">
                    {tbl.tags?.map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}
                      >
                        #{tag}
                      </span>
                    ))}
                    <span className="text-gray-600 group-hover:text-gray-400 transition-colors ml-1" style={{ fontSize: 14 }}>›</span>
                  </div>
                </button>
              ))}
            </>
          ) : (
            selectedTable.columns.map(col => {
              const isSelected = value?.table === selectedTable.name && value?.column === col.name
              return (
                <button
                  key={col.name}
                  onClick={() => handlePickColumn(selectedTable, col.name)}
                  className="w-full px-5 py-3 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{
                        borderColor: isSelected ? '#6366f1' : 'rgba(255,255,255,0.2)',
                        background: isSelected ? '#6366f1' : 'transparent',
                      }}
                    >
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                    </span>
                    <span className="font-mono text-sm text-white">{col.name}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: '#6b7280' }}>{col.type}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
