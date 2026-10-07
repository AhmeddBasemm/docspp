import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { IconifyJSON } from '@iconify/types'
import { getIconData, iconToSVG } from '@iconify/utils'
import type { IconData } from './types'

const require = createRequire(import.meta.url)

/** Search order for bare names: brand logos first, then monochrome brand marks, then generic UI icons. */
const SETS = [
  { prefix: 'logos', pkg: '@iconify-json/logos', mono: false },
  { prefix: 'simple-icons', pkg: '@iconify-json/simple-icons', mono: true },
  { prefix: 'lucide', pkg: '@iconify-json/lucide', mono: true },
] as const

const ALIASES: Record<string, string> = {
  postgres: 'postgresql',
  pg: 'postgresql',
  k8s: 'kubernetes',
  mongo: 'mongodb',
  node: 'nodejs',
  es: 'elasticsearch',
  elastic: 'elasticsearch',
  rabbit: 'rabbitmq',
  dotnet: 'dotnet',
  '.net': 'dotnet',
  ts: 'typescript',
  js: 'javascript',
}

const cache = new Map<string, IconifyJSON>()

function loadSet(prefix: string): IconifyJSON | undefined {
  const def = SETS.find((s) => s.prefix === prefix)
  if (!def) return undefined
  let set = cache.get(prefix)
  if (!set) {
    set = JSON.parse(readFileSync(require.resolve(`${def.pkg}/icons.json`), 'utf8')) as IconifyJSON
    cache.set(prefix, set)
  }
  return set
}

function fromSet(prefix: string, name: string): IconData | undefined {
  const set = loadSet(prefix)
  if (!set) return undefined
  const data = getIconData(set, name)
  if (!data) return undefined
  const built = iconToSVG({
    ...data,
    width: data.width ?? set.width ?? 16,
    height: data.height ?? set.height ?? 16,
    left: data.left ?? 0,
    top: data.top ?? 0,
  } as Parameters<typeof iconToSVG>[0])
  return {
    body: built.body,
    viewBox: built.attributes.viewBox,
    mono: SETS.find((s) => s.prefix === prefix)!.mono,
    set: prefix,
    name,
  }
}

export interface IconResult {
  icon?: IconData
  suggestions: string[]
}

/** `postgresql`, `logos:postgresql`, `lucide:server`. Local SVG files are handled by the loader. */
export function resolveIcon(spec: string): IconResult {
  const trimmed = spec.trim()
  const colon = trimmed.indexOf(':')
  if (colon > 0) {
    const icon = fromSet(trimmed.slice(0, colon), trimmed.slice(colon + 1))
    return icon
      ? { icon, suggestions: [] }
      : { suggestions: searchIcons(trimmed.slice(colon + 1), 5) }
  }
  const base = ALIASES[trimmed.toLowerCase()] ?? trimmed.toLowerCase()
  for (const s of SETS) {
    // The `-icon` variant is the compact mark; the bare name is often the full wordmark.
    for (const candidate of [`${base}-icon`, base]) {
      const icon = fromSet(s.prefix, candidate)
      if (icon) return { icon, suggestions: [] }
    }
  }
  return { suggestions: searchIcons(base, 5) }
}

export interface IconHit {
  id: string
  set: string
}

/** Substring search across the bundled sets; exact and prefix matches rank first. */
export function searchIcons(query: string, limit = 12): string[] {
  const q = query.toLowerCase()
  if (!q) return []
  const scored: { id: string; score: number }[] = []
  for (const s of SETS) {
    const set = loadSet(s.prefix)
    if (!set) continue
    const names = [...Object.keys(set.icons), ...Object.keys(set.aliases ?? {})]
    for (const name of names) {
      const n = name.toLowerCase()
      if (!n.includes(q)) continue
      const score = n === q || n === `${q}-icon` ? 0 : n.startsWith(q) ? 1 : 2
      scored.push({ id: `${s.prefix}:${name}`, score: score * 10 + SETS.indexOf(s) })
    }
  }
  return scored
    .sort((a, b) => a.score - b.score || a.id.length - b.id.length)
    .slice(0, limit)
    .map((s) => s.id)
}

/** Wrap a local SVG file as icon data. Assumes the file is trusted project content. */
export function iconFromSvg(svg: string, name: string): IconData | undefined {
  const open = svg.match(/<svg\b([^>]*)>/i)
  if (!open) return undefined
  const attrs = open[1] ?? ''
  const vb = attrs.match(/viewBox="([^"]+)"/i)?.[1]
  const w = Number(attrs.match(/\bwidth="([\d.]+)/i)?.[1])
  const h = Number(attrs.match(/\bheight="([\d.]+)/i)?.[1])
  const viewBox = vb ?? (w && h ? `0 0 ${w} ${h}` : '0 0 24 24')
  const body = svg.slice(open.index! + open[0].length).replace(/<\/svg>\s*$/i, '')
  const mono = /currentColor/.test(body)
  return { body, viewBox, mono, set: 'local', name }
}
