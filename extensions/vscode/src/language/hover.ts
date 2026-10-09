// Hover text. A node shows what the diagram knows about it; a key shows its documentation; an icon
// shows the icon. Pure: returns markdown and the span it applies to.
import {
  BUILTIN_EDGE_KINDS,
  BUILTIN_KINDS,
  type CompiledDiagram,
  type IconData,
} from '@packagelab/docspp-core'
import type { Declaration } from '../model/declarations'
import { declarationOf, type Reference, type SymbolRef, symbolAt } from '../model/references'
import { type Parsed, type Pos, type Span, whereIs } from '../model/yaml'
import { contextOf } from './context'
import { type Context, propOf } from './vocabulary'

export interface HoverRequest {
  parsed: Parsed
  position: Pos
  file: 'diagram' | 'scenario'
  /** What diagram.yaml declares, for looking up names. */
  declarations: Declaration[]
  /** Uses of ids in the file under the cursor. */
  refs: Reference[]
  diagram?: CompiledDiagram
  resolveIcon(spec: string): IconData | undefined
}

export interface HoverResult {
  markdown: string
  span: Span
}

const STATUS_TEXT: Record<string, string> = {
  built: 'Exists today. The default.',
  planned: 'Not built yet. Drawn dashed; readers can hide planned items.',
  legacy: 'Still running, but being replaced.',
  optional: 'Present in some deployments only.',
}

export function hover(req: HoverRequest): HoverResult | undefined {
  // Declarations are positions in diagram.yaml, so they can only be under the cursor there.
  const symbol = symbolAt(req.position, req.refs, req.file === 'diagram' ? req.declarations : [])
  if (symbol) return symbolHover(symbol, req)
  return valueHover(req) ?? keyHover(req)
}

// -- Symbols ------------------------------------------------------------------------------------

function symbolHover(symbol: SymbolRef, req: HoverRequest): HoverResult | undefined {
  const declared = declarationOf(symbol, req.declarations)
  const lines: string[] = []
  const { diagram } = req

  if (symbol.namespace === 'view') {
    const view = diagram?.views.find((v) => v.id === symbol.id)
    const title = view?.title ?? declared?.props.title
    lines.push(`**${title ?? symbol.id}** · view \`${symbol.id}\``)
    if (view) lines.push(`${view.nodeIds.length} nodes · ${view.edgeIds.length} edges`)
  } else if (diagram?.groups[symbol.id] || declared?.section === 'groups') {
    const group = diagram?.groups[symbol.id]
    lines.push(`**${group?.label ?? declared?.props.label ?? symbol.id}** · group \`${symbol.id}\``)
    if (group?.caption ?? declared?.props.caption)
      lines.push(`_${group?.caption ?? declared?.props.caption}_`)
    if (diagram) {
      const members = Object.values(diagram.nodes).filter((n) => n.group === symbol.id)
      if (members.length) lines.push(`Members: ${list(members.map((n) => n.id))}`)
    }
  } else {
    const node = diagram?.nodes[symbol.id]
    const title = node?.title ?? declared?.props.title ?? symbol.id
    lines.push(`**${title}** · \`${symbol.id}\``)
    const kind = node?.kind ?? declared?.props.kind
    const status = node?.status ?? declared?.props.status
    const facts = [kind, status && status !== 'built' ? status : undefined].filter(Boolean)
    if (facts.length) lines.push(facts.join(' · '))
    const sub = node?.sub ?? declared?.props.sub
    if (sub) lines.push(`\`${sub}\``)
    if (node?.lines.length) lines.push(node.lines.join('  \n'))
    if (diagram && node) {
      const edges = Object.values(diagram.edges)
      const out = edges.filter((e) => e.from === node.id).map((e) => e.to)
      const into = edges.filter((e) => e.to === node.id).map((e) => e.from)
      if (out.length) lines.push(`→ ${list(out)}`)
      if (into.length) lines.push(`← ${list(into)}`)
    }
  }
  if (!declared && !req.diagram?.nodes[symbol.id] && !req.diagram?.groups[symbol.id]) {
    lines.push('_Not declared in this diagram._')
  }
  return { markdown: lines.join('\n\n'), span: symbol.span }
}

const list = (ids: string[]) => {
  const unique = [...new Set(ids)]
  const shown = unique
    .slice(0, 6)
    .map((id) => `\`${id}\``)
    .join(', ')
  return unique.length > 6 ? `${shown} and ${unique.length - 6} more` : shown
}

// -- Values -------------------------------------------------------------------------------------

function valueHover(req: HoverRequest): HoverResult | undefined {
  const at = whereIs(req.parsed, req.position)
  if (!at?.value || at.onKey || !at.pair) return undefined
  const key =
    at.pair.key && typeof (at.pair.key as { value?: unknown }).value === 'string'
      ? (at.pair.key as { value: string }).value
      : undefined
  const value = typeof at.value.value === 'string' ? at.value.value : undefined
  const span = req.parsed.span(at.value)
  if (!key || !value || !span) return undefined
  const context = contextOf(at.path, req.file)

  if (key === 'icon') {
    const icon = req.resolveIcon(value)
    if (!icon) return { markdown: `No icon named \`${value}\`. Try \`docspp icons search\`.`, span }
    return { markdown: `${iconImage(icon)}\n\n\`${icon.set}:${icon.name}\``, span }
  }
  if (key === 'status' && STATUS_TEXT[value]) {
    return { markdown: `**${value}**: ${STATUS_TEXT[value]}`, span }
  }
  if (key === 'kind') return { markdown: kindText(context, value, req.diagram), span }
  return undefined
}

function kindText(context: Context | undefined, kind: string, diagram?: CompiledDiagram): string {
  if (context === 'edge') {
    const def = diagram?.edgeKinds[kind] ?? BUILTIN_EDGE_KINDS[kind]
    return def ? `**${kind}**: ${def.label}` : `**${kind}**: a custom edge kind.`
  }
  if (context === 'step') {
    return `**${kind}**: ${STEP_KIND_TEXT[kind] ?? 'a step kind'}`
  }
  const def = BUILTIN_KINDS[kind]
  if (!def) return `**${kind}**: a custom node kind.`
  return `**${kind}**: default icon \`${def.icon}\`${def.family ? `, colour family \`${def.family}\`` : ''}.`
}

const STEP_KIND_TEXT: Record<string, string> = {
  request: 'A request travelling towards the callee. The default.',
  response: 'A reply travelling back to the caller.',
  error: 'A failure, drawn in the error colour.',
  lookup: 'A quick read, such as a cache or database lookup.',
  event: 'A message published for someone else to pick up.',
}

/** An icon as a data URI, tinted grey when it is monochrome so it reads on light and dark themes. */
export function iconImage(icon: IconData): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" width="32" height="32"${
    icon.mono ? ' color="#7a8896"' : ''
  }>${icon.body}</svg>`
  return `![${icon.name}](data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')})`
}

// -- Keys ---------------------------------------------------------------------------------------

function keyHover(req: HoverRequest): HoverResult | undefined {
  const at = whereIs(req.parsed, req.position)
  if (!at?.onKey || !at.pair) return undefined
  const key = (at.pair.key as { value?: unknown }).value
  const span = req.parsed.span(at.pair.key as never)
  if (typeof key !== 'string' || !span) return undefined
  const context = contextOf(at.path, req.file)
  const prop = context ? propOf(context, key) : undefined
  if (!prop || (!prop.description && !prop.values)) return undefined
  const parts = [`**${key}**`]
  if (prop.description) parts.push(prop.description)
  if (prop.values) parts.push(prop.values.map((v) => `\`${v}\``).join(' · '))
  return { markdown: parts.join('\n\n'), span }
}
