export interface ForeignKey {
  table: string
  column: string
}

export interface Column {
  name: string
  type: string
  primaryKey?: boolean
  foreignKey?: ForeignKey
  nullable?: boolean
  unique?: boolean
  default?: string
}

export interface Table {
  name: string
  columns: Column[]
  tags?: string[]
}

export interface Schema {
  tables: Table[]
  data?: Record<string, Record<string, unknown>[]>
}
