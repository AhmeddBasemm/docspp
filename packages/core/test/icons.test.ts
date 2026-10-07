import { describe, expect, it } from 'vitest'
import { BUILTIN_KINDS } from '../src'
import { authoringJsonSchema, resolveIcon, searchIcons } from '../src/node'

describe('icons', () => {
  it('resolves every built-in kind icon', () => {
    for (const [kind, def] of Object.entries(BUILTIN_KINDS)) {
      expect(resolveIcon(def.icon).icon, kind).toBeDefined()
    }
  })

  it('prefers coloured brand logos and handles aliases', () => {
    const pg = resolveIcon('postgres').icon!
    expect(pg).toMatchObject({ set: 'logos', mono: false })
    expect(resolveIcon('docker').icon?.name).toBe('docker-icon')
    expect(resolveIcon('keycloak').icon?.set).toBe('simple-icons')
  })

  it('accepts explicit sets and rejects unknown names with suggestions', () => {
    expect(resolveIcon('lucide:server').icon?.set).toBe('lucide')
    const miss = resolveIcon('postgresq')
    expect(miss.icon).toBeUndefined()
    expect(miss.suggestions.join()).toContain('postgresql')
  })

  it('searches across sets', () => {
    expect(searchIcons('redis').some((id) => id.endsWith(':redis'))).toBe(true)
  })
})

describe('json schema', () => {
  it('describes the root and accepts shorthand nodes', () => {
    const schema = authoringJsonSchema() as {
      properties: Record<string, { additionalProperties?: { anyOf?: unknown[] } }>
    }
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining(['nodes', 'edges', 'scenarios']),
    )
    expect(schema.properties.nodes!.additionalProperties!.anyOf).toHaveLength(2)
  })
})
