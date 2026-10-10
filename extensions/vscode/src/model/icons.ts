// The icon catalog. The three Iconify sets are about 12 MB of JSON, so they ship as files next to
// the bundle and are read the first time an icon is resolved or searched, not at activation.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createIconResolver } from '@packagelab/idocs-core/browser'

export const ICON_SETS = ['logos', 'simple-icons', 'lucide'] as const

export type IconResolver = ReturnType<typeof createIconResolver>
export type IconSets = Parameters<typeof createIconResolver>[0]

/** An icon resolver that loads its sets on first use. */
export function lazyIconResolver(loadSets: () => IconSets): IconResolver {
  let resolver: IconResolver | undefined
  const get = () => {
    resolver ??= createIconResolver(loadSets())
    return resolver
  }
  return {
    resolveIcon: (spec) => get().resolveIcon(spec),
    searchIcons: (query, limit) => get().searchIcons(query, limit),
  }
}

/** Sets read from `<dir>/<name>.json`, where scripts/build.mjs copies them. */
export function iconSetsFromDir(dir: string): IconSets {
  return Object.fromEntries(
    ICON_SETS.map((name) => [name, JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'))]),
  )
}
