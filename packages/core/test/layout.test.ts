import { describe, expect, it } from 'vitest'
import { type Layout, layoutView, packGrid, type Rect } from '../src'
import { fakeSizes, loadDocs } from './helpers'

const diagram = loadDocs().diagrams.checkout!

const inside = (inner: Rect, outer: Rect, slack = 1) =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.w <= outer.x + outer.w + slack &&
  inner.y + inner.h <= outer.y + outer.h + slack

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Distance from a point to the outline of a rect. */
function distToBorder(p: { x: number; y: number }, r: Rect) {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w))
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h))
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy)
  return Math.min(p.x - r.x, r.x + r.w - p.x, p.y - r.y, r.y + r.h - p.y)
}

async function layoutOf(viewId: string): Promise<Layout> {
  return layoutView(diagram, viewId, fakeSizes(Object.keys(diagram.nodes)))
}

describe('layout', () => {
  it('places every node of the view without overlaps', async () => {
    const view = diagram.views.find((v) => v.id === 'overview')!
    const layout = await layoutOf('overview')
    expect(Object.keys(layout.nodes).sort()).toEqual([...view.nodeIds].sort())
    const rects = Object.values(layout.nodes)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i]!, rects[j]!)).toBe(false)
    }
  })

  it('keeps nodes inside their groups and nested groups inside parents', async () => {
    const layout = await layoutOf('overview')
    for (const n of Object.values(diagram.nodes)) {
      if (n.group) expect(inside(layout.nodes[n.id]!, layout.groups[n.group]!)).toBe(true)
    }
    expect(inside(layout.groups.data!, layout.groups.backend!)).toBe(true)
  })

  it('routes edges from the source border to the target border (absolute coordinates)', async () => {
    const layout = await layoutOf('overview')
    for (const id of diagram.views.find((v) => v.id === 'overview')!.edgeIds) {
      const e = diagram.edges[id]!
      const l = layout.edges[id]!
      expect(l, `edge ${id}`).toBeDefined()
      expect(distToBorder(l.points[0]!, layout.nodes[e.from]!)).toBeLessThan(2)
      expect(distToBorder(l.points.at(-1)!, layout.nodes[e.to]!)).toBeLessThan(2)
    }
  })

  it('only emits orthogonal segments', async () => {
    const layout = await layoutOf('backend')
    for (const l of Object.values(layout.edges)) {
      for (let i = 1; i < l.points.length; i++) {
        const a = l.points[i - 1]!
        const b = l.points[i]!
        expect(Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeLessThan(0.5)
      }
    }
  })

  it('gives labelled edges a label rect and key', async () => {
    const layout = await layoutOf('overview')
    const labelled = diagram.views
      .find((v) => v.id === 'overview')!
      .edgeIds.filter((id) => diagram.edges[id]!.label)
    for (const id of labelled) expect(layout.edges[id]!.label).toBeDefined()
    expect(layout.edges[labelled[0]!]!.key).toBeDefined()
  })

  it('honours the view direction', async () => {
    const right = await layoutOf('overview')
    const down = await layoutOf('backend')
    expect(right.width).toBeGreaterThan(right.height * 0.6)
    expect(down.height).toBeGreaterThan(0)
  })
})

describe('packGrid', () => {
  it('stretches cells to column width and row height', () => {
    const { rects, w, h } = packGrid(
      [
        { id: 'a', w: 100, h: 40 },
        { id: 'b', w: 140, h: 60 },
        { id: 'c', w: 100, h: 50 },
      ],
      'grid',
      2,
    )
    expect(rects.a).toMatchObject({ x: 0, y: 0, w: 100, h: 60 })
    expect(rects.b).toMatchObject({ x: 110, y: 0, w: 140, h: 60 })
    expect(rects.c).toMatchObject({ x: 0, y: 70, w: 100, h: 50 })
    expect(w).toBe(250)
    expect(h).toBe(120)
  })
})

describe('platform example', () => {
  const platform = loadDocs().diagrams.platform!
  const view = platform.views.find((v) => v.id === 'architecture')!

  async function run(): Promise<Layout> {
    return layoutView(platform, 'architecture', fakeSizes(Object.keys(platform.nodes), 96))
  }

  const segments = (points: { x: number; y: number }[]) =>
    points.slice(1).map((p, i) => [points[i]!, p] as const)
  const strictlyInside = (a: { x: number; y: number }, b: { x: number; y: number }, r: Rect) =>
    Math.max(a.x, b.x) > r.x + 2 &&
    Math.min(a.x, b.x) < r.x + r.w - 2 &&
    Math.max(a.y, b.y) > r.y + 2 &&
    Math.min(a.y, b.y) < r.y + r.h - 2

  it('places every node once, without overlaps', async () => {
    const layout = await run()
    expect(Object.keys(layout.nodes).sort()).toEqual([...view.nodeIds].sort())
    const rects = Object.entries(layout.nodes)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++)
        expect(overlaps(rects[i]![1], rects[j]![1]), `${rects[i]![0]} / ${rects[j]![0]}`).toBe(
          false,
        )
    }
  })

  it('keeps every node inside all of its groups', async () => {
    const layout = await run()
    for (const n of Object.values(platform.nodes)) {
      for (let g = n.group; g; g = platform.groups[g]?.parent) {
        expect(inside(layout.nodes[n.id]!, layout.groups[g]!), `${n.id} in ${g}`).toBe(true)
      }
    }
  })

  it('lays rows out as written', async () => {
    const layout = await run()
    const ys = ['identity-svc', 'control-api', 'backend'].map((id) => layout.nodes[id]!.y)
    expect(new Set(ys).size).toBe(1)
    expect(layout.nodes.proxy!.y).toBeLessThan(layout.nodes['control-api']!.y)
    expect(layout.nodes['control-api']!.y).toBeLessThan(layout.nodes.libs!.y)
    // Left to right in the order given.
    const xs = ['identity-svc', 'control-api', 'backend'].map((id) => layout.nodes[id]!.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })

  it('routes every edge, including hidden ones, with orthogonal segments', async () => {
    const layout = await run()
    for (const id of view.edgeIds) {
      const e = layout.edges[id]
      expect(e, `edge ${id}`).toBeDefined()
      for (const [a, b] of segments(e!.points))
        expect(Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeLessThan(0.6)
    }
  })

  it('does not run edges through nodes they do not connect', async () => {
    const layout = await run()
    const bad: string[] = []
    for (const id of view.edgeIds) {
      const edge = platform.edges[id]!
      const packedEnds = new Set(
        [edge.from, edge.to].map((n) => platform.nodes[n]!.group).filter(Boolean),
      )
      for (const [nid, r] of Object.entries(layout.nodes)) {
        if (nid === edge.from || nid === edge.to) continue
        // Cards inside a packed group are reached through the group's border.
        if (
          packedEnds.has(platform.nodes[nid]!.group) &&
          platform.groups[platform.nodes[nid]!.group!]!.layout !== 'flow'
        )
          continue
        if (segments(layout.edges[id]!.points).some(([a, b]) => strictlyInside(a, b, r)))
          bad.push(`${id} through ${nid}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('ends edges on the border of their nodes (or packed group)', async () => {
    const layout = await run()
    for (const id of view.edgeIds) {
      const edge = platform.edges[id]!
      const target = (n: string) => {
        const g = platform.nodes[n]!.group
        return g && ['row', 'grid'].includes(platform.groups[g]!.layout)
          ? layout.groups[g]!
          : layout.nodes[n]!
      }
      const pts = layout.edges[id]!.points
      expect(distToBorder(pts[0]!, target(edge.from)), `${id} start`).toBeLessThan(3)
      expect(distToBorder(pts.at(-1)!, target(edge.to)), `${id} end`).toBeLessThan(3)
    }
  })

  it('fits the canvas around every edge and label', async () => {
    const layout = await run()
    for (const e of Object.values(layout.edges)) {
      for (const p of e.points) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(layout.width)
        expect(p.y).toBeLessThanOrEqual(layout.height)
      }
      if (e.label) expect(e.label.x + e.label.w).toBeLessThanOrEqual(layout.width + 1)
    }
  })

  it('is smaller than a single-direction layout of the same model would be', async () => {
    const layout = await run()
    expect(layout.width * layout.height).toBeLessThan(3200 * 1100)
  })
})
