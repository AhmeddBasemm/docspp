import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { run } from '../../../packages/cli/src/index'
import { NAME_PATTERN, newDiagramFiles } from '../src/model/scaffold'
import { makeProject } from './helpers/project'

describe('newDiagramFiles', () => {
  // `docspp new` is the reference; the editor command must create the same thing.
  it('creates the same files as `docspp new`', async () => {
    const root = makeProject({})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(await run(['new', 'demo', root])).toBe(0)
    for (const file of newDiagramFiles('demo')) {
      expect(readFileSync(join(root, 'diagrams/demo', file.path), 'utf8')).toBe(file.content)
    }
  })

  it('accepts the names the CLI accepts', () => {
    expect(NAME_PATTERN.test('checkout-flow')).toBe(true)
    expect(NAME_PATTERN.test('v2')).toBe(true)
    expect(NAME_PATTERN.test('Checkout')).toBe(false)
    expect(NAME_PATTERN.test('-x')).toBe(false)
    expect(NAME_PATTERN.test('a b')).toBe(false)
  })
})
