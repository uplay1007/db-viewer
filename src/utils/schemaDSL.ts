import type { Schema, Table, Column } from '../types/schema'

// Schema → DSL text
export function schemaToDSL(schema: Schema): string {
  return schema.tables.map(tableToBlock).join('\n\n')
}

function tableToBlock(table: Table): string {
  const cols = table.columns.map(col => {
    const parts = [col.name, col.type]
    if (col.primaryKey) parts.push('pk')
    if (col.unique && !col.primaryKey) parts.push('unique')
    if (col.nullable) parts.push('null')
    if (col.foreignKey) parts.push(`> ${col.foreignKey.table}.${col.foreignKey.column}`)
    return '  ' + parts.join(' ')
  })
  return `Table ${table.name} {\n${cols.join('\n')}\n}`
}

// DSL text → Schema (prevSchema used to preserve tags + data)
export function dslToSchema(text: string, prevSchema?: Schema): Schema {
  const prevTagsMap = new Map(
    prevSchema?.tables.map(t => [t.name, t.tags ?? []]) ?? []
  )
  const tables: Table[] = []

  const tableRe = /Table\s+(\w+)\s*\{([^}]*)\}/gi
  let m: RegExpExecArray | null

  const seenNames = new Set<string>()

  while ((m = tableRe.exec(text)) !== null) {
    const name = m[1]
    if (seenNames.has(name)) throw new Error(`Duplicate table: ${name}`)
    seenNames.add(name)
    const body = m[2]
    const columns: Column[] = []

    for (const raw of body.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('//') || line.startsWith('--')) continue

      // Tokenize: handles "varchar(255)", "table.col", ">"
      const tokens: string[] = []
      const tokRe = /[\w]+(?:\([^)]*\))?(?:\.\w+)*|>/g
      let t: RegExpExecArray | null
      while ((t = tokRe.exec(line)) !== null) tokens.push(t[0])

      if (tokens.length < 2) continue
      const [colName, colType, ...rest] = tokens
      const col: Column = { name: colName, type: colType }

      for (let i = 0; i < rest.length; i++) {
        const flag = rest[i]
        if (flag === 'pk') col.primaryKey = true
        else if (flag === 'unique') col.unique = true
        else if (flag === 'null') col.nullable = true
        else if (flag === '>') {
          const ref = rest[++i]
          if (ref) {
            const dot = ref.lastIndexOf('.')
            if (dot > 0) col.foreignKey = { table: ref.slice(0, dot), column: ref.slice(dot + 1) }
          }
        }
      }

      columns.push(col)
    }

    tables.push({ name, columns, tags: prevTagsMap.get(name) ?? [] })
  }

  return { tables, data: prevSchema?.data }
}
