import type { Schema } from '../../types/schema'

export function parseJSON(text: string): Schema {
  const raw = JSON.parse(text)
  if (!Array.isArray(raw.tables)) throw new Error('Expected { tables: [] }')
  for (const t of raw.tables) {
    if (typeof t.name !== 'string' || !t.name) throw new Error(`Table missing name`)
    if (!Array.isArray(t.columns)) throw new Error(`Table "${t.name}" missing columns array`)
    for (const c of t.columns) {
      if (typeof c.name !== 'string' || !c.name) throw new Error(`Column in "${t.name}" missing name`)
      if (typeof c.type !== 'string' || !c.type) throw new Error(`Column "${c.name}" in "${t.name}" missing type`)
    }
  }
  return raw as Schema
}
