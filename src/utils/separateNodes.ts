export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Resolves AABB overlaps by pushing free nodes apart. Pinned nodes never move.
 * Cascade is emergent: each iteration only resolves direct overlaps, so a node
 * pushed into a third one gets resolved on the next iteration.
 *
 * Separation is along the axis of minimum penetration (MTV) for stability —
 * pushing along the center-vector causes diagonal drift and oscillation.
 *
 * Returns new {x,y} for every input id (unchanged ones keep their coords).
 */
export function resolveOverlaps(
  rects: Map<string, Rect>,
  pinned: Set<string>,
  margin = 24,
  maxIter = 20,
): Map<string, { x: number; y: number }> {
  const ids = [...rects.keys()]
  const pos = new Map<string, Rect>()
  rects.forEach((r, id) => pos.set(id, { ...r }))

  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const aId = ids[i], bId = ids[j]
        const aPinned = pinned.has(aId), bPinned = pinned.has(bId)
        if (aPinned && bPinned) continue

        const a = pos.get(aId)!, b = pos.get(bId)!

        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (overlapX <= 0 || overlapY <= 0) continue // not intersecting

        const aCx = a.x + a.w / 2, aCy = a.y + a.h / 2
        const bCx = b.x + b.w / 2, bCy = b.y + b.h / 2

        // push along the axis with the smaller penetration; +margin opens a gap
        let pushX = 0, pushY = 0
        if (overlapX < overlapY) {
          const dir = bCx >= aCx ? 1 : -1
          pushX = (overlapX + margin) * dir
        } else {
          const dir = bCy >= aCy ? 1 : -1
          pushY = (overlapY + margin) * dir
        }

        if (aPinned) {
          // only b moves, full push away from a
          b.x += pushX; b.y += pushY
        } else if (bPinned) {
          a.x -= pushX; a.y -= pushY
        } else {
          // both free: split the push
          a.x -= pushX / 2; a.y -= pushY / 2
          b.x += pushX / 2; b.y += pushY / 2
        }
        moved = true
      }
    }

    if (!moved) break
  }

  const out = new Map<string, { x: number; y: number }>()
  pos.forEach((r, id) => out.set(id, { x: r.x, y: r.y }))
  return out
}
