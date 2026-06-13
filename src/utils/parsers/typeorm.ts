import type { Schema, Table, Column } from '../../types/schema'

export function parseTypeORM(text: string): Schema {
  const tables: Table[] = []
  const entityRegex = /@Entity[\s\S]*?(?:export\s+)?class\s+(\w+)[\s\S]*?\{([\s\S]*?)^}/gm
  let m: RegExpExecArray | null

  while ((m = entityRegex.exec(text)) !== null) {
    const name = m[1]
    const body = m[2]
    const columns: Column[] = []

    const colRegex = /@(PrimaryGeneratedColumn|PrimaryColumn|Column|ManyToOne|OneToOne)\s*(?:\([^()]*(?:\([^()]*\)[^()]*)*\))?\s*\n\s*(\w+)\s*[!?]?\s*:\s*([\w<>|[\] ]+)/g
    let c: RegExpExecArray | null

    while ((c = colRegex.exec(body)) !== null) {
      const decorator = c[1]
      const colName = c[2]
      const tsType = c[3].trim()

      const col: Column = {
        name: colName,
        type: tsType,
        primaryKey: decorator.startsWith('Primary'),
        nullable: body.includes(`${colName}?`),
      }

      // look for @JoinColumn / relation reference
      if (decorator === 'ManyToOne' || decorator === 'OneToOne') {
        const joinMatch = body.slice(c.index).match(/@JoinColumn[\s\S]*?referencedColumnName:\s*'(\w+)'/)
        const refTypeMatch = body.slice(c.index).match(/@(?:ManyToOne|OneToOne)\(\s*\(\)\s*=>\s*(\w+)/)
        if (refTypeMatch) {
          col.foreignKey = { table: refTypeMatch[1], column: joinMatch?.[1] ?? 'id' }
        }
      }

      columns.push(col)
    }

    columns.sort((a, b) => {
      const rank = (c: Column) => c.primaryKey ? 0 : c.foreignKey ? 1 : 2
      return rank(a) - rank(b)
    })

    tables.push({ name, columns })
  }

  return { tables }
}
