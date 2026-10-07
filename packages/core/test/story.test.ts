import { describe, expect, it } from 'vitest'
import { buildStory } from '../src'
import { loadProject } from '../src/node'
import { compileText, docsRoot } from './helpers'

const diagram = (scenario: string) => {
  const r = compileText(`title: T
nodes:
  user: { title: User, sub: browser }
  web: Web
  api: API
  cache: { title: Cache, sub: redis }
  db: DB
edges:
  - user -> web
  - web -> api
  - api -> cache: { hidden: true }
  - api -> db: { hidden: true }
scenarios:
  s:
    title: S
${scenario}`)
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  return r.diagram!
}

describe('buildStory', () => {
  const d = diagram(`    phases:
      - title: One
        caption: first
        steps:
          - at user: { title: Click, detail: GET /x }
          - user -> web: { title: Front door }
      - title: Two
        steps:
          - web -> api: Handle
          - api -> cache: { label: key, kind: lookup }
          - cache -> api: hit
          - api -> db: { label: row, kind: lookup }
          - at api: shape the answer
`)
  const story = buildStory(d, d.scenarios[0]!)

  it('makes a lane per node in order of appearance', () => {
    expect(story.lanes.map((l) => l.title)).toEqual(['User', 'Web', 'API', 'Cache', 'DB'])
    expect(story.lanes[0]!.sub).toBe('browser')
  })

  it('puts each step in the lane where it happens, in reading order', () => {
    const main = story.boxes.filter((b) => b.role === 'main')
    expect(main.map((b) => [b.title, b.lane])).toEqual([
      ['Click', 0],
      ['Front door', 1],
      ['Handle', 2],
      ['shape the answer', 2],
    ])
    expect(main.map((b) => b.n)).toEqual([1, 2, 3, 4])
    expect(main.map((b) => b.row)).toEqual([0, 1, 2, 3])
  })

  it('hangs lookups beside the box that asked and folds the answer in', () => {
    const lookups = story.boxes.filter((b) => b.role === 'lookup')
    expect(lookups).toHaveLength(2)
    const handle = story.boxes.find((b) => b.title === 'Handle')!
    expect(lookups[0]).toMatchObject({
      title: 'Cache',
      lane: 3,
      row: handle.row,
      detail: 'key → hit',
    })
    expect(lookups[0]!.steps).toHaveLength(2)
    expect(lookups[0]!.n).toBeUndefined()
    expect(lookups[1]).toMatchObject({ title: 'DB', lane: 4, row: handle.row })
    // The answer step makes no box of its own.
    expect(story.boxes.some((b) => b.title === 'hit')).toBe(false)
  })

  it('joins main boxes in sequence and lookups with a dotted link', () => {
    const flow = story.links.filter((l) => l.style === 'flow')
    expect(flow).toHaveLength(3)
    expect(story.links.filter((l) => l.style === 'lookup')).toHaveLength(2)
  })

  it('groups rows into the scenario phases', () => {
    expect(story.phases.map((p) => [p.title, p.rowStart, p.rowEnd, p.caption])).toEqual([
      ['One', 0, 1, 'first'],
      ['Two', 2, 3, undefined],
    ])
    expect(story.rows).toBe(4)
  })
})

describe('buildStory origins and lanes', () => {
  it('shows an origin box when the first step starts somewhere with no box yet', () => {
    const d = diagram(`    steps:
      - user -> web: GET /
      - web -> api: forward
`)
    const story = buildStory(d, d.scenarios[0]!)
    expect(story.boxes.map((b) => [b.role, b.title])).toEqual([
      ['origin', 'User'],
      ['main', 'GET /'],
      ['main', 'forward'],
    ])
    expect(story.boxes[0]!.n).toBeUndefined()
    expect(story.boxes[1]!.n).toBe(1)
    expect(story.boxes[1]!.detail).toBe('User → Web')
  })

  it('uses author lanes, joins several nodes into one lane, and appends the rest', () => {
    const d = diagram(`    lanes:
      - { title: Stores, nodes: [cache, db] }
      - { title: Front, nodes: [user, web] }
    steps:
      - user -> web: GET /
      - web -> api: forward
      - api -> db: { label: row, kind: lookup }
`)
    const story = buildStory(d, d.scenarios[0]!)
    expect(story.lanes.map((l) => l.title)).toEqual(['Stores', 'Front', 'API'])
    expect(story.lanes[0]!.sub).toBe('Cache · DB')
    const lookup = story.boxes.find((b) => b.role === 'lookup')!
    expect(lookup.lane).toBe(0)
  })

  it('treats a lookup with nobody to ask as an ordinary step', () => {
    const d = diagram(`    steps:
      - api -> db: { label: row, kind: lookup }
`)
    const story = buildStory(d, d.scenarios[0]!)
    expect(story.boxes.filter((b) => b.role === 'lookup')).toHaveLength(0)
    expect(story.boxes.some((b) => b.role === 'main')).toBe(true)
  })
})

describe('lane validation', () => {
  const base = `title: T
nodes:
  a: A
  b: B
edges:
  - a -> b
scenarios:
  s:
    title: S
`
  it('rejects unknown and repeated nodes', () => {
    const r = compileText(
      `${base}    lanes:\n      - { title: X, nodes: [a, zzz] }\n    steps:\n      - a -> b\n`,
    )
    expect(r.diagnostics[0]!.message).toContain('"zzz"')
    const dup = compileText(
      `${base}    lanes:\n      - { title: X, nodes: [a] }\n      - { title: Y, nodes: [a, b] }\n    steps:\n      - a -> b\n`,
    )
    expect(dup.diagnostics[0]!.message).toContain('already in lane 1')
  })

  it('warns about nodes left out of the lanes', () => {
    const r = compileText(
      `${base}    lanes:\n      - { title: X, nodes: [a] }\n    steps:\n      - a -> b\n`,
    )
    expect(r.diagnostics.map((d) => d.severity)).toEqual(['warning'])
    expect(r.diagram).toBeDefined()
  })
})

describe('docs examples', () => {
  it('every scenario in the docs app can be laid out as a story', () => {
    const project = loadProject(docsRoot)
    for (const dgm of Object.values(project.diagrams)) {
      for (const sc of dgm.scenarios) {
        const story = buildStory(dgm, sc)
        expect(story.boxes.length, `${dgm.name}/${sc.id}`).toBeGreaterThan(0)
        for (const link of story.links) {
          expect(story.boxes.some((b) => b.id === link.from)).toBe(true)
          expect(story.boxes.some((b) => b.id === link.to)).toBe(true)
        }
        // Rows only ever grow, so the story reads top to bottom.
        const rows = story.boxes.filter((b) => b.role !== 'lookup').map((b) => b.row)
        expect(rows).toEqual([...rows].sort((a, b) => a - b))
      }
    }
  })
})
