import { KNOWN_KEYS, RootSchema } from '@the-package-labs/idocs-core/browser'
import { describe, expect, it } from 'vitest'
import { edgeKinds, nodeKinds, propsFor, STEP_PROPS } from '../src/language/vocabulary'

const names = (context: Parameters<typeof propsFor>[0]) =>
  propsFor(context)
    .map((p) => p.name)
    .sort()

describe('vocabulary', () => {
  it('lists the keys the compiler accepts for each mapping', () => {
    expect(names('root')).toEqual([...KNOWN_KEYS.root].sort())
    expect(names('node')).toEqual([...KNOWN_KEYS.node].sort())
    expect(names('group')).toEqual([...KNOWN_KEYS.group].sort())
    expect(names('view')).toEqual([...KNOWN_KEYS.view].sort())
    expect(names('scenario')).toEqual([...KNOWN_KEYS.scenario].sort())
    expect(names('edge')).toEqual([...KNOWN_KEYS.edge].sort())
  })

  it('knows the keys of phases, lanes, chips and links', () => {
    expect(names('phase')).toEqual(['caption', 'steps', 'title'])
    expect(names('lane')).toEqual(['nodes', 'sub', 'title'])
    expect(names('chip')).toEqual(['label', 'sub'])
    expect(names('link')).toEqual(['label', 'url'])
    expect(names('kind')).toEqual(['family', 'icon'])
    expect(names('edgeKind')).toEqual(['color', 'dash', 'label', 'width'])
  })

  // Steps are open in the published schema (they have three shorthand forms), so their keys are
  // listed by hand. This reads the zod schema the compiler validates with and compares.
  it('lists the keys of a step exactly as the schema does', () => {
    const scenario = RootSchema.shape.scenarios.unwrap().valueType
    const options = scenario.shape.steps.unwrap().element.options
    const keys = new Set<string>(options.flatMap((o) => Object.keys(o.shape)))
    // `type` is implied by the shorthand, and `steps` belongs to a parallel group.
    keys.delete('type')
    keys.delete('steps')
    expect(STEP_PROPS.map((p) => p.name).sort()).toEqual([...keys].sort())
  })

  it('describes keys, values and flags from the schema', () => {
    const status = propsFor('node').find((p) => p.name === 'status')
    expect(status?.values).toEqual(['built', 'planned', 'legacy', 'optional'])
    expect(propsFor('edge').find((p) => p.name === 'both')?.boolean).toBe(true)
    expect(propsFor('node').find((p) => p.name === 'sub')?.description).toMatch(/mono/)
  })

  it('merges built-in and custom kinds', () => {
    expect(nodeKinds(['partner'])).toContain('partner')
    expect(nodeKinds()).toContain('service')
    expect(edgeKinds(['batch'])).toEqual(expect.arrayContaining(['http', 'batch']))
  })
})
