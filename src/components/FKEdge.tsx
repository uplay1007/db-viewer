import { useState, useContext } from 'react'
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react'
import { HighlightCtx } from '../contexts/highlight'

export interface FKEdgeData extends Record<string, unknown> {
  label: string
  color: string
}

export function FKEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  source, target,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const { label, color } = (data ?? {}) as FKEdgeData
  const hl = useContext(HighlightCtx)

  // Dim ALL edges except those directly touching the focus table
  const edgeDimmed      = hl.active && source !== hl.focusTable && target !== hl.focusTable
  const edgeHighlighted = hl.active && (source === hl.focusTable || target === hl.focusTable)

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 8,
  })

  return (
    <>
      {/* Invisible wide hitbox for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'default' }}
      />
      {/* Glow layer for highlighted edges */}
      {edgeHighlighted && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeOpacity={0.25}
          style={{ pointerEvents: 'none', filter: `blur(3px)` }}
        />
      )}
      {/* Visible edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={edgeHighlighted ? 2.5 : hovered ? 2.5 : 1.5}
        strokeOpacity={edgeDimmed ? 0.06 : 1}
        style={{ transition: 'stroke-width 0.15s, stroke-opacity 0.2s', pointerEvents: 'none' }}
      />
      {/* Dot at source */}
      <circle cx={sourceX} cy={sourceY} r={edgeHighlighted ? 5 : 4} fill={color}
        opacity={edgeDimmed ? 0.06 : 1} style={{ pointerEvents: 'none' }} />
      {/* Dot at target */}
      <circle cx={targetX} cy={targetY} r={edgeHighlighted ? 5 : 4} fill={color}
        opacity={edgeDimmed ? 0.06 : 1} style={{ pointerEvents: 'none' }} />

      {/* Label — only on hover, rendered as HTML via EdgeLabelRenderer for crisp text */}
      <EdgeLabelRenderer>
        {(hovered || edgeHighlighted) && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            <div
              className="text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap select-none"
              style={{
                background: '#1a1d27',
                border: `1px solid ${color}${edgeHighlighted ? 'cc' : '55'}`,
                color,
                boxShadow: edgeHighlighted
                  ? `0 0 8px ${color}66, 0 2px 8px rgba(0,0,0,0.6)`
                  : `0 2px 8px rgba(0,0,0,0.6)`,
                fontWeight: edgeHighlighted ? 700 : 400,
              }}
            >
              {label}
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
