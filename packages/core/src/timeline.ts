import type { CompiledScenario, CompiledStep, StepKind } from './types'

export interface TimelineOptions {
  /** Packet speed in layout pixels per second. */
  speed?: number
  /** Shortest time a single hop may take, in seconds. */
  minHop?: number
  /** Duration of a self step, in seconds. */
  selfDuration?: number
  /** Pause between sequential steps, in seconds. */
  gap?: number
}

export interface HopTrack {
  edge: string
  reverse: boolean
  start: number
  end: number
}

export interface StepTrack {
  stepId: string
  index: number
  start: number
  end: number
  hops: HopTrack[]
}

export interface Timeline {
  duration: number
  steps: StepTrack[]
  scenario: CompiledScenario
}

export interface PacketState {
  stepId: string
  edge: string
  reverse: boolean
  /** 0..1 along the edge in the direction of travel. */
  progress: number
  label: string
  kind: StepKind
}

export interface PulseState {
  stepId: string
  node: string
  /** 0..1 over the pulse lifetime. */
  progress: number
  label?: string
  kind?: StepKind
}

export interface Frame {
  /** Index of the step in progress, or the last finished one; -1 before the first step. */
  stepIndex: number
  packets: PacketState[]
  pulses: PulseState[]
  /** Edges a packet is on right now. */
  activeEdges: string[]
  /** Edges any finished or running step has used. */
  trailEdges: string[]
  /** Nodes any started step has reached. */
  visitedNodes: string[]
}

const PULSE_LIFETIME = 0.7

export function buildTimeline(
  scenario: CompiledScenario,
  edgeLengths: Record<string, number>,
  options: TimelineOptions = {},
): Timeline {
  const speed = options.speed ?? 420
  const minHop = options.minHop ?? 0.45
  const selfDuration = options.selfDuration ?? 0.9
  const gap = options.gap ?? 0.25

  const tracks: StepTrack[] = []
  let cursor = 0
  let i = 0
  while (i < scenario.steps.length) {
    const first = scenario.steps[i]!
    // Gather the run of steps that share a par id; a lone step is a run of one.
    let j = i + 1
    if (first.par !== undefined) {
      while (j < scenario.steps.length && scenario.steps[j]!.par === first.par) j++
    }
    let runEnd = cursor
    for (let k = i; k < j; k++) {
      const track = trackFor(scenario.steps[k]!, k, cursor, edgeLengths, {
        speed,
        minHop,
        selfDuration,
      })
      tracks.push(track)
      runEnd = Math.max(runEnd, track.end)
    }
    cursor = runEnd + gap
    i = j
  }
  const last = tracks[tracks.length - 1]
  return {
    duration: last ? Math.max(...tracks.map((t) => t.end)) + 0.4 : 0,
    steps: tracks,
    scenario,
  }
}

function trackFor(
  step: CompiledStep,
  index: number,
  start: number,
  edgeLengths: Record<string, number>,
  o: { speed: number; minHop: number; selfDuration: number },
): StepTrack {
  if (step.type === 'self') {
    return {
      stepId: step.id,
      index,
      start,
      end: start + o.selfDuration + (step.hold ?? 0),
      hops: [],
    }
  }
  const hops: HopTrack[] = []
  let t = start
  for (const hop of step.hops) {
    const dur = Math.max(o.minHop, (edgeLengths[hop.edge] ?? 200) / o.speed)
    hops.push({ edge: hop.edge, reverse: hop.reverse, start: t, end: t + dur })
    t += dur
  }
  return { stepId: step.id, index, start, end: t + PULSE_LIFETIME * 0.5 + (step.hold ?? 0), hops }
}

export function frameAt(tl: Timeline, t: number): Frame {
  const packets: PacketState[] = []
  const pulses: PulseState[] = []
  const active = new Set<string>()
  const trail = new Set<string>()
  const visited = new Set<string>()
  let stepIndex = -1

  for (const track of tl.steps) {
    if (t < track.start) continue
    const step = tl.scenario.steps[track.index]!
    stepIndex = Math.max(stepIndex, track.index)

    if (step.type === 'self') {
      const p = (t - track.start) / PULSE_LIFETIME
      if (step.at) visited.add(step.at)
      if (p <= 1)
        pulses.push({
          stepId: step.id,
          node: step.at!,
          progress: Math.max(0, p),
          label: step.label,
          kind: step.kind,
        })
      else if (t <= track.end)
        pulses.push({
          stepId: step.id,
          node: step.at!,
          progress: 1,
          label: step.label,
          kind: step.kind,
        })
      continue
    }

    if (step.from) visited.add(step.from)
    track.hops.forEach((hop, h) => {
      if (t < hop.start) return
      const def = step.hops[h]!
      trail.add(hop.edge)
      if (t < hop.end) {
        active.add(hop.edge)
        packets.push({
          stepId: step.id,
          edge: hop.edge,
          reverse: hop.reverse,
          progress: (t - hop.start) / (hop.end - hop.start),
          label: step.label,
          kind: step.kind,
        })
        return
      }
      visited.add(def.to)
      const since = (t - hop.end) / PULSE_LIFETIME
      if (since <= 1) pulses.push({ stepId: step.id, node: def.to, progress: since })
    })
  }

  return {
    stepIndex,
    packets,
    pulses,
    activeEdges: [...active],
    trailEdges: [...trail],
    visitedNodes: [...visited],
  }
}

/** Time at which step `index` has finished its flight, the natural place to pause after "next". */
export function stepEnd(tl: Timeline, index: number): number {
  return tl.steps[index]?.end ?? tl.duration
}

export function stepStart(tl: Timeline, index: number): number {
  return tl.steps[index]?.start ?? 0
}

/** Index of the step whose run covers `t`, falling back to the last started step. */
export function stepAt(tl: Timeline, t: number): number {
  let idx = -1
  for (const s of tl.steps) if (s.start <= t) idx = Math.max(idx, s.index)
  return idx
}

/** Start and end of the run containing step `index`; a par block counts as one run. */
export function runBounds(tl: Timeline, index: number): { start: number; end: number } {
  const step = tl.scenario.steps[index]
  if (!step || step.par === undefined)
    return { start: stepStart(tl, index), end: stepEnd(tl, index) }
  const same = tl.steps.filter((_, i) => tl.scenario.steps[i]!.par === step.par)
  return { start: Math.min(...same.map((s) => s.start)), end: Math.max(...same.map((s) => s.end)) }
}
