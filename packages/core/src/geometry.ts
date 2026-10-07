import type { Pt } from './types'

export function polylineLength(points: Pt[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1]!, points[i]!)
  return total
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Point at distance `d` along the polyline, clamped to its ends. */
export function pointAt(points: Pt[], d: number): Pt {
  if (points.length === 0) return { x: 0, y: 0 }
  let left = Math.max(0, d)
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const len = dist(a, b)
    if (left <= len || i === points.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len)
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    left -= len
  }
  return points[points.length - 1]!
}

/** SVG path through the points with rounded corners. */
export function roundedPath(points: Pt[], radius = 8): string {
  if (points.length === 0) return ''
  const first = points[0]!
  let d = `M${r(first.x)} ${r(first.y)}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!
    const cur = points[i]!
    const next = points[i + 1]!
    const inLen = dist(prev, cur)
    const outLen = dist(cur, next)
    const rad = Math.min(radius, inLen / 2, outLen / 2)
    if (rad < 0.5) {
      d += `L${r(cur.x)} ${r(cur.y)}`
      continue
    }
    const a = {
      x: cur.x + ((prev.x - cur.x) / inLen) * rad,
      y: cur.y + ((prev.y - cur.y) / inLen) * rad,
    }
    const b = {
      x: cur.x + ((next.x - cur.x) / outLen) * rad,
      y: cur.y + ((next.y - cur.y) / outLen) * rad,
    }
    d += `L${r(a.x)} ${r(a.y)}Q${r(cur.x)} ${r(cur.y)} ${r(b.x)} ${r(b.y)}`
  }
  if (points.length > 1) {
    const last = points[points.length - 1]!
    d += `L${r(last.x)} ${r(last.y)}`
  }
  return d
}

function r(n: number): number {
  return Math.round(n * 10) / 10
}

/** Edge letter keys: A..Z, AA, AB, ... */
export function letterKey(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}
