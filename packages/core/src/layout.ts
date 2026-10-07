import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api'
import { DEFAULT_NODE_WIDTH } from './defaults'
import { polylineLength } from './geometry'
import { type RouteRequest, routeEdges } from './route'
import type {
  CompiledDiagram,
  CompiledEdge,
  CompiledGroup,
  CompiledNode,
  CompiledView,
  Layout,
  Pt,
  Rect,
} from './types'

/*
 * Layout works group by group, bottom up.
 *
 * Every group lays out its own members and reports a size; its parent treats it as one block.
 *   flow   members are arranged by ELK (RIGHT or DOWN, whichever comes out squarer)
 *   rows   members sit in explicit rows the author wrote down
 *   row / grid   members are packed tightly, for stores and other cards that need no arrows
 * The zones and any ungrouped nodes are then arranged by one more ELK run.
 *
 * ELK routes only the edges it can see end to end. Everything that crosses a block boundary,
 * or touches a block's members, is routed afterwards by a small obstacle-avoiding orthogonal
 * router, so arrows end on the real node. A single ELK run over the whole hierarchy would force
 * one direction on every zone and makes platform-style diagrams several times wider than needed.
 */

export interface NodeSize {
  w: number
  h: number
}

const FALLBACK_HEIGHT = 72
const GRID_GAP = 10
const ROWS_HGAP = 32
const ROWS_VGAP = 44
const ZONE_PAD = { top: 38, left: 14, bottom: 14, right: 14 }
const FRAME_PAD = { top: 32, left: 11, bottom: 11, right: 11 }
const ROOT_PAD = 12
/** Size of a typical documentation column; used to choose between RIGHT and DOWN. */
const TARGET = { w: 1180, h: 720 }

type Axis = 'RIGHT' | 'DOWN' | 'LEFT' | 'UP'

let elk: InstanceType<typeof ELK> | undefined

const nodeKey = (id: string) => `n:${id}`
const groupKey = (id: string) => `g:${id}`
const padOption = (p: typeof ZONE_PAD) =>
  `[top=${p.top},left=${p.left},bottom=${p.bottom},right=${p.right}]`
const padOf = (g: CompiledGroup) => (g.style === 'zone' ? ZONE_PAD : FRAME_PAD)

const BASE_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'ORTHOGONAL',
  // Declaration order decides which edges are "backwards" and how nodes sit within a layer,
  // so reordering the YAML reorders the picture.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  // Edge coordinates relative to the root rather than to each edge's container.
  'elk.json.edgeCoords': 'ROOT',
  'elk.spacing.nodeNode': '20',
  'elk.spacing.edgeNode': '16',
  'elk.spacing.edgeEdge': '10',
  'elk.layered.spacing.nodeNodeBetweenLayers': '56',
  'elk.layered.spacing.edgeNodeBetweenLayers': '18',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
}

/** Geometry of a laid-out group, relative to its own top-left corner. */
interface Inner {
  w: number
  h: number
  nodes: Record<string, Rect>
  groups: Record<string, Rect>
  /** Edges this group's own layout already routed. */
  edges: Record<string, Pt[]>
}

interface Ctx {
  diagram: CompiledDiagram
  view: CompiledView
  edges: CompiledEdge[]
  sizeOf: (n: CompiledNode) => NodeSize
  childNodes: Map<string, CompiledNode[]>
  childGroups: Map<string, CompiledGroup[]>
  rootNodes: CompiledNode[]
  rootGroups: CompiledGroup[]
  /** Tightly packed groups. Arrows end on the group, not on the cards inside. */
  packed: Map<string, { rects: Record<string, Rect>; w: number; h: number }>
  /** Node to the packed group that holds it. */
  packedOf: Map<string, string>
  /** Node to its top-level entity (`n:id` or `g:id`). */
  top: Map<string, string>
  cache: Map<string, Promise<Inner>>
}

interface Draft {
  width: number
  height: number
  nodes: Record<string, Rect>
  groups: Record<string, Rect>
  edges: Record<string, Pt[]>
}

export async function layoutView(
  diagram: CompiledDiagram,
  viewId: string,
  sizes: Record<string, Partial<NodeSize>> = {},
): Promise<Layout> {
  const view = diagram.views.find((v) => v.id === viewId)
  if (!view) throw new Error(`Unknown view "${viewId}"`)
  const ctx = makeContext(diagram, view, sizes)
  const zones = new Map<string, Inner>()
  await Promise.all(
    ctx.rootGroups.map(async (g) => {
      zones.set(g.id, await layoutGroup(ctx, g))
    }),
  )

  let draft: Draft
  if (view.direction === 'AUTO') {
    const [right, down] = await Promise.all([
      compose(ctx, zones, 'RIGHT'),
      compose(ctx, zones, 'DOWN'),
    ])
    const scale = (d: Draft) => Math.min(TARGET.w / d.width, TARGET.h / d.height, 1)
    draft = scale(down) > scale(right) * 1.08 ? down : right
  } else {
    draft = await compose(ctx, zones, view.direction)
  }
  return finish(ctx, draft)
}

function makeContext(
  diagram: CompiledDiagram,
  view: CompiledView,
  sizes: Record<string, Partial<NodeSize>>,
): Ctx {
  const nodeIds = new Set(view.nodeIds)
  const groupIds = new Set(view.groupIds)
  const sizeOf = (n: CompiledNode): NodeSize => ({
    w: sizes[n.id]?.w ?? n.w ?? DEFAULT_NODE_WIDTH,
    h: sizes[n.id]?.h ?? FALLBACK_HEIGHT,
  })

  const childNodes = new Map<string, CompiledNode[]>()
  const childGroups = new Map<string, CompiledGroup[]>()
  const rootNodes: CompiledNode[] = []
  const rootGroups: CompiledGroup[] = []
  for (const id of nodeIds) {
    const n = diagram.nodes[id]!
    if (n.group && groupIds.has(n.group)) push(childNodes, n.group, n)
    else rootNodes.push(n)
  }
  for (const id of groupIds) {
    const g = diagram.groups[id]!
    if (g.parent && groupIds.has(g.parent)) push(childGroups, g.parent, g)
    else rootGroups.push(g)
  }

  const packed: Ctx['packed'] = new Map()
  const packedOf = new Map<string, string>()
  for (const id of groupIds) {
    const g = diagram.groups[id]!
    if ((g.layout !== 'row' && g.layout !== 'grid') || (childGroups.get(id)?.length ?? 0) > 0)
      continue
    const kids = childNodes.get(id) ?? []
    const pad = padOf(g)
    const grid = packGrid(
      kids.map((k) => ({ id: k.id, ...sizeOf(k) })),
      g.layout,
      g.columns,
    )
    packed.set(id, {
      rects: grid.rects,
      w: grid.w + pad.left + pad.right,
      h: grid.h + pad.top + pad.bottom,
    })
    for (const k of kids) packedOf.set(k.id, id)
  }

  const top = new Map<string, string>()
  for (const id of nodeIds) {
    let g = diagram.nodes[id]!.group
    let root: string | undefined
    while (g && groupIds.has(g)) {
      root = g
      g = diagram.groups[g]!.parent
    }
    top.set(id, root ? groupKey(root) : nodeKey(id))
  }

  return {
    diagram,
    view,
    edges: view.edgeIds.map((id) => diagram.edges[id]!).filter(Boolean),
    sizeOf,
    childNodes,
    childGroups,
    rootNodes,
    rootGroups,
    packed,
    packedOf,
    top,
    cache: new Map(),
  }
}

/** Lay a group out as its own little diagram. Memoised: a group is only laid out once. */
function layoutGroup(ctx: Ctx, g: CompiledGroup): Promise<Inner> {
  let p = ctx.cache.get(g.id)
  if (!p) {
    p =
      g.layout === 'row' || g.layout === 'grid'
        ? Promise.resolve(packedInner(ctx, g))
        : g.layout === 'rows'
          ? layoutRows(ctx, g)
          : layoutFlow(ctx, g)
    ctx.cache.set(g.id, p)
  }
  return p
}

function packedInner(ctx: Ctx, g: CompiledGroup): Inner {
  const block = ctx.packed.get(g.id)
  if (!block) return layoutEmpty(g)
  const pad = padOf(g)
  const nodes: Record<string, Rect> = {}
  for (const [id, r] of Object.entries(block.rects))
    nodes[id] = { x: pad.left + r.x, y: pad.top + r.y, w: r.w, h: r.h }
  return {
    w: block.w,
    h: block.h,
    nodes,
    groups: { [g.id]: { x: 0, y: 0, w: block.w, h: block.h } },
    edges: {},
  }
}

function layoutEmpty(g: CompiledGroup): Inner {
  const pad = padOf(g)
  const w = pad.left + pad.right + 120
  const h = pad.top + pad.bottom + 20
  return { w, h, nodes: {}, groups: { [g.id]: { x: 0, y: 0, w, h } }, edges: {} }
}

type Item =
  | { kind: 'node'; id: string; w: number; h: number }
  | { kind: 'group'; id: string; inner: Inner; w: number; h: number }

/** Author-written rows, each spread across the full width of the group. */
async function layoutRows(ctx: Ctx, g: CompiledGroup): Promise<Inner> {
  const pad = padOf(g)
  const nodesHere = new Map((ctx.childNodes.get(g.id) ?? []).map((n) => [n.id, n]))
  const groupsHere = new Map((ctx.childGroups.get(g.id) ?? []).map((c) => [c.id, c]))

  const spec: string[][] = []
  const used = new Set<string>()
  for (const row of g.rows ?? []) {
    const ids = row.filter((id) => (nodesHere.has(id) || groupsHere.has(id)) && !used.has(id))
    for (const id of ids) used.add(id)
    if (ids.length) spec.push(ids)
  }
  for (const id of [...groupsHere.keys(), ...nodesHere.keys()]) if (!used.has(id)) spec.push([id])

  const rows: Item[][] = []
  for (const ids of spec) {
    const items: Item[] = []
    for (const id of ids) {
      const n = nodesHere.get(id)
      if (n) {
        const s = ctx.sizeOf(n)
        items.push({ kind: 'node', id, w: s.w, h: s.h })
      } else {
        const inner = await layoutGroup(ctx, groupsHere.get(id)!)
        items.push({ kind: 'group', id, inner, w: inner.w, h: inner.h })
      }
    }
    rows.push(items)
  }

  const rowWidth = (items: Item[]) =>
    items.reduce((s, i) => s + i.w, 0) + ROWS_HGAP * (items.length - 1)
  const contentW = Math.max(0, ...rows.map(rowWidth))
  const out: Inner = { w: 0, h: 0, nodes: {}, groups: {}, edges: {} }

  let y = pad.top
  for (const items of rows) {
    const rowH = Math.max(...items.map((i) => i.h))
    const extra = (contentW - rowWidth(items)) / items.length
    let x = pad.left
    for (const item of items) {
      const w = item.w + extra
      if (item.kind === 'node') out.nodes[item.id] = { x, y, w, h: rowH }
      else {
        merge(out, item.inner, x, y)
        out.groups[item.id] = { x, y, w, h: rowH }
      }
      x += w + ROWS_HGAP
    }
    y += rowH + ROWS_VGAP
  }
  out.w = pad.left + contentW + pad.right
  out.h = Math.max(y - ROWS_VGAP, pad.top) + pad.bottom
  out.groups[g.id] = { x: 0, y: 0, w: out.w, h: out.h }
  return out
}

/** Add a child's geometry at an offset. */
function merge(into: Inner, child: Inner, dx: number, dy: number) {
  for (const [id, r] of Object.entries(child.nodes)) into.nodes[id] = shift(r, dx, dy)
  for (const [id, r] of Object.entries(child.groups)) into.groups[id] = shift(r, dx, dy)
  for (const [id, pts] of Object.entries(child.edges))
    into.edges[id] = pts.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

function shift(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }
}

async function layoutFlow(ctx: Ctx, zone: CompiledGroup): Promise<Inner> {
  // Non-flow groups below a flow group are laid out first and enter ELK as fixed-size blocks.
  const blocks = new Map<string, Inner>()
  const gather = async (g: CompiledGroup) => {
    for (const child of ctx.childGroups.get(g.id) ?? []) {
      if (child.layout === 'flow') await gather(child)
      else blocks.set(child.id, await layoutGroup(ctx, child))
    }
  }
  await gather(zone)

  const choices: Axis[] =
    zone.direction === 'RIGHT' || zone.direction === 'DOWN' ? [zone.direction] : ['DOWN', 'RIGHT']
  const attempts = await Promise.all(choices.map((dir) => runFlow(ctx, zone, dir, blocks)))
  // Prefer the squarer zone: it composes better with its neighbours.
  const squareness = (i: Inner) => Math.abs(Math.log(i.w / i.h))
  return attempts.reduce((best, cur) => (squareness(cur) < squareness(best) - 0.05 ? cur : best))
}

/** Outermost non-flow group between a node and `root`, if any. */
function blockWithin(ctx: Ctx, nodeId: string, root: string): string | undefined {
  let found: string | undefined
  for (
    let g = ctx.diagram.nodes[nodeId]!.group;
    g && g !== root;
    g = ctx.diagram.groups[g]?.parent
  ) {
    if (ctx.diagram.groups[g]!.layout !== 'flow') found = g
  }
  return found
}

async function runFlow(
  ctx: Ctx,
  zone: CompiledGroup,
  dir: Axis,
  blocks: Map<string, Inner>,
): Promise<Inner> {
  const inZone = (nodeId: string) =>
    ctx.top.get(nodeId) === groupKey(zone.id) || isWithin(ctx, nodeId, zone.id)
  const end = (nodeId: string) => {
    const block = blockWithin(ctx, nodeId, zone.id)
    return block ? { id: groupKey(block), inBlock: true } : { id: nodeKey(nodeId), inBlock: false }
  }

  const elkEdges: ElkExtendedEdge[] = []
  const used = new Set<string>()
  for (const e of ctx.edges) {
    if (e.hidden || !inZone(e.from) || !inZone(e.to)) continue
    const a = end(e.from)
    const b = end(e.to)
    if (a.id === b.id) continue
    // Edges that reach into a block only guide the placement; the router draws them later.
    const guide = a.inBlock || b.inBlock
    elkEdges.push({ id: `${guide ? 'p' : 'e'}:${e.id}`, sources: [a.id], targets: [b.id] })
    used.add(a.id)
    used.add(b.id)
  }

  const build = (g: CompiledGroup): ElkNode => {
    const block = blocks.get(g.id)
    if (block) return { id: groupKey(g.id), width: block.w, height: block.h }
    return {
      id: groupKey(g.id),
      layoutOptions: { 'elk.padding': padOption(padOf(g)) },
      children: [
        ...(ctx.childGroups.get(g.id) ?? []).map(build),
        ...(ctx.childNodes.get(g.id) ?? []).map(leaf),
      ],
    }
  }
  const leaf = (n: CompiledNode): ElkNode => {
    const s = ctx.sizeOf(n)
    return { id: nodeKey(n.id), width: s.w, height: s.h }
  }
  // Cards with no arrows in this zone would all land in the first layer; park them in the last.
  const parked = (node: ElkNode): ElkNode =>
    used.has(node.id)
      ? node
      : {
          ...node,
          layoutOptions: { ...node.layoutOptions, 'elk.layered.layering.layerConstraint': 'LAST' },
        }

  const graph: ElkNode = {
    id: 'zone',
    layoutOptions: { ...BASE_OPTIONS, 'elk.direction': dir, 'elk.padding': padOption(padOf(zone)) },
    children: [
      ...(ctx.childGroups.get(zone.id) ?? []).map((g) => parked(build(g))),
      ...(ctx.childNodes.get(zone.id) ?? []).map((n) => parked(leaf(n))),
    ],
    edges: elkEdges,
  }
  elk ??= new ELK()
  const result = await elk.layout(graph)

  const w = Math.ceil(result.width ?? 0)
  const h = Math.ceil(result.height ?? 0)
  const inner: Inner = { w, h, nodes: {}, groups: { [zone.id]: { x: 0, y: 0, w, h } }, edges: {} }
  collect(ctx, result, 0, 0, inner, blocks)
  for (const e of result.edges ?? []) {
    if (!e.id.startsWith('e:')) continue
    const pts = sectionPoints(e as ElkExtendedEdge)
    if (pts) inner.edges[e.id.slice(2)] = pts
  }
  return inner
}

function isWithin(ctx: Ctx, nodeId: string, groupId: string): boolean {
  for (let g = ctx.diagram.nodes[nodeId]!.group; g; g = ctx.diagram.groups[g]?.parent)
    if (g === groupId) return true
  return false
}

/** Read rectangles out of an ELK result, dropping in the pre-laid blocks. */
function collect(
  ctx: Ctx,
  parent: ElkNode,
  ox: number,
  oy: number,
  into: Inner,
  blocks: Map<string, Inner>,
) {
  for (const c of parent.children ?? []) {
    const x = ox + (c.x ?? 0)
    const y = oy + (c.y ?? 0)
    if (c.id.startsWith('n:')) {
      into.nodes[c.id.slice(2)] = { x, y, w: c.width ?? 0, h: c.height ?? 0 }
      continue
    }
    const gid = c.id.slice(2)
    const block = blocks.get(gid)
    if (block) merge(into, block, x, y)
    else {
      into.groups[gid] = { x, y, w: c.width ?? 0, h: c.height ?? 0 }
      collect(ctx, c, x, y, into, blocks)
    }
  }
}

function sectionPoints(e: ElkExtendedEdge): Pt[] | undefined {
  const s = e.sections?.[0]
  return s ? [s.startPoint, ...(s.bendPoints ?? []), s.endPoint] : undefined
}

type Entry =
  | { kind: 'node'; node: CompiledNode; at: number }
  | { kind: 'group'; group: CompiledGroup; at: number }

/** Top-level groups and loose nodes, in the order their first member was declared. */
function topLevel(ctx: Ctx): Entry[] {
  const order = new Map(Object.keys(ctx.diagram.nodes).map((id, i) => [id, i]))
  const first = (g: CompiledGroup): number => {
    let at = Number.POSITIVE_INFINITY
    for (const [id, top] of ctx.top)
      if (top === groupKey(g.id)) at = Math.min(at, order.get(id) ?? at)
    return at
  }
  return [
    ...ctx.rootGroups.map((group): Entry => ({ kind: 'group', group, at: first(group) })),
    ...ctx.rootNodes.map(
      (node): Entry => ({ kind: 'node', node, at: order.get(node.id) ?? Number.POSITIVE_INFINITY }),
    ),
  ].sort((a, b) => a.at - b.at)
}

/** Arrange zones and ungrouped nodes. */
async function compose(ctx: Ctx, zones: Map<string, Inner>, direction: Axis): Promise<Draft> {
  const macroEdges: ElkExtendedEdge[] = []
  const seen = new Set<string>()
  const looseEdges = new Set<string>()
  for (const e of ctx.edges) {
    if (e.hidden) continue
    const a = ctx.top.get(e.from)!
    const b = ctx.top.get(e.to)!
    if (a === b) continue
    if (a.startsWith('n:') && b.startsWith('n:')) {
      macroEdges.push({ id: `e:${e.id}`, sources: [a], targets: [b] })
      looseEdges.add(e.id)
    } else if (!seen.has(`${a}>${b}`)) {
      seen.add(`${a}>${b}`)
      macroEdges.push({ id: `m:${a}>${b}`, sources: [a], targets: [b] })
    }
  }

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      ...BASE_OPTIONS,
      'elk.direction': direction,
      'elk.padding': padOption({
        top: ROOT_PAD,
        left: ROOT_PAD,
        bottom: ROOT_PAD,
        right: ROOT_PAD,
      }),
    },
    children: topLevel(ctx).map((entry) => {
      if (entry.kind === 'node') {
        const s = ctx.sizeOf(entry.node)
        return { id: nodeKey(entry.node.id), width: s.w, height: s.h }
      }
      const z = zones.get(entry.group.id)!
      return { id: groupKey(entry.group.id), width: z.w, height: z.h }
    }),
    edges: macroEdges,
  }
  elk ??= new ELK()
  const result = await elk.layout(graph)

  const draft: Draft = {
    width: Math.ceil(result.width ?? 0),
    height: Math.ceil(result.height ?? 0),
    nodes: {},
    groups: {},
    edges: {},
  }
  const into: Inner = { w: 0, h: 0, nodes: draft.nodes, groups: draft.groups, edges: draft.edges }
  for (const c of result.children ?? []) {
    const x = c.x ?? 0
    const y = c.y ?? 0
    if (c.id.startsWith('n:'))
      draft.nodes[c.id.slice(2)] = { x, y, w: c.width ?? 0, h: c.height ?? 0 }
    else merge(into, zones.get(c.id.slice(2))!, x, y)
  }
  for (const e of result.edges ?? []) {
    if (!e.id.startsWith('e:') || !looseEdges.has(e.id.slice(2))) continue
    const pts = sectionPoints(e as ElkExtendedEdge)
    if (pts) draft.edges[e.id.slice(2)] = pts
  }
  return draft
}

/** Route every edge nobody has routed yet, then place labels. */
function finish(ctx: Ctx, draft: Draft): Layout {
  const layout: Layout = {
    width: draft.width,
    height: draft.height,
    nodes: draft.nodes,
    groups: draft.groups,
    edges: {},
  }

  const anchor = (nodeId: string): Rect | undefined => {
    const wrap = ctx.packedOf.get(nodeId)
    return wrap ? draft.groups[wrap] : draft.nodes[nodeId]
  }

  const pending: RouteRequest[] = []
  for (const e of ctx.edges) {
    if (draft.edges[e.id]) continue
    const from = anchor(e.from)
    const to = anchor(e.to)
    if (!from || !to) continue
    if (from === to) {
      // Two cards inside one packed group.
      const a = draft.nodes[e.from]
      const b = draft.nodes[e.to]
      if (a && b) draft.edges[e.id] = straightBetween(a, b)
      continue
    }
    pending.push({ id: e.id, from, to, hint: commonGroup(ctx, draft, e) })
  }

  const obstacles = new Map<string, Rect>()
  for (const id of Object.keys(draft.nodes)) {
    const wrap = ctx.packedOf.get(id)
    obstacles.set(
      wrap ? groupKey(wrap) : nodeKey(id),
      wrap ? draft.groups[wrap]! : draft.nodes[id]!,
    )
  }
  const soft = Object.values(draft.groups).map((g) => ({
    x: g.x,
    y: g.y,
    w: Math.min(g.w, 360),
    h: 30,
  }))

  const routed = pending.length
    ? routeEdges(pending, {
        bounds: { x: 0, y: 0, w: draft.width, h: draft.height },
        obstacles: [...obstacles.values()],
        soft,
      })
    : {}

  for (const [id, pts] of Object.entries({ ...draft.edges, ...routed })) {
    layout.edges[id] = { points: pts, length: polylineLength(pts) }
  }
  placeLabels(
    layout,
    ctx.edges.filter((e) => !e.hidden),
    ctx.view.keys,
  )
  fitBounds(layout)
  return layout
}

/** The smallest group that contains both ends of an edge. */
function commonGroup(ctx: Ctx, draft: Draft, e: CompiledEdge): Rect | undefined {
  const chain = (nodeId: string) => {
    const out: string[] = []
    for (let g = ctx.diagram.nodes[nodeId]?.group; g; g = ctx.diagram.groups[g]?.parent) out.push(g)
    return out
  }
  const mine = new Set(chain(e.from))
  const shared = chain(e.to).find((g) => mine.has(g))
  return shared ? draft.groups[shared] : undefined
}

/** Routes and labels can stray past the zones; grow the canvas (and shift it) to hold them. */
function fitBounds(layout: Layout) {
  const pad = 10
  let minX = 0
  let minY = 0
  let maxX = layout.width
  let maxY = layout.height
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const e of Object.values(layout.edges)) {
    for (const p of e.points) grow(p.x, p.y)
    if (e.label) {
      grow(e.label.x, e.label.y)
      grow(e.label.x + e.label.w, e.label.y + e.label.h)
    }
  }
  const dx = minX < pad ? pad - minX : 0
  const dy = minY < pad ? pad - minY : 0
  if (dx || dy) {
    for (const r of [...Object.values(layout.nodes), ...Object.values(layout.groups)]) {
      r.x += dx
      r.y += dy
    }
    for (const e of Object.values(layout.edges)) {
      for (const p of e.points) {
        p.x += dx
        p.y += dy
      }
      if (e.label) {
        e.label.x += dx
        e.label.y += dy
      }
      if (e.key) {
        e.key.x += dx
        e.key.y += dy
      }
    }
  }
  layout.width = Math.ceil(Math.max(layout.width + dx, maxX + dx + pad))
  layout.height = Math.ceil(Math.max(layout.height + dy, maxY + dy + pad))
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

interface Cell {
  id: string
  w: number
  h: number
}

/** Pack equal-width columns and equal-height rows, stretching cells to fill them. */
export function packGrid(
  cells: Cell[],
  layout: 'row' | 'grid',
  columns?: number,
): { rects: Record<string, Rect>; w: number; h: number } {
  const cols = Math.max(1, columns ?? (layout === 'row' ? Math.min(cells.length, 5) : 2))
  const rows = Math.ceil(cells.length / cols)
  const colW: number[] = Array(cols).fill(0)
  const rowH: number[] = Array(rows).fill(0)
  cells.forEach((c, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    colW[col] = Math.max(colW[col]!, c.w)
    rowH[row] = Math.max(rowH[row]!, c.h)
  })
  const rects: Record<string, Rect> = {}
  cells.forEach((c, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = colW.slice(0, col).reduce((s, v) => s + v + GRID_GAP, 0)
    const y = rowH.slice(0, row).reduce((s, v) => s + v + GRID_GAP, 0)
    rects[c.id] = { x, y, w: colW[col]!, h: rowH[row]! }
  })
  const w = colW.reduce((s, v) => s + v, 0) + GRID_GAP * Math.max(0, cols - 1)
  const h = rowH.reduce((s, v) => s + v, 0) + GRID_GAP * Math.max(0, rows - 1)
  return { rects, w, h }
}

function straightBetween(a: Rect, b: Rect): Pt[] {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (overlapX > 12) {
    const x = Math.max(a.x, b.x) + overlapX / 2
    const down = a.y < b.y
    return [
      { x, y: down ? a.y + a.h : a.y },
      { x, y: down ? b.y : b.y + b.h },
    ]
  }
  if (overlapY > 12) {
    const y = Math.max(a.y, b.y) + overlapY / 2
    const right = a.x < b.x
    return [
      { x: right ? a.x + a.w : a.x, y },
      { x: right ? b.x : b.x + b.w, y },
    ]
  }
  const start = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
  const end = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  return [start, { x: end.x, y: start.y }, end]
}

const LABEL_H = 18
const KEY_W = 20

export function labelWidth(text: string | undefined, hasKey: boolean): number {
  const textW = text ? text.length * 6.2 + 10 : 0
  return textW + (hasKey ? KEY_W + (text ? 2 : 0) : 0)
}

/**
 * Put each label (and letter key) on the longest free stretch of its edge. Labels are
 * rects centred on the line; the renderer draws them with a halo so crossing is fine.
 */
function placeLabels(layout: Layout, edges: CompiledEdge[], keys: Record<string, string>) {
  const placed: Rect[] = []
  // Zone captions are obstacles too: a label sitting on one is unreadable.
  const headers = Object.values(layout.groups).map((g) => ({
    x: g.x,
    y: g.y,
    w: Math.min(g.w, 340),
    h: 28,
  }))
  const nodeRects = [...Object.values(layout.nodes), ...headers]
  const hits = (r: Rect) =>
    placed.some((p) => overlap(p, r, 3)) || nodeRects.some((n) => overlap(n, r, 0))

  for (const e of edges) {
    const el = layout.edges[e.id]
    if (!el) continue
    const key = keys[e.id]
    if (!e.label && !key) continue
    const w = labelWidth(e.label, !!key)
    const segs = el.points
      .slice(1)
      .map((p, i) => ({ a: el.points[i]!, b: p }))
      .map((s) => ({ ...s, len: Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) }))
      .sort((s1, s2) => s2.len - s1.len)

    let best: Rect | undefined
    search: for (const s of segs.slice(0, 3)) {
      const horizontal = Math.abs(s.b.y - s.a.y) < Math.abs(s.b.x - s.a.x)
      for (const t of [0.5, 0.3, 0.7, 0.18, 0.82]) {
        const cx = s.a.x + (s.b.x - s.a.x) * t
        const cy = s.a.y + (s.b.y - s.a.y) * t
        const cands: Rect[] = horizontal
          ? [
              { x: cx - w / 2, y: cy - LABEL_H - 3, w, h: LABEL_H },
              { x: cx - w / 2, y: cy + 3, w, h: LABEL_H },
            ]
          : [
              { x: cx + 6, y: cy - LABEL_H / 2, w, h: LABEL_H },
              { x: cx - 6 - w, y: cy - LABEL_H / 2, w, h: LABEL_H },
            ]
        for (const c of cands) {
          if (!best) best = c
          if (!hits(c)) {
            best = c
            break search
          }
        }
      }
    }
    if (!best) continue
    placed.push(best)
    el.label = best
    if (key) el.key = { x: best.x + KEY_W / 2, y: best.y + best.h / 2 }
  }
}

function overlap(a: Rect, b: Rect, pad: number): boolean {
  return (
    a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y
  )
}
