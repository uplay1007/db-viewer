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

  return { tables }
}

export function exportSQL(schema: Schema): string {
  const lines: string[] = []

  for (const table of schema.tables) {
    // Add @tags comment if present
    if (table.tags && table.tags.length > 0) {
      lines.push(`-- @tags: ${table.tags.join(', ')}`)
    }

    lines.push(`CREATE TABLE "${table.name}" (`)
    
    const colLines: string[] = []
    
    // Columns
    for (const col of table.columns) {
      let line = `  "${col.name}" ${col.type.toUpperCase()}`
      if (!col.nullable) line += ' NOT NULL'
      if (col.unique) line += ' UNIQUE'
      if (col.primaryKey && !table.columns.some(c => c !== col && c.primaryKey)) {
        // Simple inline PK if it's the only one
        line += ' PRIMARY KEY'
      }
      colLines.push(line)
    }

    // Multi-column PK if necessary
    const pks = table.columns.filter(c => c.primaryKey).map(c => `"${c.name}"`)
    if (pks.length > 1) {
      colLines.push(`  PRIMARY KEY (${pks.join(', ')})`)
    }

    // Foreign Keys
    for (const col of table.columns) {
      if (col.foreignKey) {
        colLines.push(`  FOREIGN KEY ("${col.name}") REFERENCES "${col.foreignKey.table}"("${col.foreignKey.column}")`)
      }
    }

    lines.push(colLines.join(',\n'))
    lines.push(');\n')
  }

  return lines.join('\n')
}
