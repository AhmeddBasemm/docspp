import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hover } from '../src/language/hover'
import { compileFolder } from '../src/model/compile'
import { declarationsOf } from '../src/model/declarations'
import { referencesIn } from '../src/model/references'
import { nodeFs } from '../src/model/sources'
import { Parsed } from '../src/model/yaml'
import { at } from './helpers/cursor'
import { icons, makeProject } from './helpers/project'

const TEXT = `title: Shop
groups:
  backend: { label: Backend, caption: Kubernetes }
nodes:
  web: { kind: client, title: Web app, sub: React }
  api: { kind: service, title: API, in: backend, status: planned, icon: logos:redis }
edges:
  - web -> api: HTTPS
views:
  main: { title: Main view }
`

function run(marked: string, compiled = true) {
  const { text, pos } = at(marked)
  const root = makeProject({ 'diagrams/shop/diagram.yaml': text })
  const diagram = compiled
    ? compileFolder(join(root, 'diagrams/shop'), { fs: nodeFs(), icons, refBases: [] })?.diagram
    : undefined
  const parsed = new Parsed(text)
  return hover({
    parsed,
    position: pos,
    file: 'diagram',
    declarations: declarationsOf(parsed),
    refs: referencesIn(parsed, 'diagram'),
    diagram,
    resolveIcon: (spec) => icons.resolveIcon(spec).icon,
  })
}

describe('hover', () => {
  it('describes a node where it is used, with what it calls and what calls it', () => {
    const h = run(TEXT.replace('- web -> api', '- we|b -> api'))?.markdown
    expect(h).toContain('**Web app** · `web`')
    expect(h).toContain('client')
    expect(h).toContain('`React`')
    expect(h).toContain('→ `api`')
    const api = run(TEXT.replace('- web -> api', '- web -> ap|i'))?.markdown
    expect(api).toContain('planned')
    expect(api).toContain('← `web`')
  })

  it('still works from the declaration alone when the diagram does not compile', () => {
    const h = run(TEXT.replace('  web:', '  we|b:'), false)?.markdown
    expect(h).toContain('**Web app**')
    expect(h).toContain('client')
  })

  it('describes groups and views', () => {
    expect(run(TEXT.replace('in: backend', 'in: back|end'))?.markdown).toContain(
      '**Backend** · group `backend`',
    )
    expect(run(TEXT.replace('in: backend', 'in: back|end'))?.markdown).toContain('Members: `api`')
  })

  it('says when an id is not declared', () => {
    const h = run(TEXT.replace('- web -> api', '- web -> ap|x'), false)?.markdown
    expect(h).toContain('Not declared')
  })

  it('previews an icon', () => {
    const h = run(TEXT.replace('logos:redis', 'logos:re|dis'))?.markdown
    expect(h).toMatch(/!\[redis\]\(data:image\/svg\+xml;base64,/)
    expect(h).toContain('`logos:redis`')
  })

  it('explains kinds and statuses', () => {
    expect(run(TEXT.replace('kind: client', 'kind: cli|ent'))?.markdown).toMatch(
      /default icon `lucide:monitor`/,
    )
    expect(run(TEXT.replace('status: planned', 'status: plan|ned'))?.markdown).toMatch(
      /Not built yet/,
    )
  })

  it('documents a key from the schema', () => {
    const h = run(TEXT.replace('sub: React', 'su|b: React'))?.markdown
    expect(h).toContain('**sub**')
    expect(h).toMatch(/mono/)
  })

  it('says nothing on plain text', () => {
    expect(run(TEXT.replace('title: Web app', 'title: We|b app'))).toBeUndefined()
    expect(run('ti|tle: x\n')).toBeUndefined()
  })
})
