// The outline of a diagram file: sections, then the nodes, groups, edges, views and scenarios in
// them, and the steps of each scenario. Built from the YAML tree.
import { isScalar, type Node, type Pair } from 'yaml'
import { getPair, isMapNode, isSeqNode, keyText, type Parsed, type Span, text } from './yaml'

export type OutlineKind =
  | 'section'
  | 'node'
  | 'group'
  | 'edge'
  | 'view'
  | 'scenario'
  | 'phase'
  | 'step'
  | 'kind'

export interface OutlineSymbol {
  name: string
  detail?: string
  kind: OutlineKind
  /** The whole entry, for folding and for "which symbol is the cursor in". */
  range: Span
  /** What to select when the symbol is picked. */
  selection: Span
  children: OutlineSymbol[]
}

const SECTION_KIND: Record<string, OutlineKind> = {
  nodes: 'node',
  groups: 'group',
  views: 'view',
  scenarios: 'scenario',
  kinds: 'kind',
  edgeKinds: 'kind',
}

export function outline(parsed: Parsed, file: 'diagram' | 'scenario'): OutlineSymbol[] {
  const root = parsed.root
  if (!root) return []
  if (file === 'scenario') return scenarioBody(parsed, root)

  const out: OutlineSymbol[] = []
  for (const pair of root.items) {
    const name = keyText(pair)
    const range = parsed.pairSpan(pair)
    const selection = parsed.span(pair.key as Node)
    if (!name || !range || !selection) continue

    let children: OutlineSymbol[] = []
    if (name === 'edges' && isSeqNode(pair.value)) {
      children = pair.value.items.map((item) => edgeSymbol(parsed, item)).filter(defined)
    } else if (name in SECTION_KIND && isMapNode(pair.value)) {
      children = pair.value.items.map((p) => entrySymbol(parsed, name, p)).filter(defined)
    } else continue
    out.push({ name, kind: 'section', range, selection, children, detail: String(children.length) })
  }
  return out
}

const defined = <T>(x: T | undefined): x is T => x !== undefined

function entrySymbol(parsed: Parsed, section: string, pair: Pair): OutlineSymbol | undefined {
  const name = keyText(pair)
  const range = parsed.pairSpan(pair)
  const selection = parsed.span(pair.key as Node)
  if (!name || !range || !selection) return undefined
  const kind = SECTION_KIND[section] ?? 'node'
  const value = isMapNode(pair.value) ? pair.value : undefined
  const detail =
    text(pair.value) ??
    [
      text(getPair(value, 'kind')?.value),
      text(getPair(value, 'title')?.value ?? getPair(value, 'label')?.value),
    ]
      .filter(Boolean)
      .join(' · ')
  const children = section === 'scenarios' && value ? scenarioBody(parsed, value) : []
  return { name, detail: detail || undefined, kind, range, selection, children }
}

function scenarioBody(parsed: Parsed, scenario: import('yaml').YAMLMap): OutlineSymbol[] {
  const out: OutlineSymbol[] = []
  const phases = getPair(scenario, 'phases')?.value
  if (isSeqNode(phases)) {
    for (const phase of phases.items) {
      const map = isMapNode(phase) ? phase : undefined
      const range = parsed.span(phase as Node)
      const stepsPair = getPair(map, 'steps')
      if (!map || !range) continue
      const title = text(getPair(map, 'title')?.value) ?? 'phase'
      out.push({
        name: title,
        kind: 'phase',
        range,
        selection: parsed.span(getPair(map, 'title')?.value as Node) ?? range,
        children: stepSymbols(parsed, stepsPair?.value),
      })
    }
  }
  out.push(...stepSymbols(parsed, getPair(scenario, 'steps')?.value))
  return out
}

function stepSymbols(parsed: Parsed, steps: unknown): OutlineSymbol[] {
  if (!isSeqNode(steps)) return []
  return steps.items.map((item) => stepSymbol(parsed, item)).filter(defined)
}

function stepSymbol(parsed: Parsed, item: unknown): OutlineSymbol | undefined {
  const range = parsed.span(item as Node)
  if (!range) return undefined
  if (isScalar(item)) {
    return { name: text(item) ?? '', kind: 'step', range, selection: range, children: [] }
  }
  if (!isMapNode(item)) return undefined
  const first = item.items[0]
  const name = first ? keyText(first) : undefined
  // `- a -> b: label` and `- at a: label` carry their label as the value.
  if (first && name && (/->|^at\s/.test(name) || name === 'par')) {
    const children = name === 'par' ? stepSymbols(parsed, first.value) : []
    const label =
      text(first.value) ??
      text(getPair(isMapNode(first.value) ? first.value : undefined, 'label')?.value)
    return {
      name,
      detail: label,
      kind: 'step',
      range,
      selection: parsed.span(first.key as Node) ?? range,
      children,
    }
  }
  const from = text(getPair(item, 'from')?.value)
  const to = text(getPair(item, 'to')?.value)
  const at = text(getPair(item, 'at')?.value)
  return {
    name: from && to ? `${from} -> ${to}` : at ? `at ${at}` : 'step',
    detail: text(getPair(item, 'label')?.value),
    kind: 'step',
    range,
    selection: range,
    children: [],
  }
}

function edgeSymbol(parsed: Parsed, item: unknown): OutlineSymbol | undefined {
  const range = parsed.span(item as Node)
  if (!range) return undefined
  if (isScalar(item)) {
    return { name: text(item) ?? '', kind: 'edge', range, selection: range, children: [] }
  }
  if (!isMapNode(item)) return undefined
  const first = item.items[0]
  const key = first ? keyText(first) : undefined
  if (first && key && /->/.test(key) && !getPair(item, 'from')) {
    const label =
      text(first.value) ??
      text(getPair(isMapNode(first.value) ? first.value : undefined, 'label')?.value)
    return {
      name: key,
      detail: label,
      kind: 'edge',
      range,
      selection: parsed.span(first.key as Node) ?? range,
      children: [],
    }
  }
  const from = text(getPair(item, 'from')?.value)
  const to = text(getPair(item, 'to')?.value)
  return {
    name: from && to ? `${from} -> ${to}` : 'edge',
    detail: text(getPair(item, 'label')?.value),
    kind: 'edge',
    range,
    selection: range,
    children: [],
  }
}
