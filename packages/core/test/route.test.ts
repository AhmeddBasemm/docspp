import { describe, expect, it } from 'vitest'
import { type Pt, type Rect, routeEdges } from '../src'

const rect = (x: number, y: number, w = 100, h = 60): Rect => ({ x, y, w, h })

function crosses(a: Pt, b: Pt, r: Rect, inset = 1): boolean {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y, b.y)
  return x1 > r.x + inset && x0 < r.x + r.w - inset && y1 > r.y + inset && y0 < r.y + r.h - inset
}

function orthogonal(points: Pt[]) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    expect(Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeLessThan(0.6)
  }
}

describe('routeEdges', () => {
  const bounds = { x: 0, y: 0, w: 900, h: 500 }

  it('connects two boxes with an orthogonal path around an obstacle', () => {
    const a = rect(20, 200)
    const b = rect(700, 200)
    const wall = rect(340, 150, 100, 160)
    const { e } = routeEdges([{ id: 'e', from: a, to: b }], { bounds, obstacles: [a, b, wall] })
    orthogonal(e!)
    for (let i = 1; i < e!.length; i++) expect(crosses(e![i - 1]!, e![i]!, wall)).toBe(false)
    expect(e![0]!.x).toBeCloseTo(a.x + a.w, 0)
    expect(e!.at(-1)!.x).toBeCloseTo(b.x, 0)
  })

  it('goes straight when nothing is in the way', () => {
    const a = rect(20, 200)
    const b = rect(500, 200)
    const { e } = routeEdges([{ id: 'e', from: a, to: b }], { bounds, obstacles: [a, b] })
    expect(e).toHaveLength(2)
  })

  it('tries another side when the facing side has no room', () => {
    // `top` sits 20px above `below`, so a path cannot enter `top` from underneath.
    const top = rect(300, 100)
    const below = rect(300, 180)
    const source = rect(20, 400)
    const { e } = routeEdges([{ id: 'e', from: source, to: top }], {
      bounds,
      obstacles: [top, below, source],
    })
    orthogonal(e!)
    const end = e!.at(-1)!
    // It must have entered from the left, right or top, not through the 20px gap.
    expect(end.y === top.y + top.h && end.x > top.x && end.x < top.x + top.w).toBe(false)
    for (let i = 1; i < e!.length; i++) {
      expect(crosses(e![i - 1]!, e![i]!, below)).toBe(false)
      expect(crosses(e![i - 1]!, e![i]!, top)).toBe(false)
    }
  })

  it('spreads edges that share a side instead of stacking them', () => {
    const hub = rect(40, 200, 100, 120)
    const targets = [rect(500, 40), rect(500, 220), rect(500, 400)]
    const out = routeEdges(
      targets.map((t, i) => ({ id: `e${i}`, from: hub, to: t })),
      { bounds, obstacles: [hub, ...targets] },
    )
    const starts = Object.values(out).map((p) => p[0]!.y)
    expect(new Set(starts).size).toBe(3)
  })

  it('prefers staying inside the hint area', () => {
    const a = rect(100, 100)
    const b = rect(100, 300)
    const area = rect(60, 60, 220, 360)
    const { e } = routeEdges([{ id: 'e', from: a, to: b, hint: area }], {
      bounds,
      obstacles: [a, b],
    })
    for (const p of e!) {
      expect(p.x).toBeGreaterThanOrEqual(area.x - 1)
      expect(p.x).toBeLessThanOrEqual(area.x + area.w + 1)
    }
  })
})
