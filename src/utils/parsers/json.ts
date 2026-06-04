import type { Schema } from '../../types/schema'

export function parseJSON(text: string): Schema {
  const raw = JSON.parse(text)
  if (!Array.isArray(raw.tables)) throw new Error('Expected { tables: [] }')
  return raw as Schema
}
