import {
  compileDiagram as compileBrowser,
  createIconResolver,
} from '@packagelab/idocs-core/browser'
import { compileDiagram, loadIconSets } from '@packagelab/idocs-core/node'
import { describe, expect, it } from 'vitest'
import { examples } from '../src/components/playground/examples'
import {
  editSource,
  groupOptions,
  nextId,
  readModel,
  removeEntity,
  setFields,
} from '../src/components/playground/model'

const compile = (text: string) => compileDiagram({ name: 'playground', file: 'diagram.yaml', text })

describe('browser compiler', () => {
  const assets = createIconResolver(loadIconSets())
  it('compiles every playground example identically to the Node compiler', () => {
    for (const example of examples) {
      const result = compileBrowser(
        { name: 'playground', file: 'diagram.yaml', text: example.text },
        assets,
      )
      expect(result, example.id).toEqual(compile(example.text))
      expect(result.diagnostics, example.id).toEqual([])
      expect(result.diagram, example.id).toBeDefined()
    }
  })
  it('reports line locations for malformed YAML and unknown nodes', () => {
    for (const text of [
      'title: [oops\nnodes: {}',
      'title: T\nnodes: {a: A}\nedges: ["a -> missing"]',
    ]) {
      const result = compileBrowser({ name: 'playground', file: 'diagram.yaml', text }, assets)
      expect(result.diagram).toBeUndefined()
      expect(result.diagnostics[0]?.severity).toBe('error')
      expect(result.diagnostics[0]?.line).toBeGreaterThan(0)
    }
  })
})

describe('visual authoring', () => {
  const original = `# Keep this comment
title: System
nodes:
  a: Client # Author note
  b: { title: API, kind: service, description: "**Docs**", tags: [critical] }
edges:
  - a <-> b: Requests # Keep edge shorthand
views:
  all: { include: all, keys: true }
`
  it('expands only edited nodes and retains comments, shorthand and advanced properties', () => {
    const text = editSource(original, (doc, model) =>
      setFields(doc, model, 'nodes', 'b', { title: 'Updated API', family: 'teal' }),
    )
    expect(text).toContain('# Keep this comment')
    expect(text).toContain('a: Client # Author note')
    expect(text).toContain('a <-> b: Requests # Keep edge shorthand')
    expect(readModel(text)?.nodes.b).toMatchObject({
      title: 'Updated API',
      tags: ['critical'],
      description: '**Docs**',
      family: 'teal',
    })
    expect(compile(text).diagnostics).toEqual([])
  })
  it('edits a shorthand node and a shorthand connection without losing their other values', () => {
    const nodeEdit = editSource(original, (doc, model) =>
      setFields(doc, model, 'nodes', 'a', { kind: 'client' }),
    )
    expect(readModel(nodeEdit)?.nodes.a).toMatchObject({ title: 'Client', kind: 'client' })
    const edgeEdit = editSource(nodeEdit, (doc, model) =>
      setFields(doc, model, 'edges', '0', { label: 'HTTPS' }),
    )
    expect(readModel(edgeEdit)?.edges?.[0]).toMatchObject({
      from: 'a',
      to: 'b',
      both: true,
      label: 'HTTPS',
    })
    expect(compile(edgeEdit).diagnostics).toEqual([])
  })
  it('removes a node together with connections, explicit rows and view references', () => {
    const text = editSource(
      `title: T
groups: {g: {label: G, rows: [[a, b]]}}
nodes: {a: {in: g}, b: {in: g}}
edges: ["a -> b"]
views: {v: {include: [a, b], exclude: [a]}}
`,
      (doc, model) => removeEntity(doc, model, { entity: 'nodes', id: 'a' }),
    )
    const model = readModel(text)!
    expect(model.nodes.a).toBeUndefined()
    expect(model.edges).toEqual([])
    expect(model.groups?.g?.rows).toEqual([['b']])
    expect(model.views?.v).toMatchObject({ include: ['b'], exclude: [] })
    expect(compile(text).diagnostics).toEqual([])
  })
  it('reparents every member when a group is removed, without leaving stale rows', () => {
    const text = editSource(
      `title: T
groups:
  parent: {label: Parent, rows: [[child]]}
  child: {label: Child, in: parent, rows: [[a, b]]}
nodes: {a: {in: child}, b: {in: child}}
`,
      (doc, model) => removeEntity(doc, model, { entity: 'groups', id: 'child' }),
    )
    expect(readModel(text)?.nodes.a?.in).toBe('parent')
    expect(readModel(text)?.nodes.b?.in).toBe('parent')
    expect(readModel(text)?.groups?.child).toBeUndefined()
    expect(readModel(text)?.groups?.parent?.rows).toBeUndefined()
    expect(compile(text).diagnostics).toEqual([])
  })
  it('rejects unsafe deletion in diagrams with scenario routing', () => {
    expect(() =>
      editSource(examples[2]!.text, (doc, model) =>
        removeEntity(doc, model, { entity: 'nodes', id: 'api' }),
      ),
    ).toThrow('scenarios')
  })
  it('removes old row references when moving a node, and can clear optional fields', () => {
    const text = editSource(
      `title: T
groups: {g: {label: G, rows: [[a]]}, h: H}
nodes: {a: {in: g, sub: Old}}
`,
      (doc, model) => setFields(doc, model, 'nodes', 'a', { in: 'h', sub: '' }),
    )
    expect(readModel(text)?.nodes.a).toEqual({ in: 'h' })
    expect(readModel(text)?.groups?.g?.rows).toBeUndefined()
    expect(compile(text).diagnostics).toEqual([])
  })
  it('prevents parent cycles and generates unique valid ids', () => {
    const model = readModel('title: T\nnodes: {}\ngroups: {a: A, b: {label: B, in: a}, c: C}')!
    expect(groupOptions(model, 'a')).toEqual(['c'])
    expect(nextId('New service!', ['new-service', 'new-service-2'])).toBe('new-service-3')
  })
  it('refuses malformed or invalid YAML and excessive aliases', () => {
    for (const text of ['title: [', '', 'title: T\nnodes: []']) {
      expect(readModel(text)).toBeNull()
      expect(() => editSource(text, () => {})).toThrow('Fix the YAML')
    }
  })
})
