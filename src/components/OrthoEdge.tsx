import { useState, useContext } from 'react'
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
  points?: RoutePoint[]
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
  const { label, color, points } = (data ?? {}) as OrthoEdgeData
  const hl = useContext(HighlightCtx)

  const edgeDimmed      = hl.active && source !== hl.focusTable && target !== hl.focusTable
  const edgeHighlighted = hl.active && (source === hl.focusTable || target === hl.focusTable)

  let edgePath: string
  let labelX: number
  let labelY: number
  let startDot: RoutePoint
  let endDot: RoutePoint

  if (points && points.length >= 2) {
    edgePath = buildOrthoPath(points)
    const mid = pathMidpoint(points)
    labelX = mid.x
    labelY = mid.y
    startDot = points[0]
    endDot = points[points.length - 1]
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
  }

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
          stroke={color}
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
        stroke={color}
        strokeWidth={edgeHighlighted ? 2.5 : hovered ? 2.5 : 1.5}
        strokeOpacity={edgeDimmed ? 0.06 : 1}
        style={{ transition: 'stroke-width 0.15s, stroke-opacity 0.2s', pointerEvents: 'none' }}
      />
      {/* Endpoint dots */}
      <circle cx={startDot.x} cy={startDot.y} r={edgeHighlighted ? 5 : 4} fill={color}
        opacity={edgeDimmed ? 0.06 : 1} style={{ pointerEvents: 'none' }} />
      <circle cx={endDot.x} cy={endDot.y} r={edgeHighlighted ? 5 : 4} fill={color}
        opacity={edgeDimmed ? 0.06 : 1} style={{ pointerEvents: 'none' }} />

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
