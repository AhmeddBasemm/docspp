import { polylineLength } from './geometry'
import type { Pt, Rect } from './types'

/**
 * Orthogonal edge router for edges ELK cannot see: the ones that cross between independently
 * laid-out zones. A* over a coarse grid with turn and overlap penalties, around node rectangles.
 */

export interface RouteRequest {
  id: string
  from: Rect
  to: Rect
  /** Area the edge belongs to (the smallest group holding both ends). Leaving it costs extra. */
  hint?: Rect
}

export interface RouterOptions {
  bounds: Rect
  /** Rectangles paths must avoid (node and block outlines). */
  obstacles: Rect[]
  /** Rectangles paths may cross but would rather not (zone captions). */
  soft?: Rect[]
}

const G = 8
const CLEARANCE = 10
const TURN = 7
const E = 0
const S = 1
const W = 2
const N = 3
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

type Side = 0 | 1 | 2 | 3 // E S W N, the way a path leaves the rect

export function routeEdges(requests: RouteRequest[], opts: RouterOptions): Record<string, Pt[]> {
  const grid = new Grid(opts)
  const preferred = pickSides(requests)
  const result: Record<string, Pt[]> = {}

  // Short edges first: they stay straight, long ones detour around them.
  const order = [...requests].sort((a, b) => manhattan(a) - manhattan(b))
  for (const r of order) {
    const want = preferred.get(r.id)!
    const budget = manhattan(r) * 1.4 + 40
    let best: { cost: number; ports: Ports; path: Pt[] } | undefined

    // The facing sides are tried first; if they are boxed in or the detour is long, try the others.
    for (const [i, ports] of candidates(r, want).entries()) {
      const found = grid.route(ports.sp, ports.s, ports.tp, ports.t, r.hint)
      if (!found) continue
      const cost = found.cost + (i === 0 ? 0 : 6)
      if (!best || cost < best.cost) best = { cost, ports, path: found.path }
      if (i === 0 && cost <= budget) break
    }
    if (best) {
      result[r.id] = assemble(best.ports, best.path)
      grid.mark(best.path)
    } else result[r.id] = fallback(r)
  }
  return result
}

/** Side pairs to try, the facing pair first, then pairs that turn the corner. */
function candidates(r: RouteRequest, want: Ports): Ports[] {
  const others = (side: Side): Side[] => {
    const perp: Side[] = side === E || side === W ? [N, S] : [E, W]
    return [side, ...perp, ((side + 2) % 4) as Side]
  }
  const mid = (rect: Rect, side: Side): Pt =>
    side === E || side === W
      ? borderPoint(rect, side, Math.round((rect.y + rect.h / 2) / G) * G)
      : borderPoint(rect, side, Math.round((rect.x + rect.w / 2) / G) * G)
  const from = others(want.s)
  const to = others(want.t)
  const out: Ports[] = [want]
  const ranks: [number, number][] = [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 0],
    [0, 2],
    [2, 1],
    [1, 2],
    [3, 0],
    [0, 3],
  ]
  for (const [i, j] of ranks) {
    const s = from[i]!
    const t = to[j]!
    out.push({ s, t, sp: i === 0 ? want.sp : mid(r.from, s), tp: j === 0 ? want.tp : mid(r.to, t) })
  }
  return out
}

function manhattan(r: RouteRequest): number {
  return (
    Math.abs(r.from.x + r.from.w / 2 - (r.to.x + r.to.w / 2)) +
    Math.abs(r.from.y + r.from.h / 2 - (r.to.y + r.to.h / 2))
  )
}

interface Ports {
  s: Side
  t: Side
  sp: Pt
  tp: Pt
}

/** Pick the facing side of each end and spread edges that share a side along it. */
function pickSides(requests: RouteRequest[]): Map<string, Ports> {
  type End = { req: RouteRequest; end: 'from' | 'to'; side: Side; key: string; other: Pt }
  const ends: End[] = []
  for (const req of requests) {
    const a = center(req.from)
    const b = center(req.to)
    const horizontal =
      Math.abs(b.x - a.x) / (req.from.w / 2 + req.to.w / 2) >
      Math.abs(b.y - a.y) / (req.from.h / 2 + req.to.h / 2)
    const sa: Side = horizontal ? (b.x >= a.x ? E : W) : b.y >= a.y ? S : N
    const sb: Side = horizontal ? (b.x >= a.x ? W : E) : b.y >= a.y ? N : S
    ends.push({ req, end: 'from', side: sa, key: `${keyOf(req.from)}:${sa}`, other: b })
    ends.push({ req, end: 'to', side: sb, key: `${keyOf(req.to)}:${sb}`, other: a })
  }
  const byKey = new Map<string, End[]>()
  for (const e of ends) byKey.set(e.key, [...(byKey.get(e.key) ?? []), e])

  const point = new Map<End, Pt>()
  for (const list of byKey.values()) {
    const first = list[0]!
    const rect = first.end === 'from' ? first.req.from : first.req.to
    const vertical = first.side === E || first.side === W
    list.sort((p, q) => (vertical ? p.other.y - q.other.y : p.other.x - q.other.x))
    list.forEach((e, i) => {
      const f = (i + 1) / (list.length + 1)
      const along = vertical ? rect.y + 8 + (rect.h - 16) * f : rect.x + 8 + (rect.w - 16) * f
      const snapped = Math.round(along / G) * G
      const clamped = vertical
        ? clamp(snapped, rect.y + 4, rect.y + rect.h - 4)
        : clamp(snapped, rect.x + 4, rect.x + rect.w - 4)
      point.set(e, borderPoint(rect, e.side, clamped))
    })
  }

  const out = new Map<string, Ports>()
  for (const req of requests) {
    const from = ends.find((e) => e.req === req && e.end === 'from')!
    const to = ends.find((e) => e.req === req && e.end === 'to')!
    out.set(req.id, { s: from.side, t: to.side, sp: point.get(from)!, tp: point.get(to)! })
  }
  return out
}

function keyOf(r: Rect): string {
  return `${r.x},${r.y},${r.w},${r.h}`
}

function center(r: Rect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function borderPoint(r: Rect, side: Side, along: number): Pt {
  switch (side) {
    case E:
      return { x: r.x + r.w, y: along }
    case W:
      return { x: r.x, y: along }
    case S:
      return { x: along, y: r.y + r.h }
    default:
      return { x: along, y: r.y }
  }
}

/** Join border point, grid path and border point; drop redundant collinear points. */
function assemble({ sp, s, tp, t }: Ports, path: Pt[]): Pt[] {
  const pts: Pt[] = [sp, ...path.map((p, i) => align(p, i, path, sp, s, tp, t)), tp]
  return simplify(orthogonalise(pts))
}

/** Pull the first and last grid points onto the port's axis so the stubs are straight. */
function align(p: Pt, i: number, path: Pt[], sp: Pt, s: Side, tp: Pt, t: Side): Pt {
  let out = p
  if (i === 0) out = s === E || s === W ? { x: p.x, y: sp.y } : { x: sp.x, y: p.y }
  if (i === path.length - 1)
    out = t === E || t === W ? { x: out.x, y: tp.y } : { x: tp.x, y: out.y }
  return out
}

/** Insert corners wherever two consecutive points are not axis-aligned. */
function orthogonalise(pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0]!]
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1]!
    const b = pts[i]!
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) out.push({ x: b.x, y: a.y })
    out.push(b)
  }
  return out
}

function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue
    out.push(p)
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3) as [Pt, Pt, Pt]
      const sameX = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5
      const sameY = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5
      if (sameX || sameY) out.splice(out.length - 2, 1)
      else break
    }
  }
  return out
}

function fallback(r: RouteRequest): Pt[] {
  const a = center(r.from)
  const b = center(r.to)
  const mid = { x: b.x, y: a.y }
  return simplify([a, mid, b])
}

class Grid {
  readonly cols: number
  readonly rows: number
  private readonly ox: number
  private readonly oy: number
  private readonly blocked: Uint8Array
  private readonly soft: Uint8Array
  private readonly usedH: Uint8Array
  private readonly usedV: Uint8Array
  private readonly cost: Float32Array

  constructor(opts: RouterOptions) {
    const pad = 3 * G
    this.ox = opts.bounds.x - pad
    this.oy = opts.bounds.y - pad
    this.cols = Math.ceil((opts.bounds.w + pad * 2) / G) + 1
    this.rows = Math.ceil((opts.bounds.h + pad * 2) / G) + 1
    const n = this.cols * this.rows
    this.blocked = new Uint8Array(n)
    this.soft = new Uint8Array(n)
    this.usedH = new Uint8Array(n)
    this.usedV = new Uint8Array(n)
    this.cost = new Float32Array(n * 4)
    for (const r of opts.obstacles) this.fill(this.blocked, r, CLEARANCE)
    for (const r of opts.soft ?? []) this.fill(this.soft, r, 0)
  }

  private fill(layer: Uint8Array, r: Rect, margin: number) {
    const x0 = Math.max(0, Math.floor((r.x - margin - this.ox) / G))
    const x1 = Math.min(this.cols - 1, Math.ceil((r.x + r.w + margin - this.ox) / G))
    const y0 = Math.max(0, Math.floor((r.y - margin - this.oy) / G))
    const y1 = Math.min(this.rows - 1, Math.ceil((r.y + r.h + margin - this.oy) / G))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) layer[y * this.cols + x] = 1
  }

  private cellOf(p: Pt): [number, number] {
    return [Math.round((p.x - this.ox) / G), Math.round((p.y - this.oy) / G)]
  }

  private pointOf(cx: number, cy: number): Pt {
    return { x: this.ox + cx * G, y: this.oy + cy * G }
  }

  /** Route from just outside port `sp` (leaving by `s`) to just outside port `tp` (entered via `t`). */
  route(sp: Pt, s: Side, tp: Pt, t: Side, hint?: Rect): { path: Pt[]; cost: number } | undefined {
    const lead = Math.ceil((CLEARANCE + 2) / G) + 1
    const [sx0, sy0] = this.cellOf(sp)
    const [tx0, ty0] = this.cellOf(tp)
    const sx = sx0 + DX[s]! * lead
    const sy = sy0 + DY[s]! * lead
    const tx = tx0 + DX[t]! * lead
    const ty = ty0 + DY[t]! * lead
    if (!this.inside(sx, sy) || !this.inside(tx, ty)) return undefined

    const cols = this.cols
    const [hx0, hy0] = hint ? this.cellOf({ x: hint.x, y: hint.y }) : [0, 0]
    const [hx1, hy1] = hint
      ? this.cellOf({ x: hint.x + hint.w, y: hint.y + hint.h })
      : [cols, this.rows]
    this.cost.fill(Infinity)
    const heap = new Heap()
    const startState = (sy * cols + sx) * 4 + s
    this.cost[startState] = 0
    heap.push(h(sx, sy, tx, ty), startState)
    const prev = new Map<number, number>()

    let goal = -1
    let goalCost = 0
    while (heap.size) {
      const [, state] = heap.pop()!
      const dir = state & 3
      const cell = state >> 2
      const cx = cell % cols
      const cy = (cell - cx) / cols
      const g = this.cost[state]!
      if (cx === tx && cy === ty) {
        goal = state
        goalCost = g
        break
      }
      for (const nd of [dir, (dir + 1) & 3, (dir + 3) & 3]) {
        const nx = cx + DX[nd]!
        const ny = cy + DY[nd]!
        if (!this.inside(nx, ny)) continue
        const ncell = ny * cols + nx
        const isGoal = nx === tx && ny === ty
        if (this.blocked[ncell] && !isGoal && !(nx === sx && ny === sy)) continue
        let step = 1
        if (nd !== dir) step += TURN
        if (this.soft[ncell]) step += 9
        if (hint && (nx < hx0 || nx > hx1 || ny < hy0 || ny > hy1)) step += 5
        // Sharing a lane with another edge costs a lot; crossing one costs a little.
        step +=
          (nd & 1 ? this.usedV[ncell]! : this.usedH[ncell]!) * 4 +
          (nd & 1 ? this.usedH[ncell]! : this.usedV[ncell]!) * 1.2
        const ns = ncell * 4 + nd
        const ng = g + step
        if (ng < this.cost[ns]!) {
          this.cost[ns] = ng
          prev.set(ns, state)
          heap.push(ng + h(nx, ny, tx, ty), ns)
        }
      }
    }
    if (goal < 0) return undefined

    const cells: Pt[] = []
    for (let st: number | undefined = goal; st !== undefined; st = prev.get(st)) {
      const cell = st >> 2
      const cx = cell % cols
      cells.push(this.pointOf(cx, (cell - cx) / cols))
    }
    return { path: cells.reverse(), cost: goalCost }
  }

  /** Remember the lanes a finished path used. */
  mark(path: Pt[]) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!
      const b = path[i]!
      const horizontal = Math.abs(b.y - a.y) < Math.abs(b.x - a.x)
      const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / G))
      for (let k = 0; k <= steps; k++) {
        const p = { x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps }
        const [cx, cy] = this.cellOf(p)
        if (!this.inside(cx, cy)) continue
        const idx = cy * this.cols + cx
        if (horizontal) this.usedH[idx] = Math.min(255, this.usedH[idx]! + 1)
        else this.usedV[idx] = Math.min(255, this.usedV[idx]! + 1)
      }
    }
  }

  private inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows
  }
}

function h(x: number, y: number, tx: number, ty: number): number {
  return Math.abs(x - tx) + Math.abs(y - ty)
}

/** Minimal binary min-heap of [priority, value]. */
class Heap {
  private readonly a: [number, number][] = []

  get size() {
    return this.a.length
  }

  push(p: number, v: number) {
    const a = this.a
    a.push([p, v])
    let i = a.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (a[parent]![0] <= a[i]![0]) break
      ;[a[parent], a[i]] = [a[i]!, a[parent]!]
      i = parent
    }
  }

  pop(): [number, number] | undefined {
    const a = this.a
    if (!a.length) return undefined
    const top = a[0]!
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l]![0] < a[m]![0]) m = l
        if (r < a.length && a[r]![0] < a[m]![0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i]!, a[m]!]
        i = m
      }
    }
    return top
  }
}

export { polylineLength }
