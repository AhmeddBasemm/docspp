const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Prefix every `id` in an SVG fragment, and every reference to it, with `scope`.
 *
 * Icon sets give gradients and clip paths ids that are only unique inside one icon. Put the same
 * icon on a page twice and both copies share an id; the browser then resolves every reference to
 * the first copy in the document, which draws nothing when that copy is hidden (a collapsed tab, a
 * hidden node). Scoping the ids per instance removes the collision.
 */
export function scopeSvgIds(body: string, scope: string): string {
  const ids = new Set<string>()
  for (const m of body.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]!)
  if (ids.size === 0) return body

  let out = body
  for (const id of ids) {
    const name = escapeRegExp(id)
    const scoped = `${scope}-${id}`
    out = out
      .replace(new RegExp(`\\bid="${name}"`, 'g'), `id="${scoped}"`)
      .replace(new RegExp(`url\\((['"]?)#${name}\\1\\)`, 'g'), `url($1#${scoped}$1)`)
      .replace(new RegExp(`\\b(xlink:)?href="#${name}"`, 'g'), `$1href="#${scoped}"`)
  }
  return out
}
