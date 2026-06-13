import type { Schema, Table, Column } from '../../types/schema'

export function parsePrisma(text: string): Schema {
  const tables: Table[] = []
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g
  let m: RegExpExecArray | null

  while ((m = modelRegex.exec(text)) !== null) {
    const name = m[1]
    const body = m[2]
    const columns: Column[] = []

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue

      const parts = line.split(/\s+/)
      if (parts.length < 2) continue
      const [colName, colType] = parts

      // skip relation fields (lowercase type = relation field ref)
      if (/^[a-z]/.test(colType) && !colType.includes('[]')) {
        // check if it looks like a scalar — if not, skip
        const scalars = ['string','int','float','boolean','datetime','json','bigint','decimal','bytes']
        if (!scalars.includes(colType.toLowerCase().replace('?',''))) continue
      }

      // relation reference fields (e.g. "user User @relation(...)") are not DB columns
      if (line.includes('@relation')) continue

      const col: Column = {
        name: colName,
        type: colType.replace('?', ''),
        nullable: colType.endsWith('?'),
        primaryKey: line.includes('@id'),
        unique: line.includes('@unique'),
      }

      columns.push(col)
    }

    // second pass: wire FK from @relation
    // each relation line sits below the relation field line: "fieldName  ModelType @relation(...)"
    const bodyLines = body.split('\n').map(l => l.trim()).filter(Boolean)
    for (const line of bodyLines) {
      const rel = line.match(/@relation\(fields:\s*\[(\w+)\],\s*references:\s*\[(\w+)\]/)
      if (!rel) continue
      const fieldName = rel[1]
      const refCol = rel[2]
      // refTable is the type on the SAME line as @relation
      const parts = line.split(/\s+/)
      const refTable = parts[1]?.replace('?', '').replace('[]', '') ?? ''
      const col = columns.find(c => c.name === fieldName)
      if (col && refTable) col.foreignKey = { table: refTable, column: refCol }
    }

    // sort: PK first, FK second, rest
    columns.sort((a, b) => {
      const rank = (c: Column) => c.primaryKey ? 0 : c.foreignKey ? 1 : 2
      return rank(a) - rank(b)
    })

    tables.push({ name, columns })
  }

  return { tables }
}
