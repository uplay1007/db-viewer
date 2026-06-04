const PALETTE = [
  '#6366f1', '#ec4899', '#14b8a6', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#10b981',
  '#f97316', '#3b82f6', '#84cc16', '#a855f7',
]

export function tableColor(tableName: string): string {
  let hash = 0
  for (let i = 0; i < tableName.length; i++) {
    hash = (hash * 31 + tableName.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}
