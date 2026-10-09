// A parsed YAML document with positions as editors count them (0-based line and character).
import {
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  type Node,
  type Pair,
  parseDocument,
  type Scalar,
  type YAMLMap,
  type YAMLSeq,
} from 'yaml'

export interface Pos {
  line: number
  character: number
}

export interface Span {
  start: Pos
  end: Pos
}

export type Segment = string | number

export class Parsed {
  readonly counter = new LineCounter()
  readonly doc: ReturnType<typeof parseDocument>

  constructor(readonly text: string) {
    // Never throws: a half-typed document still has a tree for completion and navigation.
    this.doc = parseDocument(text, { lineCounter: this.counter, uniqueKeys: false })
  }

  /** The root mapping, if the document is one. */
  get root(): YAMLMap | undefined {
    return isMap(this.doc.contents) ? this.doc.contents : undefined
  }

  pos(offset: number): Pos {
    const { line, col } = this.counter.linePos(offset)
    return { line: line - 1, character: col - 1 }
  }

  /** Where a node's text is. Quotes of quoted scalars are left out, so the span is the value. */
  span(node: Node | null | undefined): Span | undefined {
    const range = node?.range
    if (!range) return undefined
    const quoted = isScalar(node) && (node.type === 'QUOTE_DOUBLE' || node.type === 'QUOTE_SINGLE')
    const [start, end] = quoted
      ? [range[0] + 1, range[1] - 1]
      : [range[0], this.trim(range[0], range[1])]
    return { start: this.pos(start), end: this.pos(Math.max(start, end)) }
  }

  /** A block node's range runs to the start of the next line; pull its end back over whitespace. */
  private trim(start: number, end: number): number {
    let e = end
    while (e > start && /\s/.test(this.text[e - 1] ?? '')) e--
    return e
  }

  /** The span from the start of a pair's key to the end of its value. */
  pairSpan(pair: Pair): Span | undefined {
    const key = (pair.key as Node | null)?.range
    const value = (pair.value as Node | null)?.range
    if (!key) return undefined
    const end = this.trim(key[0], Math.max(key[1], value?.[1] ?? key[1]))
    return { start: this.pos(key[0]), end: this.pos(end) }
  }

  /** Offset of a position in the text. */
  offset(pos: Pos): number {
    let offset = 0
    const lines = this.text.split('\n')
    for (let i = 0; i < pos.line && i < lines.length; i++) offset += (lines[i]?.length ?? 0) + 1
    return offset + pos.character
  }
}

/** The mapping value for `key` in `map`, with the pair that holds it. */
export function getPair(map: YAMLMap | null | undefined, key: string): Pair | undefined {
  if (!isMap(map)) return undefined
  return map.items.find((p) => isScalar(p.key) && p.key.value === key)
}

export function getValue(map: YAMLMap | null | undefined, key: string): unknown {
  return getPair(map, key)?.value
}

/** A scalar's string form (numbers and booleans included); undefined for anything else. */
export function text(node: unknown): string | undefined {
  if (!isScalar(node)) return undefined
  const v = (node as Scalar).value
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : undefined
}

export function keyText(pair: Pair): string | undefined {
  return text(pair.key)
}

export const isMapNode = isMap as (n: unknown) => n is YAMLMap
export const isSeqNode = isSeq as (n: unknown) => n is YAMLSeq

/** The node at `path` below `root`, following map keys and sequence indices. */
export function nodeAt(root: unknown, path: Segment[]): unknown {
  let node = root
  for (const seg of path) {
    if (isMap(node)) node = getValue(node, String(seg))
    else if (isSeq(node) && typeof seg === 'number') node = node.items[seg]
    else return undefined
  }
  return node
}

export interface Where {
  /** Keys and `-` items leading to the mapping the position is in. */
  path: string[]
  /** The pair whose key or value the position is on. */
  pair?: Pair
  onKey: boolean
  /** The scalar value under the position. */
  value?: Scalar
}

/** The structure around an editor position, read from the tree. */
export function whereIs(parsed: Parsed, pos: Pos): Where | undefined {
  const offset = parsed.offset(pos)
  const inside = (n: unknown, to?: unknown) => {
    const a = (n as Node | null)?.range
    const b = ((to ?? n) as Node | null)?.range
    return !!a && !!b && offset >= a[0] && offset <= b[1]
  }
  let node: unknown = parsed.doc.contents
  const path: string[] = []
  let pair: Pair | undefined
  for (let guard = 0; guard < 64; guard++) {
    if (isMap(node)) {
      const hit = node.items.find((p) => inside(p.key, p.value ?? p.key))
      if (!hit) return { path, pair, onKey: false }
      pair = hit
      if (inside(hit.key)) return { path, pair, onKey: true }
      path.push(keyText(hit) ?? '')
      node = hit.value
    } else if (isSeq(node)) {
      const item = node.items.find((i) => inside(i))
      if (!item) return { path, pair, onKey: false }
      path.push('-')
      node = item
    } else {
      return { path, pair, onKey: false, value: isScalar(node) ? (node as Scalar) : undefined }
    }
  }
  return undefined
}
