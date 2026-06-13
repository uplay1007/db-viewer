import React, { useState, useContext } from 'react'
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react'
import { HighlightCtx } from '../contexts/highlight'

export interface OrthoEdgeData extends Record<string, unknown> {
  label: string
  color: string
  relType?: '1:1' | '1:N' | 'N:M'
  sourceColor?: string
  targetColor?: string
}

const LABEL_OFF = 24

const POS_DIR: Record<string, { dx: number; dy: number }> = {
  right: { dx: 1, dy: 0 }, left: { dx: -1, dy: 0 },
  top: { dx: 0, dy: -1 }, bottom: { dx: 0, dy: 1 },
}

export function OrthoEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  source, target,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const { label, color, relType, sourceColor, targetColor } = (data ?? {}) as OrthoEdgeData
  const hl = useContext(HighlightCtx)

  const edgeDimmed      = hl.active && source !== hl.focusTable && target !== hl.focusTable
  const edgeHighlighted = hl.active && (source === hl.focusTable || target === hl.focusTable)

  const activeColor = edgeHighlighted
    ? (source === hl.focusTable ? sourceColor : targetColor) ?? color
    : color

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 0,
  })

  const startDot = { x: sourceX, y: sourceY }
  const endDot   = { x: targetX, y: targetY }
  const sd = POS_DIR[sourcePosition] ?? { dx: 1, dy: 0 }
  const td = POS_DIR[targetPosition] ?? { dx: -1, dy: 0 }
  const srcLabelX = startDot.x + sd.dx * LABEL_OFF
  const srcLabelY = startDot.y + sd.dy * LABEL_OFF
  const endLabelX = endDot.x + td.dx * LABEL_OFF
  const endLabelY = endDot.y + td.dy * LABEL_OFF

  const srcLabel = relType === '1:1' ? '1' : 'n'
  const endLabel = relType === 'N:M' ? 'm' : '1'

  return (
    <>
      {/* Wide invisible hitbox */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'default' }}
      />
      {/* Glow layer */}
      {edgeHighlighted && (
        <path
          d={edgePath}
          fill="none"
          stroke={activeColor}
          strokeWidth={6}
          strokeOpacity={0.25}
          style={{ pointerEvents: 'none', filter: 'blur(3px)' }}
        />
      )}
      {/* Visible edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={activeColor}
        strokeWidth={edgeHighlighted ? 2.5 : hovered ? 2.5 : 1.5}
        strokeOpacity={edgeDimmed ? 0.06 : 1}
        style={{ transition: 'stroke-width 0.15s, stroke-opacity 0.2s', pointerEvents: 'none' }}
      />
      {/* Endpoint dots */}
      <circle cx={startDot.x} cy={startDot.y} r={edgeHighlighted ? 5 : 4} fill={activeColor}
        opacity={edgeDimmed ? 0.06 : 1} style={{ pointerEvents: 'none' }} />
      <circle cx={endDot.x} cy={endDot.y} r={edgeHighlighted ? 5 : 4} fill={activeColor}
        opacity={edgeDimmed ? 0.06 : 1} style={{ pointerEvents: 'none' }} />

      {/* Relationship type labels */}
      {relType && !edgeDimmed && (
        <>
          <text x={srcLabelX} y={srcLabelY} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fontWeight={700} fontFamily="monospace"
            stroke="#0d0f17" strokeWidth={3} paintOrder="stroke"
            fill={activeColor} opacity={edgeHighlighted ? 1 : 0.7}
            style={{ pointerEvents: 'none', userSelect: 'none' } as React.CSSProperties}>
            {srcLabel}
          </text>
          <text x={endLabelX} y={endLabelY} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fontWeight={700} fontFamily="monospace"
            stroke="#0d0f17" strokeWidth={3} paintOrder="stroke"
            fill={activeColor} opacity={edgeHighlighted ? 1 : 0.7}
            style={{ pointerEvents: 'none', userSelect: 'none' } as React.CSSProperties}>
            {endLabel}
          </text>
        </>
      )}

      {/* Label */}
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
                border: `1px solid ${activeColor}${edgeHighlighted ? 'cc' : '55'}`,
                color: activeColor,
                boxShadow: edgeHighlighted
                  ? `0 0 8px ${activeColor}66, 0 2px 8px rgba(0,0,0,0.6)`
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
