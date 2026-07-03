import type { Schema, Table, Column } from '../types/schema'

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

export interface DSLDiagnostic { line: number; message: string }
export interface DSLResult { schema: Schema; diagnostics: DSLDiagnostic[] }

// ── Schema → DSL text ──────────────────────────────────────────────────────
// Tables hold only attributes; foreign keys live in a separate Relations block.
export function schemaToDSL(schema: Schema): string {
  const blocks = schema.tables.map(t => {
    const cols = t.columns.map(c => {
      const parts = [c.name, c.type]
      if (c.primaryKey) parts.push('pk')
      if (c.unique && !c.primaryKey) parts.push('unique')
      if (c.nullable) parts.push('null')
      return '  ' + parts.join(' ')
    })
    return `Table ${t.name} {\n${cols.join('\n')}\n}`
  })

  const rels: string[] = []
  for (const t of schema.tables) {
    for (const c of t.columns) {
      if (c.foreignKey) rels.push(`  ${t.name}.${c.name} > ${c.foreignKey.table}.${c.foreignKey.column}`)
    }
  }

  return [...blocks, `Relations {\n${rels.join('\n')}\n}`].join('\n\n')
}

// ── DSL text → Schema + diagnostics ────────────────────────────────────────
const REL_RE = /^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*>\s*([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/

export function dslToSchema(text: string, prevSchema?: Schema): DSLResult {
  const prevTags = new Map(prevSchema?.tables.map(t => [t.name, t.tags ?? []]) ?? [])
  const diagnostics: DSLDiagnostic[] = []
  const tables: Table[] = []
  const byName = new Map<string, Table>()
  const relLines: { line: number; text: string }[] = []

  const lines = text.split('\n')
  let mode: 'none' | 'table' | 'relations' = 'none'
  let cur: Table | null = null
  let curCols: Set<string> | null = null

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const line = lines[i].trim()
    if (!line || line.startsWith('//') || line.startsWith('--')) continue

    if (mode === 'none') {
      if (/^Relations\b/i.test(line)) { mode = 'relations'; continue }
      const tm = /^Table\s+(.+?)\s*\{?\s*$/i.exec(line)
      if (tm) {
        const name = tm[1].trim()
        if (!IDENT.test(name)) diagnostics.push({ line: lineNo, message: `Invalid table name "${name}" — latin letters, digits and _ only` })
        if (byName.has(name)) diagnostics.push({ line: lineNo, message: `Duplicate table "${name}"` })
        cur = { name, columns: [], tags: prevTags.get(name) ?? [] }
        tables.push(cur); byName.set(name, cur)
        curCols = new Set()
        mode = 'table'
        continue
      }
      diagnostics.push({ line: lineNo, message: `Unexpected "${line}" — expected a Table or Relations block` })
      continue
    }

    if (mode === 'table') {
      if (line === '}') { mode = 'none'; cur = null; curCols = null; continue }
      if (line.includes('>')) diagnostics.push({ line: lineNo, message: `Put relations in the Relations { } block, not inside a table` })
      const tokens = line.split(/\s+/)
      const colName = tokens[0]
      const colType = tokens[1]
      if (!IDENT.test(colName)) diagnostics.push({ line: lineNo, message: `Invalid column name "${colName}" — latin letters, digits and _ only` })
      else if (!colType) diagnostics.push({ line: lineNo, message: `Column "${colName}" is missing a type` })
      if (cur && curCols) {
        if (curCols.has(colName)) diagnostics.push({ line: lineNo, message: `Duplicate column "${colName}" in "${cur.name}"` })
        curCols.add(colName)
        const col: Column = { name: colName, type: colType ?? 'varchar' }
        for (const f of tokens.slice(2)) {
          if (f === 'pk') col.primaryKey = true
          else if (f === 'unique') col.unique = true
          else if (f === 'null') col.nullable = true
        }
        cur.columns.push(col)
      }
      continue
    }

    // mode === 'relations'
    if (line === '}') { mode = 'none'; continue }
    relLines.push({ line: lineNo, text: line })
  }

  // validate relations against the parsed tables
  for (const { line, text: rel } of relLines) {
    const m = REL_RE.exec(rel)
    if (!m) { diagnostics.push({ line, message: `Invalid relation — expected "table.column > table.column"` }); continue }
    const [, sT, sC, tT, tC] = m
    const src = byName.get(sT)
    if (!src) { diagnostics.push({ line, message: `Unknown table "${sT}"` }); continue }
    const srcCol = src.columns.find(c => c.name === sC)
    if (!srcCol) { diagnostics.push({ line, message: `"${sT}" has no column "${sC}"` }); continue }
    const tgt = byName.get(tT)
    if (!tgt) { diagnostics.push({ line, message: `Unknown table "${tT}"` }); continue }
    const tgtCol = tgt.columns.find(c => c.name === tC)
    if (!tgtCol) { diagnostics.push({ line, message: `"${tT}" has no column "${tC}"` }); continue }
    if (srcCol.primaryKey) { diagnostics.push({ line, message: `"${sT}.${sC}" is a primary key — a PK can't reference another table (flip the direction?)` }); continue }
    if (!tgtCol.primaryKey && !tgtCol.unique) { diagnostics.push({ line, message: `"${tT}.${tC}" must be a primary key or unique to be referenced` }); continue }
    srcCol.foreignKey = { table: tT, column: tC }
  }

  return { schema: { tables }, diagnostics }
}
