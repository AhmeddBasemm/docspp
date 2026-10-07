import type {
  CompiledDiagram,
  CompiledScenario,
  CompiledStep,
  IconData,
  Status,
  StepKind,
} from './types'

/*
 * The story view: a scenario laid out as swimlanes.
 *
 * Columns are lanes (one per node, or several nodes grouped), rows run top to bottom in step
 * order, and horizontal bands are the scenario's phases. Each step becomes a box in the lane
 * where it happens:
 *
 *   at X: ...        a box in X's lane
 *   A -> B: ...      a box in B's lane, reached from the box before it
 *   A -> B (lookup)  a dashed side box in B's lane, level with the box that asked, joined by a
 *                    double-headed dotted arrow; the answer that follows is folded into it
 *
 * When a step starts somewhere other than where the story currently is (the first step, or
 * after a hand-off), a small origin box shows where it begins.
 */

export interface StoryLane {
  index: number
  title: string
  sub?: string
  nodes: string[]
  icons: IconData[]
}

export type StoryRole = 'main' | 'origin' | 'lookup'

export interface StoryBox {
  id: string
  /** Step that created the box. */
  step: number
  /** Every step the box stands for (a lookup also stands for its answer). */
  steps: number[]
  lane: number
  /** Story row, 0-based. A lookup shares the row of the box that asked. */
  row: number
  phase: number
  role: StoryRole
  /** Number shown in the box, counted along the story; lookups and origin boxes have none. */
  n?: number
  title: string
  detail?: string
  kind: StepKind
  status: Status
  icon?: IconData
}

export interface StoryLink {
  from: string
  to: string
  kind: StepKind
  style: 'flow' | 'lookup'
  /** Step the connector belongs to; it lights up once that step has run. */
  step: number
}

export interface StoryPhase {
  index: number
  title: string
  caption?: string
  rowStart: number
  rowEnd: number
}

export interface StoryModel {
  lanes: StoryLane[]
  boxes: StoryBox[]
  links: StoryLink[]
  phases: StoryPhase[]
  rows: number
}

export function buildStory(diagram: CompiledDiagram, scenario: CompiledScenario): StoryModel {
  const steps = scenario.steps
  const nodeTitle = (id: string) => diagram.nodes[id]?.title ?? id
  // Self steps default to the `event` kind (it colours their caption in the flow view); in a
  // story they are ordinary steps of the request.
  const kindOf = (s: CompiledStep): StepKind =>
    s.type === 'self' && s.kind === 'event' ? 'request' : s.kind

  const lanes = buildLanes(diagram, scenario)
  const laneOf = new Map<string, number>()
  for (const lane of lanes) for (const id of lane.nodes) laneOf.set(id, lane.index)

  const boxes: StoryBox[] = []
  const links: StoryLink[] = []
  const skip = new Set<number>()
  let rows = 0
  let counter = 0
  let prev: StoryBox | undefined
  /** The latest main box in each lane, so a lookup can find who asked. */
  const lastInLane = new Map<number, StoryBox>()

  const add = (box: Omit<StoryBox, 'id'>): StoryBox => {
    const made = { ...box, id: `b${boxes.length}` }
    boxes.push(made)
    return made
  }
  // Boxes are numbered 1, 2, 3... in the order the story reads. Lookups and origins carry no number.
  const mainBox = (box: Omit<StoryBox, 'id' | 'row' | 'n'>): StoryBox => {
    const made = add({ ...box, row: rows++, n: box.role === 'main' ? ++counter : undefined })
    lastInLane.set(made.lane, made)
    return made
  }
  const advance = (to: StoryBox, kind: StepKind, step: number) => {
    if (prev) links.push({ from: prev.id, to: to.id, kind, style: 'flow', step })
    prev = to
  }

  steps.forEach((s, i) => {
    if (skip.has(i)) return

    if (s.type === 'self' && s.at) {
      const box = mainBox({
        step: i,
        steps: [i],
        lane: laneOf.get(s.at) ?? 0,
        phase: s.phase,
        role: 'main',
        title: s.title ?? s.label,
        detail: s.detail,
        kind: kindOf(s),
        status: s.status,
      })
      advance(box, kindOf(s), i)
      return
    }
    if (s.type !== 'flow' || !s.from || !s.to) return

    const fromLane = laneOf.get(s.from) ?? 0
    const toLane = laneOf.get(s.to) ?? 0

    // A lookup hangs off the box that asked, and does not move the story on.
    const asker = prev?.lane === fromLane ? prev : lastInLane.get(fromLane)
    if (s.kind === 'lookup' && asker) {
      const reply = replyTo(steps, i)
      const detailParts = [
        s.detail ?? s.label,
        reply ? (reply.detail ?? reply.label) : undefined,
      ].filter(Boolean)
      const side = add({
        step: i,
        steps: reply ? [i, i + 1] : [i],
        lane: toLane,
        row: asker.row,
        phase: s.phase,
        role: 'lookup',
        title: s.title ?? nodeTitle(s.to),
        detail: detailParts.join(' → ') || undefined,
        kind: 'lookup',
        status: s.status,
        icon: diagram.nodes[s.to]?.icon,
      })
      if (reply) skip.add(i + 1)
      links.push({ from: asker.id, to: side.id, kind: 'lookup', style: 'lookup', step: i })
      return
    }

    // Show where the step starts if the story is not already there.
    if (!prev || prev.lane !== fromLane) {
      const origin = mainBox({
        step: i,
        steps: [i],
        lane: fromLane,
        phase: s.phase,
        role: 'origin',
        title: nodeTitle(s.from),
        detail: diagram.nodes[s.from]?.sub,
        kind: s.kind,
        status: 'built',
      })
      advance(origin, s.kind, i)
    }
    const box = mainBox({
      step: i,
      steps: [i],
      lane: toLane,
      phase: s.phase,
      role: 'main',
      title: s.title ?? (s.label || nodeTitle(s.to)),
      detail: s.detail ?? `${nodeTitle(s.from)} → ${nodeTitle(s.to)}`,
      kind: s.kind,
      status: s.status,
    })
    advance(box, s.kind, i)
  })

  return { lanes, boxes, links, phases: buildPhases(scenario, boxes), rows }
}

/** The step right after a lookup, when it is the answer coming straight back. */
function replyTo(steps: CompiledStep[], i: number): CompiledStep | undefined {
  const ask = steps[i]
  const next = steps[i + 1]
  if (!ask || !next) return undefined
  const back =
    next.type === 'flow' && next.kind !== 'lookup' && next.from === ask.to && next.to === ask.from
  return back && next.par === ask.par ? next : undefined
}

function buildLanes(diagram: CompiledDiagram, scenario: CompiledScenario): StoryLane[] {
  const lanes: StoryLane[] = []
  const claimed = new Set<string>()
  const add = (title: string, sub: string | undefined, nodes: string[]) => {
    const icons = nodes.map((n) => diagram.nodes[n]?.icon).filter((i): i is IconData => !!i)
    lanes.push({ index: lanes.length, title, sub, nodes, icons: icons.slice(0, 3) })
    for (const n of nodes) claimed.add(n)
  }

  for (const lane of scenario.lanes ?? []) {
    const sub =
      lane.sub ??
      (lane.nodes.length === 1
        ? diagram.nodes[lane.nodes[0]!]?.sub
        : lane.nodes.map((n) => diagram.nodes[n]?.title ?? n).join(' · '))
    add(lane.title, sub, lane.nodes)
  }
  // Everything else gets its own lane, in the order it first appears.
  for (const s of scenario.steps) {
    for (const id of [s.from, s.at, s.to]) {
      if (id && !claimed.has(id)) add(diagram.nodes[id]?.title ?? id, diagram.nodes[id]?.sub, [id])
    }
  }
  return lanes
}

function buildPhases(scenario: CompiledScenario, boxes: StoryBox[]): StoryPhase[] {
  const out: StoryPhase[] = []
  scenario.phases.forEach((phase, index) => {
    const mine = boxes.filter((b) => b.phase === index)
    if (!mine.length) return
    out.push({
      index,
      title: phase.title,
      caption: phase.caption,
      rowStart: Math.min(...mine.map((b) => b.row)),
      rowEnd: Math.max(...mine.map((b) => b.row)),
    })
  })
  return out
}
