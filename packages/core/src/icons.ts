import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { IconifyJSON } from '@iconify/types'
import { createIconResolver } from './icon-resolver'

export { type IconResult, iconFromSvg } from './icon-resolver'

const require = createRequire(import.meta.url)
let sets: Record<string, IconifyJSON> | undefined

/** The bundled catalog, also emitted as a static asset for the playground worker. */
export function loadIconSets(): Record<string, IconifyJSON> {
  sets ??= Object.fromEntries(
    ['logos', 'simple-icons', 'lucide'].map((prefix) => [
      prefix,
      JSON.parse(readFileSync(require.resolve(`@iconify-json/${prefix}/icons.json`), 'utf8')),
    ]),
  )
  return sets
}

export function resolveIcon(spec: string) {
  return createIconResolver(loadIconSets()).resolveIcon(spec)
}

export function searchIcons(query: string, limit = 12) {
  return createIconResolver(loadIconSets()).searchIcons(query, limit)
}
