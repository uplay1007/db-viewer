import { createContext } from 'react'

export interface HighlightCtxValue {
  active: boolean
  highlighted: Set<string>   // table + its direct FK neighbors
  focusTable: string | null  // the table that was clicked
  onHighlight: (name: string) => void
  onClear: () => void
}

export const HighlightCtx = createContext<HighlightCtxValue>({
  active: false,
  highlighted: new Set(),
  focusTable: null,
  onHighlight: () => {},
  onClear: () => {},
})
