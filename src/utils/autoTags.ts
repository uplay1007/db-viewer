import type { Schema } from '../types/schema'

// Phase 1: prefix from table name (first word before _)
// Phase 2: if table has FK to another table, inherit that table's primary tag
export function autoDetectTags(schema: Schema): Record<string, string[]> {
  const primary: Record<string, string> = {}
  for (const t of schema.tables) {
    primary[t.name] = t.name.split('_')[0]
  }

  const result: Record<string, string[]> = {}
  for (const t of schema.tables) {
    const tags = new Set<string>([primary[t.name]])
    for (const col of t.columns) {
      if (!col.foreignKey) continue
      const targetTag = primary[col.foreignKey.table]
      if (targetTag && targetTag !== primary[t.name]) tags.add(targetTag)
    }
    result[t.name] = [...tags]
  }

  return result
}
