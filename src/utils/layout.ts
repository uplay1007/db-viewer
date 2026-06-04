import dagre from '@dagrejs/dagre'
import type { Schema } from '../types/schema'

export interface NodePos { id: string; x: number; y: number }

const NODE_WIDTH = 280
const ROW_WRAP = 3200  // px — wrap to next row after this width
const COMP_GAP_X = 180
const COMP_GAP_Y = 200

function nodeHeight(colCount: number): number {
  return 44 + colCount * 32
}

// Find weakly-connected components (undirected FK graph)
function getComponents(schema: Schema): string[][] {
  const adj = new Map<string, Set<string>>()
  schema.tables.forEach(t => adj.set(t.name, new Set()))

  for (const table of schema.tables) {
    for (const col of table.columns) {
      if (!col.foreignKey) continue
      const target = col.foreignKey.table
      if (!adj.has(target)) continue
      adj.get(table.name)!.add(target)
      adj.get(target)!.add(table.name)
    }
  }

  const visited = new Set<string>()
  const components: string[][] = []

  for (const table of schema.tables) {
    if (visited.has(table.name)) continue
    const group: string[] = []
    const stack = [table.name]
    while (stack.length) {
      const node = stack.pop()!
      if (visited.has(node)) continue
      visited.add(node)
      group.push(node)
      adj.get(node)?.forEach(n => { if (!visited.has(n)) stack.push(n) })
    }
    components.push(group)
  }

  // Sort: largest component first
  return components.sort((a, b) => b.length - a.length)
}

// Layout one component with dagre TB
function layoutComponent(tables: Schema['tables']): NodePos[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'TB',
    nodesep: 80,
    ranksep: 100,
    marginx: 20,
    marginy: 20,
  })
  g.setDefaultEdgeLabel(() => ({}))

  tables.forEach(t => g.setNode(t.name, { width: NODE_WIDTH, height: nodeHeight(t.columns.length) }))

  const added = new Set<string>()
  for (const t of tables) {
    for (const col of t.columns) {
      if (!col.foreignKey) continue
      if (!tables.find(x => x.name === col.foreignKey!.table)) continue
      const key = `${t.name}→${col.foreignKey.table}`
      if (!added.has(key)) { g.setEdge(t.name, col.foreignKey.table); added.add(key) }
    }
  }

  dagre.layout(g)

  return tables.map(t => {
    const n = g.node(t.name)
    return { id: t.name, x: n.x - NODE_WIDTH / 2, y: n.y - nodeHeight(t.columns.length) / 2 }
  })
}

export function computeLayout(schema: Schema): NodePos[] {
  const components = getComponents(schema)
  const all: NodePos[] = []

  let curX = 0, curY = 0, rowH = 0

  for (const group of components) {
    const tables = schema.tables.filter(t => group.includes(t.name))
    const positions = layoutComponent(tables)

    const minX = Math.min(...positions.map(p => p.x))
    const minY = Math.min(...positions.map(p => p.y))
    const maxX = Math.max(...positions.map(p => p.x)) + NODE_WIDTH
    const maxY = Math.max(...positions.map(p => p.y)) +
      nodeHeight(Math.max(...tables.map(t => t.columns.length)))

    const w = maxX - minX
    const h = maxY - minY

    // Wrap row
    if (curX > 0 && curX + w > ROW_WRAP) {
      curX = 0
      curY += rowH + COMP_GAP_Y
      rowH = 0
    }

    positions.forEach(p => {
      all.push({ id: p.id, x: p.x - minX + curX, y: p.y - minY + curY })
    })

    curX += w + COMP_GAP_X
    rowH = Math.max(rowH, h)
  }

  return all
}
