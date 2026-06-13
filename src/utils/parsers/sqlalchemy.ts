import type { Schema, Table, Column } from '../../types/schema'

const SA_TYPE_MAP: Record<string, string> = {
  Integer: 'integer', BigInteger: 'bigint', SmallInteger: 'smallint',
  String: 'varchar', Text: 'text', Unicode: 'varchar', UnicodeText: 'text',
  Boolean: 'boolean', Float: 'float', Numeric: 'decimal',
  Date: 'date', DateTime: 'datetime', Time: 'time',
  LargeBinary: 'binary', PickleType: 'binary',
  JSON: 'json', JSONB: 'jsonb', UUID: 'uuid', Enum: 'enum',
}

export function parseSQLAlchemy(text: string): Schema {
  const tables: Table[] = []
  const classRegex = /class\s+(\w+)\s*\(.*?(?:Base|Model).*?\):\s*\n((?:[ \t]+.+\n?)*)/gm
  let m: RegExpExecArray | null

  while ((m = classRegex.exec(text)) !== null) {
    const name = m[1]
    const body = m[2]
    const columns: Column[] = []

    const colRegex = /(\w+)\s*(?::\s*\w+\s*)?=\s*(?:mapped_column|Column)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g
    let c: RegExpExecArray | null

    while ((c = colRegex.exec(body)) !== null) {
      const colName = c[1]
      if (['__tablename__', '__table_args__'].includes(colName)) continue
      const args = c[2]

      const typeMatch = args.match(/(?:^|,\s*)(\w+)(?:\(|,|$)/)
      const saType = typeMatch?.[1] ?? 'varchar'
      const isPK = args.includes('primary_key=True')
      const isNullable = args.includes('nullable=True') || (!isPK && !args.includes('nullable=False'))

      const fkMatch = args.match(/ForeignKey\(['"]([^'"]+)['"]\)/)
      let foreignKey: Column['foreignKey']
      if (fkMatch) {
        const [refTable, refCol] = fkMatch[1].split('.')
        foreignKey = { table: refTable, column: refCol ?? 'id' }
      }

      columns.push({
        name: colName,
        type: SA_TYPE_MAP[saType] ?? saType.toLowerCase(),
        primaryKey: isPK,
        nullable: isNullable,
        unique: args.includes('unique=True'),
        foreignKey,
      })
    }

    columns.sort((a, b) => {
      const rank = (c: Column) => c.primaryKey ? 0 : c.foreignKey ? 1 : 2
      return rank(a) - rank(b)
    })

    if (columns.length > 0) tables.push({ name, columns })
  }

  return { tables }
}
