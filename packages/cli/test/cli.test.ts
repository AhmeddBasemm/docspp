import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProject } from '@idocs/core/node'
import { describe, expect, it } from 'vitest'
import { staleRefs } from '../src'

function project(yaml: string) {
  const root = mkdtempSync(join(tmpdir(), 'idocs-'))
  mkdirSync(join(root, 'diagrams', 'd'), { recursive: true })
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'real.ts'), '')
  writeFileSync(join(root, 'diagrams', 'd', 'diagram.yaml'), yaml)
  return { root, loaded: loadProject(root) }
}

describe('staleRefs', () => {
  it('flags cited files that are gone, and accepts line suffixes and URLs', () => {
    const { root, loaded } = project(`title: T
nodes:
  api:
    refs: [src/real.ts, "src/real.ts:12", "src/real.ts#L3-L9", src/gone.ts, "https://example.com/x", plain]
`)
    const stale = staleRefs(loaded, [root])
    expect(stale).toHaveLength(1)
    expect(stale[0]!.message).toContain('src/gone.ts')
  })
})
