import React, { useState, useContext } from 'react'
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react'
import { HighlightCtx } from '../contexts/highlight'
import type { RoutePoint } from '../services/layoutService'

export interface OrthoEdgeData extends Record<string, unknown> {
  label: string
  color: string
  relType?: '1:1' | '1:N' | 'N:M'
  sourceColor?: string
  targetColor?: string
  points?: RoutePoint[]
}

const LABEL_OFF = 24

function normDir(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return { dx: dx / len, dy: dy / len }
}

const POS_DIR: Record<string, { dx: number; dy: number }> = {
  right: { dx: 1, dy: 0 }, left: { dx: -1, dy: 0 },
  top: { dx: 0, dy: -1 }, bottom: { dx: 0, dy: 1 },
}

function buildOrthoPath(points: RoutePoint[]): string {
  return 'M ' + points.map(p => `${p.x} ${p.y}`).join(' L ')
}

function pathMidpoint(points: RoutePoint[]): RoutePoint {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 }
  // Walk cumulative length, return point at 50%
  let total = 0
  const segs: number[] = []
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    const len = Math.sqrt(dx * dx + dy * dy)
    segs.push(len)
    total += len
  }
  let walked = 0
  const half = total / 2
  for (let i = 0; i < segs.length; i++) {
    if (walked + segs[i] >= half) {
      const t = (half - walked) / segs[i]
      return {
        x: points[i].x + t * (points[i + 1].x - points[i].x),
        y: points[i].y + t * (points[i + 1].y - points[i].y),
      }
    }
    walked += segs[i]
  }
  return points[Math.floor(points.length / 2)]
}

export function OrthoEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  source, target,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const { label, color, relType, sourceColor, targetColor, points } = (data ?? {}) as OrthoEdgeData
  const hl = useContext(HighlightCtx)

  const edgeDimmed      = hl.active && source !== hl.focusTable && target !== hl.focusTable
  const edgeHighlighted = hl.active && (source === hl.focusTable || target === hl.focusTable)

  const activeColor = edgeHighlighted
    ? (source === hl.focusTable ? sourceColor : targetColor) ?? color
    : color

  let edgePath: string
  let labelX: number
  let labelY: number
  let startDot: RoutePoint
  let endDot: RoutePoint

  let srcLabelX: number, srcLabelY: number, endLabelX: number, endLabelY: number

  if (points && points.length >= 2) {
    edgePath = buildOrthoPath(points)
    const mid = pathMidpoint(points)
    labelX = mid.x
    labelY = mid.y
    startDot = points[0]
    endDot = points[points.length - 1]
    const sd = normDir(points[0], points[1])
    srcLabelX = startDot.x + sd.dx * LABEL_OFF
    srcLabelY = startDot.y + sd.dy * LABEL_OFF
    const ed = normDir(points[points.length - 1], points[points.length - 2])
    endLabelX = endDot.x + ed.dx * LABEL_OFF
    endLabelY = endDot.y + ed.dy * LABEL_OFF
  } else {
    const [path, lx, ly] = getSmoothStepPath({
      sourceX, sourceY, targetX, targetY,
      sourcePosition, targetPosition,
      borderRadius: 0,
    })
    edgePath = path
    labelX = lx
    labelY = ly
    startDot = { x: sourceX, y: sourceY }
    endDot = { x: targetX, y: targetY }
    const sd = POS_DIR[sourcePosition] ?? { dx: 1, dy: 0 }
    const td = POS_DIR[targetPosition] ?? { dx: -1, dy: 0 }
    srcLabelX = startDot.x + sd.dx * LABEL_OFF
    srcLabelY = startDot.y + sd.dy * LABEL_OFF
    endLabelX = endDot.x + td.dx * LABEL_OFF
    endLabelY = endDot.y + td.dy * LABEL_OFF
  }

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
