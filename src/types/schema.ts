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
}

export interface Table {
  name: string
  columns: Column[]
  tags?: string[]
}

export interface Layout {
  id: string
  name: string
  tables: string[]                                    // table names shown in this layout
  positions: Record<string, { x: number; y: number }> // per-layout table positions
  viewMode?: 'full' | 'compact' | 'collapsed'          // per-layout detail level
}

export interface Schema {
  tables: Table[]
  data?: Record<string, Record<string, unknown>[]>
  layouts?: Layout[]
}
