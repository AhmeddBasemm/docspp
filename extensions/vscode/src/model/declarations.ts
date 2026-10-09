// What a diagram declares: its nodes, groups, views, scenarios and custom kinds, with where each
// one is written. Built from the YAML tree, not from the compiled diagram, so it works while the
// text has errors.
import type { Pair } from 'yaml'
import { getPair, isMapNode, keyText, type Parsed, type Span, text } from './yaml'

export type Section = 'nodes' | 'groups' | 'views' | 'scenarios' | 'kinds' | 'edgeKinds'

export const SECTIONS: Section[] = ['nodes', 'groups', 'views', 'scenarios', 'kinds', 'edgeKinds']

export interface Declaration {
  id: string
  section: Section
  /** The id as written. */
  key: Span
  /** The whole entry, from the id to the end of its value. */
  entry: Span
  /** Scalar properties as text: title, kind, sub, status, icon, in, label, caption, family, doc. */
  props: Record<string, string>
  /** Where the value of an explicit `doc:` is written, for renaming the file it points at. */
  docSpan?: Span
}

const PROPS = ['title', 'kind', 'sub', 'status', 'icon', 'in', 'label', 'caption', 'family', 'doc']

export function declarationsOf(parsed: Parsed, root = parsed.root): Declaration[] {
  const out: Declaration[] = []
  for (const section of SECTIONS) {
    const map = getPair(root, section)?.value
    if (!isMapNode(map)) continue
    for (const pair of map.items) {
      const declaration = declare(parsed, section, pair)
      if (declaration) out.push(declaration)
    }
  }
  return out
}

function declare(parsed: Parsed, section: Section, pair: Pair): Declaration | undefined {
  const id = keyText(pair)
  const key = parsed.span(pair.key as never)
  const entry = parsed.pairSpan(pair)
  if (!id || !key || !entry) return undefined

  const props: Record<string, string> = {}
  // `api: API server` is a node written as just its title.
  const direct = text(pair.value)
  if (direct !== undefined) props[section === 'groups' ? 'label' : 'title'] = direct
  if (isMapNode(pair.value)) {
    for (const name of PROPS) {
      const value = text(getPair(pair.value, name)?.value)
      if (value !== undefined) props[name] = value
    }
  }
  const doc = isMapNode(pair.value) ? getPair(pair.value, 'doc')?.value : undefined
  const docSpan = doc ? parsed.span(doc as never) : undefined
  return { id, section, key, entry, props, ...(docSpan ? { docSpan } : {}) }
}
