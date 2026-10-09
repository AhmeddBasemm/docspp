import { describe, expect, it } from 'vitest'
import { type OutlineSymbol, outline } from '../src/model/symbols'
import { Parsed } from '../src/model/yaml'

const shape = (list: OutlineSymbol[]): unknown[] =>
  list.map((s) => (s.children.length ? [s.name, s.detail, shape(s.children)] : [s.name, s.detail]))

describe('outline', () => {
  it('lists sections, then what is in them', () => {
    const text = `title: Shop
nodes:
  web: Web app
  api: { kind: service, title: API }
groups:
  backend: { label: Backend }
edges:
  - web -> api: HTTPS
  - { from: api, to: web, label: back }
  - api -> web
views:
  main: { title: Main }
scenarios:
  load:
    title: Load
    steps:
      - web -> api: GET
      - at api: check
      - { from: api, to: web, label: ok }
      - par:
          - api -> web
`
    const result = outline(new Parsed(text), 'diagram')
    expect(shape(result)).toEqual([
      [
        'nodes',
        '2',
        [
          ['web', 'Web app'],
          ['api', 'service · API'],
        ],
      ],
      ['groups', '1', [['backend', 'Backend']]],
      [
        'edges',
        '3',
        [
          ['web -> api', 'HTTPS'],
          ['api -> web', 'back'],
          ['api -> web', undefined],
        ],
      ],
      ['views', '1', [['main', 'Main']]],
      [
        'scenarios',
        '1',
        [
          [
            'load',
            'Load',
            [
              ['web -> api', 'GET'],
              ['at api', 'check'],
              ['api -> web', 'ok'],
              ['par', undefined, [['api -> web', undefined]]],
            ],
          ],
        ],
      ],
    ])
  })

  it('selects the key and spans the entry', () => {
    const [nodes] = outline(new Parsed('nodes:\n  api:\n    kind: service\n'), 'diagram')
    const api = nodes?.children[0]
    expect(api?.selection).toEqual({
      start: { line: 1, character: 2 },
      end: { line: 1, character: 5 },
    })
    expect(api?.range.end.line).toBe(2)
  })

  it('groups phases in a scenario file', () => {
    const text =
      'title: S\nphases:\n  - title: Go\n    steps:\n      - a -> b: x\nsteps:\n  - b -> a\n'
    expect(shape(outline(new Parsed(text), 'scenario'))).toEqual([
      ['Go', undefined, [['a -> b', 'x']]],
      ['b -> a', undefined],
    ])
  })

  it('copes with text that does not parse', () => {
    expect(() => outline(new Parsed('nodes: [\n  a'), 'diagram')).not.toThrow()
    expect(outline(new Parsed(''), 'diagram')).toEqual([])
  })
})
