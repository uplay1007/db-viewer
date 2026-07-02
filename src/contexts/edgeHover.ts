import { createContext } from 'react'

export interface EdgeEndpoint { table: string; column: string }

export interface EdgeHoverValue {
  source: EdgeEndpoint | null
  target: EdgeEndpoint | null
  setHover: (v: { source: EdgeEndpoint; target: EdgeEndpoint } | null) => void
}

export const EdgeHoverCtx = createContext<EdgeHoverValue>({
  source: null,
  target: null,
  setHover: () => {},
})
