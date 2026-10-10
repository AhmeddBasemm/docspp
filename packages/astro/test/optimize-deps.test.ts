import { existsSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import idocs from '../src'

// The starter is the strictest consumer: pnpm links only what its package.json lists, which does
// not include `@the-package-labs/idocs-core`.
const starter = fileURLToPath(new URL('../../../templates/starter/', import.meta.url))

/** Finds `name` the way Node does: in the closest `node_modules` going up from `from`. */
function findPackage(name: string, from: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate)
    if (dirname(dir) === dir) return undefined
  }
}

/** Walks a Vite `a > b > c/file.js` entry from `root`, as Vite's optimizer does. */
function resolveEntry(entry: string, root: string): string | undefined {
  let from = root
  let found: string | undefined
  for (const part of entry.split('>').map((p) => p.trim())) {
    const segments = part.split('/')
    const name = part.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]!
    const dir = findPackage(name, from)
    if (!dir) return undefined
    found = join(dir, part.slice(name.length))
    if (!existsSync(found)) return undefined
    from = dir
  }
  return found
}

function includes(root: string): string[] {
  let include: string[] = []
  const hook = idocs().hooks['astro:config:setup'] as (options: unknown) => void
  hook({
    config: { root: pathToFileURL(root) },
    updateConfig: (config: { vite: { optimizeDeps: { include: string[] } } }) => {
      include = config.vite.optimizeDeps.include
    },
  })
  return include
}

describe('dev server dependency pre-bundling', () => {
  // A dependency Vite finds only after the page loaded makes it re-optimize and reload mid-session,
  // which can leave a diagram unrendered. The ones the diagram needs must be named up front, and
  // each must resolve from the project's own root.
  it('pre-bundles the layout library and the d3 modules', () => {
    const list = includes(starter)
    for (const lib of ['elkjs/lib/elk.bundled.js', 'd3-selection', 'd3-transition', 'd3-zoom']) {
      expect(
        list.some((entry) => entry.endsWith(`> ${lib}`)),
        lib,
      ).toBe(true)
    }
  })

  it('names only entries that resolve from a project that depends on the integration alone', () => {
    for (const entry of includes(starter)) {
      expect(resolveEntry(entry, starter), entry).toBeDefined()
    }
  })
})
