import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
  type NodeChange,
  applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { Schema, Table } from './types/schema'
import { computeLayout } from './utils/layout'
import { tableColor } from './utils/colors'
import {
  saveCurrentSession, loadCurrentSession,
  saveDB, getSaves,
} from './utils/storage'
import { TableNode, type TableNodeData, MultiSelectCtx } from './components/TableNode'
import { HighlightCtx, type HighlightCtxValue } from './contexts/highlight'
import { ViewModeCtx, type ViewMode, type ViewModeCtxValue } from './contexts/viewMode'
import { OrthoEdge, type OrthoEdgeData } from './components/OrthoEdge'
import { computeELKLayout } from './services/layoutService'
import { TableEditor } from './components/TableEditor'
import { Sidebar, SIDEBAR_W } from './components/Sidebar'
import { DataViewer } from './components/DataViewer'
import { UploadZone, type OpenResult } from './components/UploadZone'
import { writeToHandle } from './utils/fileAccess'
import { exportSQL } from './utils/parsers/sql'
import { T, type Lang } from './i18n'
import { DialogProvider, useDialog } from './contexts/DialogContext'

const NODE_TYPES = { table: TableNode }
const EDGE_TYPES = { fk: OrthoEdge }
const TAB_H = 58

function schemaToFlow(
  schema: Schema,
  onEdit: (t: Table) => void,
  savedPositions?: Record<string, { x: number; y: number }>,
  existingNodes?: Node[]
): { nodes: Node[]; edges: Edge[] } {
  const existingMap = Object.fromEntries((existingNodes ?? []).map(n => [n.id, n.position]))

  const tablesNeedingLayout = schema.tables.filter(t =>
    !existingMap[t.name] && !savedPositions?.[t.name]
  )
  const layoutMap = tablesNeedingLayout.length > 0
    ? Object.fromEntries(
        computeLayout({ tables: tablesNeedingLayout, data: schema.data })
          .map(p => [p.id, { x: p.x, y: p.y }])
      )
    : {}

  const nodes: Node[] = schema.tables.map(table => ({
    id: table.name,
    type: 'table',
    position:
      existingMap[table.name] ??
      savedPositions?.[table.name] ??
      layoutMap[table.name] ??
      { x: 0, y: 0 },
    data: { table, onEdit } satisfies TableNodeData,
  }))

  const edges: Edge[] = []
  const seen = new Set<string>()
  for (const table of schema.tables) {
    for (const col of table.columns) {
      if (!col.foreignKey) continue
      const target = col.foreignKey.table
      if (!schema.tables.find(t => t.name === target)) continue
      const key = `${table.name}-${target}-${col.name}`
      if (seen.has(key)) continue
      seen.add(key)
      const color = tableColor(table.name)
      edges.push({
        id: key, source: table.name, target,
        type: 'fk',
        data: { label: `${col.name} → ${col.foreignKey.column}`, color } satisfies OrthoEdgeData,
      })
    }
  }
  return { nodes, edges }
}

type EditorState = null | 'new' | string
type Tab = 'schema' | 'data'

function exportJSON(schema: Schema) {
  const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'schema.json'
  a.click()
  URL.revokeObjectURL(url)
}

function downloadSQL(schema: Schema) {
  const sql = exportSQL(schema)
  const blob = new Blob([sql], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'schema.sql'
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  return (
    <DialogProvider lang={lang}>
      <AppContent lang={lang} setLang={setLang} />
    </DialogProvider>
  )
}

function AppContent({ lang, setLang }: { lang: Lang; setLang: React.Dispatch<React.SetStateAction<Lang>> }) {
  const session = useMemo(() => loadCurrentSession(), [])
  const dialog = useDialog()

  const [schema, setSchema] = useState<Schema | null>(session?.schema ?? null)
  const [currentSaveId, setCurrentSaveId] = useState<string | undefined>(session?.saveId)
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null)
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const nodesRef = useRef<Node[]>([])
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  
  // MASTER POSITIONS: The source of truth for "All Groups" view
  const masterPositionsRef = useRef<Record<string, { x: number; y: number }>>(session?.positions ?? {})

  const [editorState, setEditorState] = useState<EditorState>(null)
  const [activeTab, setActiveTab] = useState<Tab>('schema')
  const [saveFlash, setSaveFlash] = useState(false)

  const rfInstanceRef = useRef<ReactFlowInstance | null>(null)
  const groupsBtnRef = useRef<HTMLDivElement>(null)

  const [canvasMode, setCanvasMode] = useState<'pan' | 'select'>('pan')
  const [viewMode, setViewMode] = useState<ViewMode>('full')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [bulkExpand, setBulkExpand] = useState(true)
  const [bulkKey, setBulkKey] = useState(0)

  const handleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    setBulkExpand(mode !== 'collapsed')
    setBulkKey(k => k + 1)
  }, [])

  const [multiSelectActive, setMultiSelectActive] = useState(false)
  const [highlightTable, setHighlightTable] = useState<string | null>(null)
  const [layouting, setLayouting] = useState(false)
  const [pendingELK, setPendingELK] = useState(false)

  // Filter nodes/edges by active tag
  const displayNodes = useMemo(() => {
    if (!tagFilter || !schema) {
      // In All Groups mode, strictly use masterPositionsRef
      return nodes.map(n => ({ 
        ...n, 
        hidden: false,
        position: masterPositionsRef.current[n.id] ?? n.position 
      }))
    }
    const visible = new Set(schema.tables.filter(t => t.tags?.includes(tagFilter)).map(t => t.name))
    return nodes.map(n => ({ ...n, hidden: !visible.has(n.id) }))
  }, [nodes, tagFilter, schema])

  const displayEdges = useMemo(() => {
    if (!tagFilter || !schema) return edges
    const visibleNames = new Set(schema.tables.filter(t => t.tags?.includes(tagFilter)).map(t => t.name))
    return edges.filter(e => visibleNames.has(e.source) && visibleNames.has(e.target))
  }, [edges, tagFilter, schema])

  const handleSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setMultiSelectActive(sel.length > 1)
  }, [])

  const allTags = useMemo(() => {
    if (!schema) return []
    const counts: Record<string, number> = {}
    for (const t of schema.tables) {
      for (const tag of (t.tags ?? [])) counts[tag] = (counts[tag] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }))
  }, [schema])

  useEffect(() => {
    if (!groupsOpen) return
    const handler = (e: MouseEvent) => {
      if (!groupsBtnRef.current?.contains(e.target as globalThis.Node)) setGroupsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [groupsOpen])

  // CRITICAL: Hybrid layout logic
  useEffect(() => {
    if (!schema) return
    setHighlightTable(null)

    if (!tagFilter) {
      // MODE A: All Groups -> Restore master positions
      if (Object.keys(masterPositionsRef.current).length > 0) {
        setNodes(prev => prev.map(n => ({
          ...n,
          position: masterPositionsRef.current[n.id] ?? n.position,
        })))
      }
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.2, duration: 400 }), 50)
      return
    }

    // MODE B: Specific Group -> Run ELK for compactness
    const visibleNames = new Set(schema.tables.filter(t => t.tags?.includes(tagFilter)).map(t => t.name))
    if (visibleNames.size === 0) return

    const heights: Record<string, number> = {}
    nodesRef.current.forEach(n => {
      const h = (n.measured as { height?: number } | undefined)?.height
      if (h) heights[n.id] = h
    })

    computeELKLayout(schema, heights, visibleNames).then(({ positions }) => {
      setNodes(prev => prev.map(n =>
        positions[n.id] ? { ...n, position: positions[n.id] } : n
      ))
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.2, duration: 400 }), 50)
    })
  }, [tagFilter, schema, setNodes])

  const highlightCtxValue = useMemo((): HighlightCtxValue => {
    if (!highlightTable || !schema) {
      return { active: false, highlighted: new Set(), focusTable: null, onHighlight: setHighlightTable, onClear: () => setHighlightTable(null) }
    }
    const set = new Set<string>([highlightTable])
    for (const t of schema.tables) {
      for (const col of t.columns) {
        if (!col.foreignKey) continue
        if (t.name === highlightTable) set.add(col.foreignKey.table)
        if (col.foreignKey.table === highlightTable) set.add(t.name)
      }
    }
    return {
      active: true, highlighted: set, focusTable: highlightTable, onHighlight: setHighlightTable, onClear: () => setHighlightTable(null),
    }
  }, [highlightTable, schema])

  const handleLayout = useCallback(async () => {
    if (!schema || layouting) return
    setLayouting(true)
    try {
      const heights: Record<string, number> = {}
      nodesRef.current.forEach(n => {
        const h = (n.measured as { height?: number } | undefined)?.height
        if (h) heights[n.id] = h
      })
      const { positions } = await computeELKLayout(schema, heights)
      
      // If we are in "All Groups" mode, update master positions
      if (!tagFilter) {
        masterPositionsRef.current = { ...positions }
      }

      setNodes(prev => prev.map(n => ({
        ...n,
        position: positions[n.id] ?? n.position,
      })))
    } catch (err) {
      console.error('ELK layout failed:', err)
    } finally {
      setLayouting(false)
    }
  }, [schema, layouting, setNodes, tagFilter])

  useEffect(() => {
    if (!pendingELK || layouting || nodes.length === 0) return
    const visibleNodes = tagFilter && schema
      ? nodes.filter(n => schema.tables.find(t => t.name === n.id)?.tags?.includes(tagFilter))
      : nodes
    if (visibleNodes.length === 0) return
    const measuredCount = visibleNodes.filter(n => (n.measured as { height?: number } | undefined)?.height).length
    if (measuredCount < Math.ceil(visibleNodes.length / 2)) return
    setPendingELK(false)
    handleLayout()
  }, [pendingELK, nodes, layouting, handleLayout, tagFilter, schema])

  // Custom onNodesChange to track manual dragging into Master Positions
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    
    // Only sync to master positions if NOT in a filtered group view
    if (!tagFilter) {
      changes.forEach(c => {
        if (c.type === 'position' && c.position) {
          masterPositionsRef.current[c.id] = c.position
        }
      })
    }
  }, [onNodesChange, tagFilter])

  const groupDragOrigins = useRef<Record<string, { x: number; y: number }>>({})

  const handleNodeDragStart = useCallback((_e: MouseEvent | TouchEvent, node: Node) => {
    if (!highlightCtxValue.highlighted.has(node.id)) return
    groupDragOrigins.current = Object.fromEntries(
      nodes
        .filter(n => highlightCtxValue.highlighted.has(n.id))
        .map(n => [n.id, { x: n.position.x, y: n.position.y }])
    )
  }, [highlightCtxValue.highlighted, nodes])

  const handleNodeDrag = useCallback((_e: MouseEvent | TouchEvent, node: Node) => {
    const isMasterMode = !tagFilter
    const isHighlighted = highlightCtxValue.highlighted.has(node.id)
    
    if (isMasterMode) {
      masterPositionsRef.current[node.id] = { x: node.position.x, y: node.position.y }
    }

    if (!isHighlighted) return
    const origin = groupDragOrigins.current[node.id]
    if (!origin) return
    const dx = node.position.x - origin.x
    const dy = node.position.y - origin.y
    setNodes(prev => prev.map(n => {
      if (n.id === node.id) return n
      if (!highlightCtxValue.highlighted.has(n.id)) return n
      const o = groupDragOrigins.current[n.id]
      if (!o) return n
      const newPos = { x: o.x + dx, y: o.y + dy }
      if (isMasterMode) masterPositionsRef.current[n.id] = newPos
      return { ...n, position: newPos }
    }))
  }, [highlightCtxValue.highlighted, setNodes, tagFilter])

  const t = T[lang]
  const handleEdit = useCallback((table: Table) => setEditorState(table.name), [])

  const applySchema = useCallback((
    s: Schema,
    currentNodes?: Node[],
    initialSavedPos?: Record<string, { x: number; y: number }>
  ) => {
    const schemaToUse = { ...s, tables: s.tables.map(t => t.tags !== undefined ? t : { ...t, tags: [] }) }

    if (initialSavedPos) {
      masterPositionsRef.current = { ...initialSavedPos }
    }

    setSchema(schemaToUse)
    saveCurrentSession({ schema: schemaToUse, positions: masterPositionsRef.current })
    const { nodes: n, edges: e } = schemaToFlow(schemaToUse, handleEdit, masterPositionsRef.current, currentNodes)
    setNodes(n)
    setEdges(e)
  }, [handleEdit, setNodes, setEdges])

  useEffect(() => {
    if (session) {
      applySchema(session.schema, undefined, session.positions)
      const hasPositions = session.positions && Object.keys(session.positions).length > 0
      if (!hasPositions) {
        setTimeout(() => setPendingELK(true), 250)
      }
    }
  }, [session, applySchema])

  useEffect(() => {
    if (nodes.length === 0 || !schema) return
    const handle = setTimeout(() => {
      saveCurrentSession({ schema, positions: masterPositionsRef.current })
    }, 1000)
    return () => clearTimeout(handle)
  }, [nodes, schema])

  const handleSave = useCallback(async () => {
    if (!schema) return
    const posMap = { ...masterPositionsRef.current }

    if (fileHandle) {
      try {
        const isSql = fileHandle.name.endsWith('.sql')
        const content = isSql ? exportSQL(schema) : JSON.stringify(schema, null, 2)
        await writeToHandle(fileHandle, content)
      } catch (e) {
        console.warn('File write failed, falling back to download', e)
        downloadSQL(schema)
      }
    }

    if (currentSaveId) {
      saveDB(getSaves().find(s => s.id === currentSaveId)?.name ?? 'schema', schema, posMap, currentSaveId)
    } else if (!fileHandle) {
      const defaultName = schema.tables.map(tb => tb.name).slice(0, 2).join(', ') + (schema.tables.length > 2 ? '…' : '')
      const name = await dialog.prompt(lang === 'ru' ? 'Название сохранения' : 'Save name', t.saveNamePrompt, defaultName)
      if (!name) return
      const saved = saveDB(name, schema, posMap)
      setCurrentSaveId(saved.id)
    }

    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1500)
    dialog.alert(lang === 'ru' ? 'Сохранение' : 'Saved', lang === 'ru' ? 'Изменения успешно сохранены!' : 'All changes have been successfully saved.')
  }, [schema, currentSaveId, fileHandle, t, dialog, lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
      if (e.key === 'Escape') setHighlightTable(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  const handleExit = useCallback(() => { setSchema(null); setCurrentSaveId(undefined); setFileHandle(null); setTagFilter(null) }, [])

  const handleEditorSave = useCallback((updated: Table, originalName: string | null) => {
    if (!schema) return
    let newTables: Table[]
    if (originalName === null) {
      newTables = [...schema.tables, updated]
    } else {
      const oldName = originalName
      const newName = updated.name
      newTables = schema.tables.map(tb => {
        if (tb.name === oldName) return updated
        if (oldName !== newName) {
          return {
            ...tb,
            columns: tb.columns.map(c =>
              c.foreignKey?.table === oldName ? { ...c, foreignKey: { ...c.foreignKey, table: newName } } : c
            ),
          }
        }
        return tb
      })
    }
    setEditorState(null)
    applySchema({ ...schema, tables: newTables }, undefined, masterPositionsRef.current)
  }, [schema, applySchema])

  const handleDelete = useCallback(async (tableName: string) => {
    if (!schema) return
    const ok = await dialog.confirm(lang === 'ru' ? 'Удаление таблицы' : 'Delete table', t.deleteConfirm(tableName))
    if (!ok) return
    if (highlightTable === tableName) setHighlightTable(null)
    const newTables = schema.tables.filter(tb => tb.name !== tableName).map(tb => ({
      ...tb,
      columns: tb.columns.map(c => c.foreignKey?.table === tableName ? { ...c, foreignKey: undefined } : c)
    }))
    applySchema({ ...schema, tables: newTables }, undefined, masterPositionsRef.current)
  }, [schema, applySchema, t, highlightTable, dialog, lang])

  const handleOpen = useCallback((result: OpenResult) => {
    setHighlightTable(null)
    setTagFilter(null)
    setCurrentSaveId(result.savedId)
    setFileHandle(result.fileHandle ?? null)
    applySchema(result.schema, undefined, result.positions)
    setActiveTab('schema')
    const hasPositions = result.positions && Object.keys(result.positions).length > 0
    if (!hasPositions) {
      setTimeout(() => setPendingELK(true), 250)
    }
  }, [applySchema])

  if (!schema) {
    return <UploadZone lang={lang} onLangToggle={() => setLang(l => l === 'en' ? 'ru' : 'en')} onOpen={handleOpen} />
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: TAB_H, background: '#13151f', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 32, shrink: 0 }}>
        <div className="flex items-center gap-3 mr-4">
          <span className="text-white font-black text-xl tracking-tighter">DB Viewer</span>
          <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-500 font-bold uppercase tracking-widest">{schema.tables.length} tables</div>
        </div>
        <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/5">
          {(['schema', 'data'] as Tab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-gray-500 hover:text-gray-300'}`}>
              {t[tab + 'Tab']}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 pr-5">
          <button onClick={() => { exportJSON(schema); dialog.alert(lang === 'ru' ? 'Экспорт JSON' : 'JSON Export', lang === 'ru' ? 'Файл схемы успешно скачан.' : 'The schema file has been successfully downloaded.') }} className="rounded-lg transition-colors hover:bg-white/10" style={{ fontSize: 14, color: '#6b7280', padding: '7px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>↓ JSON</button>
          <button onClick={() => { downloadSQL(schema); dialog.alert(lang === 'ru' ? 'Экспорт SQL' : 'SQL Export', lang === 'ru' ? 'SQL DDL файл успешно скачан.' : 'The SQL DDL file has been successfully downloaded.') }} className="rounded-lg transition-colors hover:bg-white/10" style={{ fontSize: 14, color: '#6b7280', padding: '7px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>↓ SQL</button>
          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <button onClick={handleSave} className="rounded-lg font-semibold text-white transition-all hover:brightness-110" style={{ fontSize: 15, padding: '7px 18px', background: saveFlash ? '#16a34a' : '#6366f1', minWidth: 90 }}>{t.saveBtn}</button>
          <button onClick={handleExit} className="text-gray-500 hover:text-white transition-colors ml-2" style={{ fontSize: 14 }}>{t.exitBtn}</button>
          <button onClick={() => setLang(l => l === 'en' ? 'ru' : 'en')} className="ml-4 px-2 py-1 rounded border border-white/10 text-[10px] font-bold text-gray-500 hover:text-white transition-colors">{lang === 'en' ? 'RU' : 'EN'}</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'schema' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
            <Sidebar
              tables={schema.tables}
              lang={lang}
              onLangToggle={() => setLang(l => l === 'en' ? 'ru' : 'en')}
              onNew={() => setEditorState('new')}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onExit={handleExit}
            />
            <div style={{ flex: 1, height: '100%', background: '#0f1117', position: 'relative' }}>
              <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
                <div className="flex bg-[#1a1d27]/90 backdrop-blur rounded-xl p-1 border border-white/10 shadow-2xl">
                  {(['pan', 'select'] as const).map(mode => (
                    <button key={mode} onClick={() => setCanvasMode(mode)} className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${canvasMode === mode ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`} title={mode === 'pan' ? (lang === 'ru' ? 'Режим перемещения' : 'Pan mode') : (lang === 'ru' ? 'Режим выделения (лассо)' : 'Select mode (lasso)')}>
                      <span style={{ fontSize: 15 }}>{mode === 'pan' ? '✋' : '⬚'}</span>
                      <span className="text-xs font-bold uppercase tracking-wider">{mode}</span>
                    </button>
                  ))}
                </div>
                <div className="relative bg-[#1a1d27]/90 backdrop-blur rounded-xl p-1 border border-white/10 shadow-2xl" ref={groupsBtnRef}>
                  <button onClick={() => setGroupsOpen(!groupsOpen)} className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${tagFilter ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}>
                    <span style={{ fontSize: 15 }}>◎</span>
                    <span className="text-xs font-bold uppercase tracking-wider">{tagFilter ? `#${tagFilter}` : (lang === 'ru' ? 'Группы' : 'Groups')}</span>
                    <span style={{ fontSize: 10, opacity: 0.5 }}>▼</span>
                  </button>
                  {groupsOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1d27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2 z-50">
                      <button onClick={() => { setTagFilter(null); setGroupsOpen(false) }} className={`w-full px-5 py-2.5 text-left text-sm flex items-center justify-between hover:bg-white/5 transition-colors ${tagFilter === null ? 'text-indigo-400 font-bold bg-indigo-500/5' : 'text-gray-400'}`}>
                        <span>{lang === 'ru' ? 'Все таблицы' : 'All groups'}</span>
                        {tagFilter === null && <span>✓</span>}
                      </button>
                      <div className="h-px bg-white/5 my-1" />
                      {allTags.map(({ tag, count }) => (
                        <button key={tag} onClick={() => { setTagFilter(tag); setGroupsOpen(false) }} className={`w-full px-5 py-2.5 text-left text-sm flex items-center justify-between hover:bg-white/5 transition-colors ${tagFilter === tag ? 'text-indigo-400 font-bold bg-indigo-500/5' : 'text-gray-400'}`}>
                          <div className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                            <span>{tag}</span>
                          </div>
                          <span className="text-[10px] opacity-40 font-mono bg-white/5 px-1.5 py-0.5 rounded">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex bg-[#1a1d27]/90 backdrop-blur rounded-xl p-1 border border-white/10 shadow-2xl">
                  <select value={viewMode} onChange={e => handleViewMode(e.target.value as ViewMode)} className="px-4 py-2 rounded-lg bg-transparent text-gray-400 hover:text-white text-xs font-bold outline-none cursor-pointer transition-colors uppercase tracking-wider">
                    <option value="full">Full</option>
                    <option value="compact">Compact</option>
                    <option value="collapsed">Collapsed</option>
                  </select>
                </div>
              </div>
              <ViewModeCtx.Provider value={{ mode: viewMode, bulkExpand, bulkKey }}>
                <HighlightCtx.Provider value={highlightCtxValue}>
                  <MultiSelectCtx.Provider value={multiSelectActive}>
                    <ReactFlow nodes={displayNodes} edges={displayEdges} onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange} onNodeDragStart={handleNodeDragStart} onNodeDrag={handleNodeDrag} onSelectionChange={handleSelectionChange} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.05} selectionMode={canvasMode === 'select' ? SelectionMode.Partial : SelectionMode.Disabled} panOnDrag={canvasMode === 'pan'} selectionOnDrag={canvasMode === 'select'} panOnScroll={true} onInit={instance => { rfInstanceRef.current = instance }}>
                      <Background color="#1a1d27" gap={20} />
                      <Controls showInteractive={false} className="!bg-[#1a1d27] !border-white/10 !rounded-xl !overflow-hidden !shadow-2xl" />
                      <MiniMap style={{ background: '#13151f', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }} nodeColor={n => tableColor(n.id)} maskColor="rgba(0,0,0,0.6)" />
                    </ReactFlow>
                  </MultiSelectCtx.Provider>
                </HighlightCtx.Provider>
              </ViewModeCtx.Provider>
            </div>
          </div>
        ) : (
          <DataViewer schema={schema} lang={lang} onDataChange={(tbl, rows) => { const newData = { ...(schema.data ?? {}), [tbl]: rows }; setSchema({ ...schema, data: newData }) }} />
        )}
      </div>
      {editorState !== null && (() => {
        const editedTable = editorState === 'new' ? null : schema.tables.find(t => t.name === editorState) ?? null
        return <TableEditor key={editorState} table={editedTable} schema={schema} lang={lang} onSave={handleEditorSave} onClose={() => setEditorState(null)} />
      })()}
    </div>
  )
}
