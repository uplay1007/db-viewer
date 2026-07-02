import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  useNodesState,
  useEdgesState,
  useNodesInitialized,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { Schema, Table, Column } from './types/schema'
import { computeLayout } from './utils/layout'
import { tableColor, tagColor } from './utils/colors'
import {
  saveCurrentSession, loadCurrentSession, clearCurrentSession,
} from './utils/storage'
import { TableNode, type TableNodeData, MultiSelectCtx } from './components/TableNode'
import { HighlightCtx, type HighlightCtxValue } from './contexts/highlight'
import { EdgeHoverCtx, type EdgeEndpoint } from './contexts/edgeHover'
import { ViewModeCtx, type ViewMode, type ViewModeCtxValue } from './contexts/viewMode'
import { OrthoEdge, type OrthoEdgeData } from './components/OrthoEdge'
import { computeELKLayout } from './services/layoutService'
import { resolveOverlaps, type Rect } from './utils/separateNodes'
import { TableEditor } from './components/TableEditor'
import { Sidebar } from './components/Sidebar'
import { SchemaEditor } from './components/SchemaEditor'
import { DataViewer } from './components/DataViewer'
import { UploadZone, type OpenResult } from './components/UploadZone'
import { writeToHandle } from './utils/fileAccess'
import { exportSQL } from './utils/parsers/sql'
import { T, type Lang } from './i18n'
import { DialogProvider, useDialog } from './contexts/DialogContext'
import { useAuth } from './contexts/AuthContext'
import { AuthScreen } from './components/AuthScreen'
import { upsertSave } from './services/schemasAPI'
import appStyles from './App.module.css'

const NODE_TYPES = { table: TableNode }
const EDGE_TYPES = { fk: OrthoEdge }

function NodesInitializedFitView({ rfRef }: { rfRef: React.RefObject<ReactFlowInstance<any, any> | null> }) {
  const initialized = useNodesInitialized()
  useEffect(() => {
    if (initialized) rfRef.current?.fitView({ padding: 0.2, duration: 300 })
  }, [initialized, rfRef])
  return null
}

function getRelType(table: Table, col: Column): '1:1' | '1:N' | 'N:M' {
  if (col.unique) return '1:1'
  const fkCols = table.columns.filter(c => c.foreignKey)
  if (fkCols.length >= 2 && fkCols.length >= table.columns.length - 1) return 'N:M'
  return '1:N'
}

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

  const tableMap = new Map(schema.tables.map(t => [t.name, t]))
  const edges: Edge[] = []
  const seen = new Set<string>()
  for (const table of schema.tables) {
    for (const col of table.columns) {
      if (!col.foreignKey) continue
      const target = col.foreignKey.table
      if (target === table.name) continue
      const targetTable = tableMap.get(target)
      if (!targetTable) continue
      const key = `${table.name}-${target}-${col.name}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({
        id: key, source: table.name, target,
        type: 'fk',
        data: {
          label: `${col.name} → ${col.foreignKey.column}`,
          color: '#4b5563',
          relType: getRelType(table, col),
          sourceColor: tagColor(table.tags),
          targetColor: tagColor(targetTable.tags),
          sourceColumn: col.name,
          targetColumn: col.foreignKey.column,
        } satisfies OrthoEdgeData,
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
  a.href = url; a.download = 'schema.json'; a.click()
  URL.revokeObjectURL(url)
}

function downloadSQL(schema: Schema) {
  const sql = exportSQL(schema)
  const blob = new Blob([sql], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'schema.sql'; a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const { user, loading } = useAuth()

  if (loading) return (
    <div className={appStyles.loadingScreen}>
      <span className={appStyles.loadingText}>Loading...</span>
    </div>
  )

  if (!user) return <AuthScreen />

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
  const currentSaveIdRef = useRef<string | undefined>(session?.saveId)
  const currentSaveName = useRef<string | null>(session?.saveName ?? null)
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const nodesRef = useRef<Node[]>([])
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { currentSaveIdRef.current = currentSaveId }, [currentSaveId])

  const masterPositionsRef = useRef<Record<string, { x: number; y: number }>>(session?.positions ?? {})

  const [editorState, setEditorState] = useState<EditorState>(null)
  const [activeTab, setActiveTab] = useState<Tab>('schema')
  const [saveFlash, setSaveFlash] = useState(false)

  const rfInstanceRef = useRef<ReactFlowInstance<any, any> | null>(null)
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

  const [splitView, setSplitView] = useState(false)
  const [editorWidth, setEditorWidth] = useState(380)
  const editorWidthRef = useRef(380)
  useEffect(() => { editorWidthRef.current = editorWidth }, [editorWidth])
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(0)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = editorWidthRef.current
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return
      const delta = ev.clientX - dragStartXRef.current
      setEditorWidth(Math.max(200, Math.min(800, dragStartWidthRef.current + delta)))
    }
    const onUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const [multiSelectActive, setMultiSelectActive] = useState(false)
  const [highlightTable, setHighlightTable] = useState<string | null>(null)
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set())
  const [layouting, setLayouting] = useState(false)
  const [pendingELK, setPendingELK] = useState(false)

  const displayNodes = useMemo(() => {
    if (!tagFilter || !schema) {
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

  useEffect(() => {
    if (!schema) return
    setHighlightTable(null)

    if (!tagFilter) {
      if (Object.keys(masterPositionsRef.current).length > 0) {
        setNodes(prev => prev.map(n => ({
          ...n,
          position: masterPositionsRef.current[n.id] ?? n.position,
        })))
      }
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.2, duration: 400 }), 50)
      return
    }

    const visibleNames = new Set(schema.tables.filter(t => t.tags?.includes(tagFilter)).map(t => t.name))
    if (visibleNames.size === 0) return

    const heights: Record<string, number> = {}
    if (viewMode !== 'collapsed') {
      nodesRef.current.forEach(n => {
        const h = (n.measured as { height?: number } | undefined)?.height
        if (h) heights[n.id] = h
      })
    }

    computeELKLayout(schema, heights, visibleNames).then(({ positions }) => {
      setNodes(prev => prev.map(n =>
        positions[n.id] ? { ...n, position: positions[n.id] } : n
      ))
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.2, duration: 400 }), 50)
    })
  }, [tagFilter, schema, setNodes, viewMode])

  const clearHighlight = useCallback(() => {
    setHighlightTable(null)
    setSelectedTables(new Set())
  }, [])

  // Click a table header. Shift builds a manual selection group (seeded from
  // the current focus + its FK neighbors are dimmed); plain click focuses.
  const handleTableClick = useCallback((name: string, shiftKey: boolean) => {
    if (shiftKey) {
      setSelectedTables(prev => {
        if (prev.size === 0) {
          return highlightTable ? new Set([highlightTable, name]) : new Set([name])
        }
        const next = new Set(prev)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        return next
      })
    } else {
      setSelectedTables(new Set())
      setHighlightTable(prev => (prev === name ? null : name))
    }
  }, [highlightTable])

  const highlightCtxValue = useMemo((): HighlightCtxValue => {
    // manual selection mode takes precedence over neighbor highlight
    if (selectedTables.size > 0) {
      const lit = new Set(selectedTables)
      if (highlightTable) lit.add(highlightTable)
      return { active: true, highlighted: lit, focusTable: highlightTable, groupMode: true, onHighlight: handleTableClick }
    }
    if (!highlightTable || !schema) {
      return { active: false, highlighted: new Set(), focusTable: null, groupMode: false, onHighlight: handleTableClick }
    }
    const set = new Set<string>([highlightTable])
    for (const t of schema.tables) {
      for (const col of t.columns) {
        if (!col.foreignKey) continue
        if (t.name === highlightTable) set.add(col.foreignKey.table)
        if (col.foreignKey.table === highlightTable) set.add(t.name)
      }
    }
    return { active: true, highlighted: set, focusTable: highlightTable, groupMode: false, onHighlight: handleTableClick }
  }, [highlightTable, selectedTables, schema, handleTableClick, clearHighlight])

  const [edgeHover, setEdgeHover] = useState<{ source: EdgeEndpoint; target: EdgeEndpoint } | null>(null)
  const edgeHoverCtxValue = useMemo(() => ({
    source: edgeHover?.source ?? null,
    target: edgeHover?.target ?? null,
    setHover: setEdgeHover,
  }), [edgeHover])

  const handleLayout = useCallback(async () => {
    if (!schema || layouting) return
    setLayouting(true)
    try {
      const heights: Record<string, number> = {}
      if (viewMode !== 'collapsed') {
        nodesRef.current.forEach(n => {
          const h = (n.measured as { height?: number } | undefined)?.height
          if (h) heights[n.id] = h
        })
      }
      const { positions } = await computeELKLayout(schema, heights)
      if (!tagFilter) masterPositionsRef.current = { ...positions }
      setNodes(prev => prev.map(n => ({ ...n, position: positions[n.id] ?? n.position })))
    } catch (err) {
      console.error('ELK layout failed:', err)
    } finally {
      setLayouting(false)
    }
  }, [schema, layouting, setNodes, tagFilter, viewMode])

  useEffect(() => {
    if (!pendingELK || layouting || nodes.length === 0) return
    const visibleNodes = tagFilter && schema
      ? nodes.filter(n => schema.tables.find(t => t.name === n.id)?.tags?.includes(tagFilter))
      : nodes
    if (visibleNodes.length === 0) return
    const measuredCount = visibleNodes.filter(n => (n.measured as { height?: number } | undefined)?.height).length
    if (measuredCount < visibleNodes.length) return
    setPendingELK(false)
    handleLayout()
  }, [pendingELK, nodes, layouting, handleLayout, tagFilter, schema])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
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

    if (isMasterMode) masterPositionsRef.current[node.id] = { x: node.position.x, y: node.position.y }

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

  const handleNodeDragStop = useCallback((_e: MouseEvent | TouchEvent, node: Node) => {
    const current = nodesRef.current
    if (current.length === 0) return

    const rects = new Map<string, Rect>()
    for (const n of current) {
      const m = n.measured as { width?: number; height?: number } | undefined
      rects.set(n.id, { x: n.position.x, y: n.position.y, w: m?.width ?? 280, h: m?.height ?? 120 })
    }

    // pin only the grabbed node; everything else (incl. highlighted FK
    // neighbors that moved with it) is pushable, so overlaps within the
    // highlighted group get resolved too
    const resolved = resolveOverlaps(rects, new Set([node.id]))

    if (!tagFilter) {
      resolved.forEach((p, id) => { masterPositionsRef.current[id] = p })
    }
    setNodes(prev => prev.map(n => {
      const p = resolved.get(n.id)
      if (!p || (p.x === n.position.x && p.y === n.position.y)) return n
      return { ...n, position: p }
    }))
  }, [setNodes, tagFilter])

  const t = T[lang]
  const handleEdit = useCallback((table: Table) => setEditorState(table.name), [])

  const applySchema = useCallback((
    s: Schema,
    currentNodes?: Node[],
    initialSavedPos?: Record<string, { x: number; y: number }>
  ) => {
    const schemaToUse = { ...s, tables: s.tables.map(t => t.tags !== undefined ? t : { ...t, tags: [] }) }
    if (initialSavedPos) masterPositionsRef.current = { ...initialSavedPos }
    setSchema(schemaToUse)
    saveCurrentSession({ schema: schemaToUse, positions: masterPositionsRef.current, saveId: currentSaveIdRef.current, saveName: currentSaveName.current ?? undefined })
    const { nodes: n, edges: e } = schemaToFlow(schemaToUse, handleEdit, masterPositionsRef.current, currentNodes)
    setNodes(n)
    setEdges(e)
  }, [handleEdit, setNodes, setEdges])

  const handleSchemaFromEditor = useCallback((newSchema: Schema) => {
    applySchema(newSchema, undefined, masterPositionsRef.current)
  }, [applySchema])

  useEffect(() => {
    if (session) {
      applySchema(session.schema, undefined, session.positions)
      const hasPositions = session.positions && Object.keys(session.positions).length > 0
      if (!hasPositions) setTimeout(() => setPendingELK(true), 250)
    }
  }, [session, applySchema])

  useEffect(() => {
    if (nodes.length === 0 || !schema) return
    const handle = setTimeout(() => {
      saveCurrentSession({ schema, positions: masterPositionsRef.current, saveId: currentSaveIdRef.current, saveName: currentSaveName.current ?? undefined })
    }, 1000)
    return () => clearTimeout(handle)
  }, [nodes, schema])

  const handleSave = useCallback(async () => {
    if (!schema) return
    const posMap = { ...masterPositionsRef.current }

    if (fileHandle) {
      const isSql  = fileHandle.name.endsWith('.sql')
      const isJson = fileHandle.name.endsWith('.json')
      if (!isSql && !isJson) {
        exportJSON(schema)
        dialog.alert(
          lang === 'ru' ? 'Формат файла' : 'File format',
          lang === 'ru'
            ? `Файл "${fileHandle.name}" нельзя перезаписать (формат не поддерживает экспорт). Схема скачана как JSON.`
            : `"${fileHandle.name}" cannot be overwritten (export not supported for this format). Schema downloaded as JSON.`
        )
        return
      }
      try {
        const content = isSql ? exportSQL(schema) : JSON.stringify(schema, null, 2)
        await writeToHandle(fileHandle, content)
      } catch (e) {
        console.warn('File write failed, falling back to download', e)
        exportJSON(schema)
        dialog.alert(
          lang === 'ru' ? 'Ошибка записи' : 'Write failed',
          lang === 'ru' ? 'Не удалось сохранить в файл. Схема скачана как копия.' : 'Could not write to file. Schema downloaded as a copy instead.'
        )
        return
      }
    }

    try {
      if (currentSaveId && currentSaveName.current) {
        await upsertSave(currentSaveName.current, schema, posMap, currentSaveId)
      } else {
        const fileDefault = fileHandle?.name.replace(/\.[^.]+$/, '')
        const defaultName = fileDefault ?? schema.tables.map(tb => tb.name).slice(0, 2).join(', ') + (schema.tables.length > 2 ? '…' : '')
        const name = await dialog.prompt(lang === 'ru' ? 'Название сохранения' : 'Save name', t.saveNamePrompt, defaultName)
        if (!name) return
        const saved = await upsertSave(name, schema, posMap)
        setCurrentSaveId(saved.id)
        currentSaveIdRef.current = saved.id
        currentSaveName.current = name
      }
    } catch (e) {
      dialog.alert(
        lang === 'ru' ? 'Ошибка сохранения' : 'Save failed',
        (e as Error).message
      )
      return
    }

    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1500)
    dialog.alert(lang === 'ru' ? 'Сохранение' : 'Saved', lang === 'ru' ? 'Изменения успешно сохранены!' : 'All changes have been successfully saved.')
  }, [schema, currentSaveId, fileHandle, t, dialog, lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
      if (e.key === 'Escape') clearHighlight()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, clearHighlight])

  const handleExit = useCallback(() => {
    clearCurrentSession(); setSchema(null); setCurrentSaveId(undefined)
    currentSaveIdRef.current = undefined
    currentSaveName.current = null
    setFileHandle(null); setTagFilter(null); setEditorState(null)
  }, [])

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
    if (originalName && originalName !== updated.name) {
      const pos = masterPositionsRef.current[originalName]
      if (pos) {
        masterPositionsRef.current[updated.name] = pos
        delete masterPositionsRef.current[originalName]
      }
    }
    setEditorState(null)
    applySchema({ ...schema, tables: newTables }, undefined, masterPositionsRef.current)
  }, [schema, applySchema])

  const handleDelete = useCallback(async (tableName: string) => {
    if (!schema) return
    const ok = await dialog.confirm(lang === 'ru' ? 'Удаление таблицы' : 'Delete table', t.deleteConfirm(tableName))
    if (!ok) return
    if (highlightTable === tableName) setHighlightTable(null)
    setSelectedTables(prev => {
      if (!prev.has(tableName)) return prev
      const next = new Set(prev); next.delete(tableName); return next
    })
    const newTables = schema.tables.filter(tb => tb.name !== tableName).map(tb => ({
      ...tb,
      columns: tb.columns.map(c => c.foreignKey?.table === tableName ? { ...c, foreignKey: undefined } : c)
    }))
    applySchema({ ...schema, tables: newTables }, undefined, masterPositionsRef.current)
  }, [schema, applySchema, t, highlightTable, dialog, lang])

  const handleOpen = useCallback((result: OpenResult) => {
    setHighlightTable(null); setSelectedTables(new Set()); setTagFilter(null)
    setCurrentSaveId(result.savedId)
    currentSaveIdRef.current = result.savedId
    currentSaveName.current = result.savedName ?? null
    setFileHandle(result.fileHandle ?? null)
    applySchema(result.schema, undefined, result.positions)
    setActiveTab('schema')
    const hasPositions = result.positions && Object.keys(result.positions).length > 0
    if (!hasPositions) setTimeout(() => setPendingELK(true), 250)
  }, [applySchema])

  if (!schema) {
    return <UploadZone lang={lang} onLangToggle={() => setLang(l => l === 'en' ? 'ru' : 'en')} onOpen={handleOpen} />
  }

  return (
    <div className={appStyles.root}>
      {/* Top bar */}
      <div className={appStyles.topbar}>
        <div className={appStyles.topbarBrand}>
          <span className={appStyles.topbarLogo}>DB Viewer</span>
          <div className={appStyles.topbarBadge}>{schema.tables.length} tables</div>
        </div>
        <div className={appStyles.tabRow}>
          {(['schema', 'data'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${appStyles.tabBtn} ${activeTab === tab ? appStyles.tabBtnActive : ''}`}
            >
              {tab === 'schema' ? t.schemaTab : t.dataTab}
            </button>
          ))}
        </div>
        <div className={appStyles.topbarRight}>
          <button
            onClick={() => { exportJSON(schema); dialog.alert(lang === 'ru' ? 'Экспорт JSON' : 'JSON Export', lang === 'ru' ? 'Файл схемы успешно скачан.' : 'The schema file has been successfully downloaded.') }}
            className={appStyles.exportBtn}
          >
            ↓ JSON
          </button>
          <button
            onClick={() => { downloadSQL(schema); dialog.alert(lang === 'ru' ? 'Экспорт SQL' : 'SQL Export', lang === 'ru' ? 'SQL DDL файл успешно скачан.' : 'The SQL DDL file has been successfully downloaded.') }}
            className={appStyles.exportBtn}
          >
            ↓ SQL
          </button>
          <div className={appStyles.divider} />
          <button
            onClick={handleSave}
            className={appStyles.saveBtn}
            style={{ '--save-bg': saveFlash ? '#16a34a' : '#6366f1' } as React.CSSProperties}
          >
            {t.saveBtn}
          </button>
          <button onClick={handleExit} className={appStyles.exitBtn}>{t.exitBtn}</button>
          <button
            onClick={() => setLang(l => l === 'en' ? 'ru' : 'en')}
            className={appStyles.langToggleBtn}
          >
            {lang === 'en' ? 'RU' : 'EN'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={appStyles.content}>
        {activeTab === 'schema' ? (
          <div className={appStyles.schemaView}>
            {splitView ? (
              <>
                <div className={appStyles.splitEditorPane} style={{ width: editorWidth }}>
                  <SchemaEditor schema={schema} onSchemaChange={handleSchemaFromEditor} width={editorWidth} />
                </div>
                <div className={appStyles.resizeHandle} onMouseDown={handleResizeStart} />
              </>
            ) : (
              <Sidebar
                tables={schema.tables}
                lang={lang}
                onLangToggle={() => setLang(l => l === 'en' ? 'ru' : 'en')}
                onNew={() => setEditorState('new')}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onExit={handleExit}
              />
            )}
            <div className={appStyles.canvasArea}>
              {/* Canvas toolbar */}
              <div className={appStyles.canvasToolbar}>
                {/* Pan / Select */}
                <div className={appStyles.toolPill}>
                  {(['pan', 'select'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setCanvasMode(mode)}
                      className={`${appStyles.toolBtn} ${canvasMode === mode ? appStyles.toolBtnActive : ''}`}
                      title={mode === 'pan' ? (lang === 'ru' ? 'Режим перемещения' : 'Pan mode') : (lang === 'ru' ? 'Режим выделения (лассо)' : 'Select mode (lasso)')}
                    >
                      <span className={appStyles.toolBtnIcon}>{mode === 'pan' ? '✋' : '⬚'}</span>
                      <span className={appStyles.toolBtnLabel}>{mode}</span>
                    </button>
                  ))}
                </div>

                {/* Groups */}
                <div className={appStyles.groupsPill} ref={groupsBtnRef}>
                  <button
                    onClick={() => setGroupsOpen(!groupsOpen)}
                    className={`${appStyles.groupsBtn} ${tagFilter ? appStyles.groupsBtnFiltered : ''}`}
                  >
                    <span className={appStyles.toolBtnIcon}>◎</span>
                    <span className={appStyles.toolBtnLabel}>
                      {tagFilter ? `#${tagFilter}` : (lang === 'ru' ? 'Группы' : 'Groups')}
                    </span>
                    <span className={appStyles.groupsChevron}>▼</span>
                  </button>
                  {groupsOpen && (
                    <div className={appStyles.groupsDropdown}>
                      <button
                        onClick={() => { setTagFilter(null); setGroupsOpen(false) }}
                        className={`${appStyles.groupsAllBtn} ${tagFilter === null ? appStyles.groupsAllBtnActive : ''}`}
                      >
                        <span>{lang === 'ru' ? 'Все таблицы' : 'All groups'}</span>
                        {tagFilter === null && <span>✓</span>}
                      </button>
                      <div className={appStyles.groupsDivider} />
                      {allTags.map(({ tag, count }) => (
                        <button
                          key={tag}
                          onClick={() => { setTagFilter(tag); setGroupsOpen(false) }}
                          className={`${appStyles.groupsTagBtn} ${tagFilter === tag ? appStyles.groupsTagBtnActive : ''}`}
                        >
                          <div className={appStyles.groupsTagLeft}>
                            <span className={appStyles.groupsTagDot} />
                            <span>{tag}</span>
                          </div>
                          <span className={appStyles.groupsTagCount}>{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* View mode */}
                <div className={appStyles.toolPill}>
                  <select
                    value={viewMode}
                    onChange={e => handleViewMode(e.target.value as ViewMode)}
                    className={appStyles.viewSelect}
                  >
                    <option value="full">Full</option>
                    <option value="compact">Compact</option>
                    <option value="collapsed">Collapsed</option>
                  </select>
                </div>

                {/* Layout */}
                <div className={appStyles.toolPill}>
                  <button
                    onClick={handleLayout}
                    disabled={layouting}
                    className={`${appStyles.toolBtn} ${layouting ? appStyles.toolBtnDisabled : ''}`}
                    title="Re-run auto layout"
                  >
                    <span className={appStyles.toolBtnIcon} style={layouting ? { display: 'inline-block', transform: 'rotate(90deg)' } : undefined}>⟳</span>
                    <span className={appStyles.toolBtnLabel}>{layouting ? '...' : 'Layout'}</span>
                  </button>
                </div>

                {/* JSON split view */}
                <div className={appStyles.toolPill}>
                  <button
                    onClick={() => setSplitView(v => !v)}
                    className={`${appStyles.toolBtn} ${splitView ? appStyles.toolBtnActive : ''}`}
                    title="Toggle JSON editor"
                  >
                    <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{'{}'}</span>
                    <span className={appStyles.toolBtnLabel}>JSON</span>
                  </button>
                </div>
              </div>

              <ViewModeCtx.Provider value={{ mode: viewMode, bulkExpand, bulkKey }}>
                <HighlightCtx.Provider value={highlightCtxValue}>
                 <EdgeHoverCtx.Provider value={edgeHoverCtxValue}>
                  <MultiSelectCtx.Provider value={multiSelectActive}>
                    <ReactFlow
                      nodes={displayNodes}
                      edges={displayEdges}
                      onNodesChange={handleNodesChange}
                      onEdgesChange={onEdgesChange}
                      onNodeDragStart={handleNodeDragStart}
                      onNodeDrag={handleNodeDrag}
                      onNodeDragStop={handleNodeDragStop}
                      onSelectionChange={handleSelectionChange}
                      onPaneClick={clearHighlight}
                      nodeTypes={NODE_TYPES}
                      edgeTypes={EDGE_TYPES}
                      fitView
                      fitViewOptions={{ padding: 0.2 }}
                      minZoom={0.05}
                      selectionMode={canvasMode === 'select' ? SelectionMode.Partial : SelectionMode.Full}
                      panOnDrag={canvasMode === 'pan'}
                      selectionOnDrag={canvasMode === 'select'}
                      multiSelectionKeyCode={canvasMode === 'select' ? 'Shift' : null}
                      panOnScroll={true}
                      onInit={instance => { rfInstanceRef.current = instance }}
                    >
                      <NodesInitializedFitView rfRef={rfInstanceRef} />
                      <Background color="#1a1d27" gap={20} />
                      <Controls
                        showInteractive={false}
                        className={appStyles.reactFlowControls}
                      />
                      <MiniMap
                        style={{ background: '#13151f', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}
                        nodeColor={n => tagColor((n.data as { table?: { tags?: string[] } }).table?.tags)}
                        maskColor="rgba(0,0,0,0.6)"
                      />
                    </ReactFlow>
                  </MultiSelectCtx.Provider>
                 </EdgeHoverCtx.Provider>
                </HighlightCtx.Provider>
              </ViewModeCtx.Provider>
            </div>
          </div>
        ) : (
          <DataViewer
            schema={schema}
            lang={lang}
            onDataChange={(tbl, rows) => {
              const newData = { ...(schema.data ?? {}), [tbl]: rows }
              setSchema({ ...schema, data: newData })
            }}
          />
        )}
      </div>

      {editorState !== null && (() => {
        const editedTable = editorState === 'new' ? null : schema.tables.find(t => t.name === editorState) ?? null
        return <TableEditor key={editorState} table={editedTable} schema={schema} lang={lang} onSave={handleEditorSave} onClose={() => setEditorState(null)} />
      })()}
    </div>
  )
}
