import type { Schema, Table, Column } from '../../types/schema'

// split by commas not inside parentheses
function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') depth--
    else if (s[i] === ',' && depth === 0) {
      parts.push(s.slice(start, i))
      start = i + 1
    }
  }
  parts.push(s.slice(start))
  return parts
}

export function parseSQL(text: string): Schema {
  const tables: Table[] = []

  // Extract @tags comments before stripping: map tableName → tags[]
  const tagsMap: Record<string, string[]> = {}
  // Matches -- @tags: x, y followed by optional comments/newlines then CREATE TABLE name
  const tagsLineRegex = /--\s*@tags:\s*([^\n]+)\s*(?:--[^\n]*\s*|\/\*[\s\S]*?\*\/\s*)*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/gi
  let tm: RegExpExecArray | null
  while ((tm = tagsLineRegex.exec(text)) !== null) {
    const tags = tm[1].split(',').map(t => t.trim()).filter(Boolean)
    const tableName = tm[2]
    tagsMap[tableName] = tags
  }

  // strip comments, skipping string literals so DEFAULT '--val' is not truncated
  const clean = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'[^']*'|--[^\n]*/g, m => m.startsWith("'") ? m : '')

  const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([^;]+)\)/gi
  let m: RegExpExecArray | null

  while ((m = createRegex.exec(clean)) !== null) {
    const name = m[1]
    const body = m[2]
    const columns: Column[] = []
    const fkMap: Record<string, { table: string; column: string }> = {}

    // parse FOREIGN KEY constraints first
    const fkRegex = /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/gi
    let fk: RegExpExecArray | null
    while ((fk = fkRegex.exec(body)) !== null) {
      const col = fk[1].replace(/[`"']/g, '').trim()
      fkMap[col] = { table: fk[2], column: fk[3].replace(/[`"']/g, '').trim() }
    }

    const pkInline: string[] = []
    const pkConstraint = body.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i)
    if (pkConstraint) {
      pkConstraint[1].split(',').forEach(c => pkInline.push(c.replace(/[`"']/g, '').trim()))
    }

    for (const rawLine of splitTopLevel(body)) {
      const line = rawLine.trim()
      if (!line) continue
      if (/^(PRIMARY|FOREIGN|UNIQUE\s+KEY|KEY|INDEX|CONSTRAINT)\s/i.test(line)) continue

      const colMatch = line.match(/^[`"']?(\w+)[`"']?\s+(\S+)/)
      if (!colMatch) continue

      const colName = colMatch[1]
      const colType = colMatch[2].replace(/[()0-9,]/g, '').toLowerCase()

      // inline REFERENCES: col_name TYPE REFERENCES other_table(other_col)
      const inlineRef = line.match(/REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i)
      if (inlineRef) {
        fkMap[colName] = { table: inlineRef[1], column: inlineRef[2].replace(/[`"']/g, '').trim() }
      }

      const isPK = line.toUpperCase().includes('PRIMARY KEY') || pkInline.includes(colName)
      const col: Column = {
        name: colName,
        type: colType,
        primaryKey: isPK,
        nullable: isPK ? false : !line.toUpperCase().includes('NOT NULL'),
        unique: line.toUpperCase().includes('UNIQUE'),
        foreignKey: fkMap[colName],
      }
      columns.push(col)
    }

    columns.sort((a, b) => {
      const rank = (c: Column) => c.primaryKey ? 0 : c.foreignKey ? 1 : 2
      return rank(a) - rank(b)
    })

    const entry: Table = { name, columns }
    if (tagsMap[name]) entry.tags = tagsMap[name]
    tables.push(entry)
  }

  // ALTER TABLE ... ADD [CONSTRAINT ...] FOREIGN KEY (...) REFERENCES ...(...)
  const tableByName = new Map(tables.map(t => [t.name, t]))
  const alterRe = /ALTER\s+TABLE\s+[`"']?(\w+)[`"']?\s+ADD\s+(?:CONSTRAINT\s+[`"']?\w+[`"']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/gi
  let a: RegExpExecArray | null
  while ((a = alterRe.exec(clean)) !== null) {
    const colName = a[2].replace(/[`"']/g, '').trim()
    const col = tableByName.get(a[1])?.columns.find(c => c.name === colName)
    if (col) col.foreignKey = { table: a[3], column: a[4].replace(/[`"']/g, '').trim() }
  }

  // re-sort now that ALTER-added FKs are in place (PK → FK → rest)
  const rank = (c: Column) => c.primaryKey ? 0 : c.foreignKey ? 1 : 2
  for (const t of tables) t.columns.sort((x, y) => rank(x) - rank(y))

  return { tables }
}

// map non-Postgres type names (from MySQL / ORM imports) to Postgres equivalents
const PG_TYPE_MAP: Record<string, string> = {
  datetime: 'timestamp', double: 'double precision', number: 'numeric',
  tinyint: 'smallint', mediumint: 'integer', year: 'integer',
  string: 'text', tinytext: 'text', mediumtext: 'text', longtext: 'text', clob: 'text',
  nvarchar: 'varchar', nchar: 'char',
  blob: 'bytea', binary: 'bytea', varbinary: 'bytea',
  tinyblob: 'bytea', mediumblob: 'bytea', longblob: 'bytea',
  enum: 'text', set: 'text', array: 'text',
  citext: 'text', hstore: 'text', geometry: 'text', geography: 'text',
}
const KEEP_PARAMS = new Set(['numeric', 'varchar', 'char'])

function pgType(raw: string): string {
  const m = /^([A-Za-z_]+)\s*(\(.*\))?$/.exec(raw.trim())
  if (!m) return raw.toUpperCase()
  const base = m[1].toLowerCase()
  const mapped = PG_TYPE_MAP[base]
  if (!mapped) return raw.toUpperCase()                       // already valid / custom
  return (KEEP_PARAMS.has(mapped) ? mapped + (m[2] ?? '') : mapped).toUpperCase()
}

export function exportSQL(schema: Schema): string {
  const blocks: string[] = []

  for (const table of schema.tables) {
    const parts: string[] = []
    if (table.tags && table.tags.length > 0) {
      parts.push(`-- @tags: ${table.tags.join(', ')}`)
    }

    const colLines: string[] = []
    for (const col of table.columns) {
      let line = `  "${col.name}" ${pgType(col.type)}`
      if (!col.nullable) line += ' NOT NULL'
      if (col.unique && !col.primaryKey) line += ' UNIQUE'
      if (col.primaryKey && !table.columns.some(c => c !== col && c.primaryKey)) {
        line += ' PRIMARY KEY'
      }
      colLines.push(line)
    }

    // composite PK, if more than one PK column
    const pks = table.columns.filter(c => c.primaryKey).map(c => `"${c.name}"`)
    if (pks.length > 1) colLines.push(`  PRIMARY KEY (${pks.join(', ')})`)

    parts.push(colLines.length
      ? `CREATE TABLE "${table.name}" (\n${colLines.join(',\n')}\n);`
      : `CREATE TABLE "${table.name}" ();`)
    blocks.push(parts.join('\n'))
  }

  // Foreign keys as ALTER TABLE after every table exists — valid regardless of
  // declaration order and cyclic references.
  const fks: string[] = []
  for (const table of schema.tables) {
    for (const col of table.columns) {
      if (col.foreignKey) {
        fks.push(`ALTER TABLE "${table.name}" ADD FOREIGN KEY ("${col.name}") REFERENCES "${col.foreignKey.table}" ("${col.foreignKey.column}");`)
      }
    }
  }

  const ddl = blocks.join('\n\n')
  return (fks.length ? `${ddl}\n\n${fks.join('\n')}` : ddl) + '\n'
}
