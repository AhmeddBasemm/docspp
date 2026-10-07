import { describe, expect, it } from 'vitest'
import { buildTimeline, frameAt, stepAt, stepEnd } from '../src'
import { loadDocs } from './helpers'

const diagram = loadDocs().diagrams.checkout!
const lengths = Object.fromEntries(Object.keys(diagram.edges).map((id) => [id, 300]))

describe('timeline', () => {
  const scenario = diagram.scenarios.find((s) => s.id === 'place-order')!
  const tl = buildTimeline(scenario, lengths)

  it('orders sequential steps and overlaps par steps', () => {
    for (let i = 1; i < tl.steps.length; i++) {
      const prev = tl.steps[i - 1]!
      const cur = tl.steps[i]!
      if (
        scenario.steps[i]!.par !== undefined &&
        scenario.steps[i]!.par === scenario.steps[i - 1]!.par
      ) {
        expect(cur.start).toBe(prev.start)
      } else {
        expect(cur.start).toBeGreaterThanOrEqual(prev.end)
      }
    }
  })

  it('has a packet on the first hop at the start and none after the end', () => {
    const early = frameAt(tl, 0.1)
    expect(early.packets).toHaveLength(1)
    expect(early.packets[0]!.progress).toBeGreaterThan(0)
    expect(early.stepIndex).toBe(0)
    const end = frameAt(tl, tl.duration + 1)
    expect(end.packets).toEqual([])
    expect(end.stepIndex).toBe(scenario.steps.length - 1)
  })

  it('shows two packets while a par block runs', () => {
    const par = tl.steps.filter((_, i) => scenario.steps[i]!.par !== undefined)
    const t = par[0]!.start + 0.1
    expect(frameAt(tl, t).packets.length).toBe(2)
  })

  it('keeps a trail of edges used so far', () => {
    const f = frameAt(tl, tl.duration)
    expect(f.trailEdges.length).toBeGreaterThan(3)
    expect(f.visitedNodes).toContain('stripe')
  })

  it('reports reverse flights', () => {
    const t = buildTimeline(diagram.scenarios.find((s) => s.id === 'browse')!, lengths)
    const resp = t.scenario.steps.findIndex((s) => s.label === 'valid')
    const f = frameAt(t, t.steps[resp]!.start + 0.1)
    expect(f.packets[0]!.reverse).toBe(true)
  })

  it('maps time to step index', () => {
    expect(stepAt(tl, 0)).toBe(0)
    expect(stepAt(tl, stepEnd(tl, 2))).toBeGreaterThanOrEqual(2)
  })

  it('makes longer edges take longer', () => {
    const slow = buildTimeline(
      scenario,
      Object.fromEntries(Object.keys(lengths).map((k) => [k, 1200])),
    )
    expect(slow.duration).toBeGreaterThan(tl.duration)
  })
})
