import { describe, expect, it } from 'vitest'
import { compileText, loadDocs } from './helpers'

describe('checkout example', () => {
  const project = loadDocs()
  const diagram = project.diagrams.checkout!

  it('compiles without errors', () => {
    expect(project.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(diagram).toBeDefined()
  })

  it('resolves icons for every node', () => {
    const missing = Object.values(diagram.nodes).filter((n) => !n.icon)
    expect(missing.map((n) => n.id)).toEqual([])
  })

  it('renders node docs from nodes/<id>.md', () => {
    expect(diagram.nodes.orders!.docHtml).toContain('<table>')
    expect(diagram.nodes.gateway!.docHtml).toContain('<li>')
  })

  it('builds a view from a group include', () => {
    const backend = diagram.views.find((v) => v.id === 'backend')!
    expect(backend.nodeIds).toContain('orders')
    expect(backend.nodeIds).toContain('stripe')
    expect(backend.nodeIds).not.toContain('browser')
    expect(backend.groupIds).not.toContain('edge')
  })

  it('assigns letter keys to edges when asked', () => {
    const overview = diagram.views.find((v) => v.id === 'overview')!
    expect(Object.values(overview.keys).slice(0, 3)).toEqual(['A', 'B', 'C'])
  })

  it('routes multi-hop steps along declared edges', () => {
    const browse = diagram.scenarios.find((s) => s.id === 'browse')!
    const first = browse.steps[0]!
    expect(first.hops.map((h) => `${h.from}>${h.to}`)).toEqual(['browser>cdn', 'cdn>gateway'])
    expect(first.hops.every((h) => !h.reverse)).toBe(true)
  })

  it('flies against an edge and calls it a response', () => {
    const browse = diagram.scenarios.find((s) => s.id === 'browse')!
    const ok = browse.steps.find((s) => s.label === 'valid')!
    expect(ok.hops).toHaveLength(1)
    expect(ok.hops[0]!.reverse).toBe(true)
    expect(ok.kind).toBe('response')
    const answer = browse.steps.at(-1)!
    expect(answer.hops.map((h) => h.to)).toEqual(['gateway', 'cdn', 'browser'])
  })

  it('numbers steps and groups par steps', () => {
    const order = diagram.scenarios.find((s) => s.id === 'place-order')!
    expect(order.steps.map((s) => s.n)).toEqual(order.steps.map((_, i) => i + 1))
    const par = order.steps.filter((s) => s.par !== undefined)
    expect(par).toHaveLength(2)
    expect(par[0]!.par).toBe(par[1]!.par)
  })
})

describe('diagnostics', () => {
  const base = `title: T
nodes:
  api: { title: API }
  db: { title: DB }
`

  it('reports YAML syntax errors with a location', () => {
    const r = compileText('title: T\nnodes:\n  a: [unclosed\n')
    expect(r.diagram).toBeUndefined()
    expect(r.diagnostics[0]).toMatchObject({ severity: 'error', file: 't.yaml' })
    expect(r.diagnostics[0]!.line).toBeGreaterThan(0)
  })

  it('points at the bad edge endpoint and suggests the right id', () => {
    const r = compileText(`${base}edges:\n  - api -> dbb\n`)
    const d = r.diagnostics.find((x) => x.severity === 'error')!
    expect(d.message).toContain('"dbb"')
    expect(d.hint).toContain('"db"')
    expect(d.line).toBe(6)
  })

  it('reports an alias with no anchor instead of throwing', () => {
    const r = compileText('title: T\nnodes:\n  a: { kind: *x }\n')
    expect(r.diagram).toBeUndefined()
    expect(r.diagnostics[0]).toMatchObject({ severity: 'error', file: 't.yaml' })
    expect(r.diagnostics[0]!.message).toContain('Unresolved alias')
  })

  it('rejects unknown keys and suggests the intended one', () => {
    const r = compileText('title: T\nnodes:\n  api: { titel: API }\n')
    const d = r.diagnostics[0]!
    expect(d.message).toContain('Unknown key "titel"')
    expect(d.hint).toContain('title')
    expect(d.line).toBe(3)
    // The column is the unknown key, not the node that holds it.
    expect(d.col).toBe(10)
  })

  it('points at the unknown key when it is on its own line', () => {
    const r = compileText('title: T\nnodes:\n  api:\n    kind: service\n    titel: API\n')
    expect(r.diagnostics[0]).toMatchObject({ line: 5, col: 5 })
  })

  it('reports a step with no route', () => {
    const r = compileText(`${base}scenarios:\n  s:\n    title: S\n    steps:\n      - api -> db\n`)
    expect(r.diagnostics[0]!.message).toContain('No path from "api" to "db"')
  })

  it('warns about unknown icons with suggestions', () => {
    const r = compileText('title: T\nnodes:\n  a: { icon: postgresq }\n')
    const w = r.diagnostics.find((d) => d.severity === 'warning')!
    expect(w.message).toContain('Unknown icon')
    expect(w.hint).toContain('postgresql')
    expect(r.diagram).toBeDefined()
  })

  it('accepts shorthand nodes, compact edges and both-way arrows', () => {
    const r = compileText(`title: T
nodes:
  a: Alpha
  b: Beta
edges:
  - a <-> b: sync
`)
    expect(r.diagnostics).toEqual([])
    const e = Object.values(r.diagram!.edges)[0]!
    expect(e).toMatchObject({ from: 'a', to: 'b', both: true, label: 'sync' })
    expect(r.diagram!.nodes.a!.title).toBe('Alpha')
  })

  it('merges scenarios from separate files', () => {
    const r = compileText(`${base}edges:\n  - api -> db\n`, {
      scenarioFiles: [
        { id: 'q', file: 'scenarios/q.yaml', text: 'title: Q\nsteps:\n  - api -> db: SELECT\n' },
      ],
    })
    expect(r.diagnostics).toEqual([])
    expect(r.diagram!.scenarios.map((s) => s.id)).toEqual(['q'])
  })

  it('attributes errors in a scenario file to that file', () => {
    const r = compileText(`${base}edges:\n  - api -> db\n`, {
      scenarioFiles: [
        { id: 'q', file: 'scenarios/q.yaml', text: 'title: Q\nsteps:\n  - api -> ghost\n' },
      ],
    })
    const d = r.diagnostics.find((x) => x.severity === 'error')!
    expect(d.file).toBe('scenarios/q.yaml')
    expect(d.message).toContain('"ghost"')
  })
})
