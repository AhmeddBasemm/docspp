import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isInside, locate } from '../src/model/paths'

const has = (...files: string[]) => ({ exists: (p: string) => files.includes(p) })

describe('locate', () => {
  const probe = has('/p/diagrams/shop/diagram.yaml')

  it('finds the folder and role of each kind of file', () => {
    expect(locate('/p/diagrams/shop/diagram.yaml', probe, join)).toEqual({
      folder: '/p/diagrams/shop',
      name: 'shop',
      role: 'diagram',
    })
    expect(locate('/p/diagrams/shop/scenarios/checkout.yaml', probe, join)).toMatchObject({
      role: 'scenario',
      id: 'checkout',
    })
    expect(locate('/p/diagrams/shop/scenarios/checkout.yml', probe, join)).toMatchObject({
      role: 'scenario',
      id: 'checkout',
    })
    expect(locate('/p/diagrams/shop/nodes/api.md', probe, join)).toMatchObject({
      role: 'node-doc',
      id: 'api',
    })
    expect(locate('/p/diagrams/shop/icons/mine.svg', probe, join)).toMatchObject({ role: 'asset' })
  })

  it('accepts diagram.yml', () => {
    expect(
      locate('/p/diagrams/x/diagram.yml', has('/p/diagrams/x/diagram.yml'), join),
    ).toMatchObject({ role: 'diagram', name: 'x' })
  })

  it('ignores files that are not in a diagram folder', () => {
    expect(locate('/p/diagrams/diagram.schema.json', probe, join)).toBeUndefined()
    expect(locate('/p/src/index.ts', probe, join)).toBeUndefined()
    expect(locate('/p/diagrams/shop/a/b/c/d/e.svg', probe, join)).toBeUndefined()
  })

  it('does not treat a stray yaml file in the folder as the diagram', () => {
    expect(locate('/p/diagrams/shop/other.yaml', probe, join)).toMatchObject({ role: 'asset' })
  })
})

describe('isInside', () => {
  it('is true for the folder itself and for what is below it', () => {
    expect(isInside('/p/diagrams/api', '/p/diagrams/api')).toBe(true)
    expect(isInside('/p/diagrams/api', '/p/diagrams/api/diagram.yaml')).toBe(true)
    expect(isInside('/p/diagrams/api', '/p/diagrams/api/scenarios/x.yaml')).toBe(true)
  })

  it('is false for a sibling whose name starts the same, and for anything outside', () => {
    expect(isInside('/p/diagrams/api', '/p/diagrams/api-v2/diagram.yaml')).toBe(false)
    expect(isInside('/p/diagrams/api', '/p/diagrams/other')).toBe(false)
    expect(isInside('/p/diagrams/api', '/p/secret.md')).toBe(false)
    expect(isInside('/p/diagrams/api', '/p/diagrams/api/../x')).toBe(false)
  })
})
