import { describe, expect, it } from 'vitest'
import { contextOf, cursorContext, isCompact, listKind, parseLine } from '../src/language/context'
import { at } from './helpers/cursor'

const ctx = (marked: string) => {
  const { text, pos } = at(marked)
  return cursorContext(text, pos)
}

describe('parseLine', () => {
  it('reads indentation, dashes, keys and block scalar headers', () => {
    expect(parseLine('    title: x')).toMatchObject({
      indent: 4,
      contentCol: 4,
      key: 'title',
      hasValue: true,
    })
    expect(parseLine('  - from: a')).toMatchObject({ dashes: [2], contentCol: 4, key: 'from' })
    expect(parseLine('- - a')).toMatchObject({ dashes: [0, 2], contentCol: 4 })
    expect(parseLine('nodes:')).toMatchObject({ key: 'nodes', hasValue: false })
    expect(parseLine('note: |')).toMatchObject({ blockScalar: true })
    expect(parseLine('note: >-  # why')).toMatchObject({ blockScalar: true })
  })

  it('skips blank lines and comments', () => {
    expect(parseLine('')).toBeUndefined()
    expect(parseLine('   # nodes:')).toBeUndefined()
  })

  it('does not take a colon inside a value for a key', () => {
    expect(parseLine('  - http://example.com')).toMatchObject({ key: undefined })
    expect(parseLine('sub: ":4001"')).toMatchObject({ key: 'sub', hasValue: true })
  })
})

describe('cursorContext: where and path', () => {
  it('is a key at the start of a mapping', () => {
    expect(ctx('|')).toMatchObject({ where: 'key', path: [] })
    expect(ctx('ti|')).toMatchObject({ where: 'key', path: [], typed: 'ti', start: 0 })
  })

  it('finds the node a new key belongs to', () => {
    const c = ctx('nodes:\n  api:\n    kind: service\n    |')
    expect(c).toMatchObject({ where: 'key', path: ['nodes', 'api'] })
    expect(c.siblings).toEqual(['kind'])
  })

  it('finds the value being typed', () => {
    expect(ctx('nodes:\n  api:\n    kind: ser|')).toMatchObject({
      where: 'value',
      key: 'kind',
      typed: 'ser',
      path: ['nodes', 'api'],
      start: 10,
    })
    expect(ctx('nodes:\n  api:\n    kind: |')).toMatchObject({
      where: 'value',
      key: 'kind',
      typed: '',
    })
  })

  it('strips an opening quote from the typed text', () => {
    expect(ctx('nodes:\n  a:\n    icon: "lu|')).toMatchObject({ key: 'icon', typed: 'lu' })
  })

  it('knows a sequence item and its keys', () => {
    expect(ctx('edges:\n  - |')).toMatchObject({ where: 'item', path: ['edges', '-'] })
    expect(ctx('edges:\n  - fr|')).toMatchObject({
      where: 'item',
      path: ['edges', '-'],
      typed: 'fr',
    })
    const c = ctx('edges:\n  - from: a\n    |')
    expect(c).toMatchObject({ where: 'key', path: ['edges', '-'] })
    expect(c.siblings).toEqual(['from'])
    expect(ctx('edges:\n  - from: a\n    to: |')).toMatchObject({
      where: 'value',
      key: 'to',
      path: ['edges', '-'],
    })
  })

  it('handles a list that is not indented under its key', () => {
    expect(ctx('edges:\n- |')).toMatchObject({ where: 'item', path: ['edges', '-'] })
    expect(ctx('edges:\n- from: a\n  to: |')).toMatchObject({
      where: 'value',
      key: 'to',
      path: ['edges', '-'],
    })
  })

  it('goes through several levels', () => {
    const text =
      'scenarios:\n  checkout:\n    title: x\n    phases:\n      - title: Pay\n        steps:\n          - |'
    expect(ctx(text)).toMatchObject({
      where: 'item',
      path: ['scenarios', 'checkout', 'phases', '-', 'steps', '-'],
    })
  })

  it('detects the target of an arrow', () => {
    expect(ctx('edges:\n  - web -> |')).toMatchObject({
      where: 'arrow-target',
      source: 'web',
      typed: '',
    })
    expect(ctx('edges:\n  - web -> ap|')).toMatchObject({
      where: 'arrow-target',
      source: 'web',
      typed: 'ap',
    })
    expect(ctx('edges:\n  - web <-> |')).toMatchObject({ where: 'arrow-target' })
  })

  it('reads keys of a flow mapping', () => {
    expect(ctx('edges:\n  - a -> b: { kind: da|')).toMatchObject({
      where: 'value',
      key: 'kind',
      typed: 'da',
    })
    expect(ctx('edges:\n  - a -> b: { label: x, |')).toMatchObject({ where: 'key', inFlow: true })
    expect(ctx('edges:\n  - a -> b: { la|')).toMatchObject({ where: 'key', typed: 'la' })
  })

  it('reads items of a flow sequence', () => {
    expect(ctx('scenarios:\n  s:\n    steps:\n      - a -> b: { via: [x, |')).toMatchObject({
      where: 'value',
      key: 'via',
    })
  })

  it('never completes in a comment or a block scalar', () => {
    expect(ctx('nodes:\n  # kind: |').none).toBe(true)
    expect(ctx('title: x # why |').none).toBe(true)
    expect(ctx('description: |\n  some text\n  more |').none).toBe(true)
    expect(ctx('description: |\n  some text\ntitle: x\nnodes:\n  |').none).toBeFalsy()
  })

  it('does not take a # inside a quoted string for a comment', () => {
    expect(ctx('nodes:\n  a:\n    sub: "a # b"\n    kind: |').none).toBeFalsy()
  })
})

describe('contextOf', () => {
  it('maps a path to the kind of mapping', () => {
    const d = (p: string[]) => contextOf(p, 'diagram')
    expect(d([])).toBe('root')
    expect(d(['nodes', 'api'])).toBe('node')
    expect(d(['nodes'])).toBeUndefined()
    expect(d(['nodes', 'api', 'chips', '-'])).toBe('chip')
    expect(d(['nodes', 'api', 'links', '-'])).toBe('link')
    expect(d(['groups', 'g'])).toBe('group')
    expect(d(['edges', '-'])).toBe('edge')
    expect(d(['edges', '-', 'a -> b'])).toBe('edge')
    expect(d(['views', 'main'])).toBe('view')
    expect(d(['kinds', 'k'])).toBe('kind')
    expect(d(['edgeKinds', 'k'])).toBe('edgeKind')
    expect(d(['scenarios', 's'])).toBe('scenario')
    expect(d(['scenarios', 's', 'phases', '-'])).toBe('phase')
    expect(d(['scenarios', 's', 'lanes', '-'])).toBe('lane')
  })

  it('finds steps wherever they nest', () => {
    const d = (p: string[]) => contextOf(p, 'diagram')
    expect(d(['scenarios', 's', 'steps', '-'])).toBe('step')
    expect(d(['scenarios', 's', 'steps', '-', 'a -> b'])).toBe('step')
    expect(d(['scenarios', 's', 'phases', '-', 'steps', '-'])).toBe('step')
    expect(d(['scenarios', 's', 'steps', '-', 'par', '-'])).toBe('step')
    expect(d(['scenarios', 's', 'steps', '-', 'par'])).toBeUndefined()
  })

  it('treats the root of a scenario file as a scenario', () => {
    const s = (p: string[]) => contextOf(p, 'scenario')
    expect(s([])).toBe('scenario')
    expect(s(['steps', '-'])).toBe('step')
    expect(s(['phases', '-'])).toBe('phase')
    expect(s(['phases', '-', 'steps', '-'])).toBe('step')
  })

  it('knows list kinds and compact edges', () => {
    expect(listKind(['edges', '-'], 'diagram')).toBe('edges')
    expect(listKind(['scenarios', 's', 'steps', '-'], 'diagram')).toBe('steps')
    expect(listKind(['steps', '-'], 'scenario')).toBe('steps')
    expect(listKind(['nodes', 'a'], 'diagram')).toBeUndefined()
    expect(isCompact(['edges', '-', 'a -> b'])).toBe(true)
    expect(isCompact(['scenarios', 's', 'steps', '-', 'at api'])).toBe(true)
    expect(isCompact(['edges', '-'])).toBe(false)
  })
})
