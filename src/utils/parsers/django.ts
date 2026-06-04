import type { Schema, Table, Column } from '../../types/schema'

const DJANGO_TYPE_MAP: Record<string, string> = {
  AutoField: 'integer', BigAutoField: 'bigint', IntegerField: 'integer',
  BigIntegerField: 'bigint', SmallIntegerField: 'smallint',
  CharField: 'varchar', TextField: 'text', EmailField: 'varchar',
  URLField: 'varchar', SlugField: 'varchar', UUIDField: 'uuid',
  BooleanField: 'boolean', NullBooleanField: 'boolean',
  FloatField: 'float', DecimalField: 'decimal',
  DateField: 'date', DateTimeField: 'datetime', TimeField: 'time',
  ForeignKey: 'integer', OneToOneField: 'integer', ManyToManyField: 'integer',
  JSONField: 'json', BinaryField: 'binary',
}

export function parseDjango(text: string): Schema {
  const tables: Table[] = []
  const classRegex = /class\s+(\w+)\s*\(.*?Model.*?\):\s*\n((?:[ \t]+.+\n?)*)/gm
  let m: RegExpExecArray | null

  while ((m = classRegex.exec(text)) !== null) {
    const name = m[1]
    if (name === 'Meta') continue
    const body = m[2]
    const columns: Column[] = []

    // implicit PK
    if (!body.includes('primary_key=True')) {
      columns.push({ name: 'id', type: 'integer', primaryKey: true, nullable: false })
    }

    const fieldRegex = /^\s+(\w+)\s*=\s*models\.(\w+)\(([^)]*)\)/gm
    let f: RegExpExecArray | null

    while ((f = fieldRegex.exec(body)) !== null) {
      const colName = f[1]
      if (colName === 'Meta') continue
      const djangoType = f[2]
      const args = f[3]

      const isFK = djangoType === 'ForeignKey' || djangoType === 'OneToOneField'
      const refMatch = args.match(/^'?(\w+)'?/)
      const nullableMatch = args.includes('null=True')
      const pkMatch = args.includes('primary_key=True')

      const col: Column = {
        name: isFK ? colName + '_id' : colName,
        type: DJANGO_TYPE_MAP[djangoType] ?? djangoType,
        primaryKey: pkMatch,
        nullable: nullableMatch,
        foreignKey: isFK && refMatch ? { table: refMatch[1], column: 'id' } : undefined,
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
