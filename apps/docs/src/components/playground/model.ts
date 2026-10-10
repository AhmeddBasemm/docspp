import { normalizeRoot, type RootInput, RootSchema } from '@packagelab/idocs-core/browser'
import { type Document, isMap, parseDocument } from 'yaml'

export type Entity = 'nodes' | 'groups' | 'edges'
export type Selection = { entity: Entity; id: string } | null

export function readModel(text: string): RootInput | null {
  try {
    const doc = parseDocument(text)
    if (doc.errors.length) return null
    const result = RootSchema.safeParse(normalizeRoot(doc.toJS({ maxAliasCount: 50 })))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function nextId(label: string, existing: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'node'
  let id = base
  let i = 2
  while (existing.includes(id)) id = `${base}-${i++}`
  return id
}

/** Patch the YAML AST so unrelated comments, shorthand and properties survive visual edits. */
export function editSource(text: string, edit: (doc: Document, model: RootInput) => void): string {
  const model = readModel(text)
  if (!model) throw new Error('Fix the YAML errors before using the builder.')
  const doc = parseDocument(text)
  edit(doc, model)
  return doc.toString({ lineWidth: 100 })
}

export function setFields(
  doc: Document,
  model: RootInput,
  entity: Entity,
  id: string,
  fields: Record<string, unknown>,
) {
  const key = entity === 'edges' ? Number(id) : id
  const path = [entity, key]
  // Expand only the edited entity; everything else keeps its original shorthand.
  const target = doc.getIn(path, true)
  if (!isMap(target) || (entity === 'edges' && !target.has('from'))) {
    const value = entity === 'edges' ? model.edges?.[Number(id)] : model[entity]?.[id]
    const original = doc.getIn(path, true) as
      | { comment?: string; commentBefore?: string; spaceBefore?: boolean }
      | undefined
    const expanded = doc.createNode(value ?? {})
    if (original) {
      expanded.comment = original.comment
      expanded.commentBefore = original.commentBefore
      expanded.spaceBefore = original.spaceBefore
    }
    doc.setIn(path, expanded)
  }
  if (
    'in' in fields &&
    fields.in !==
      (entity === 'groups'
        ? model.groups?.[id]?.in
        : entity === 'nodes'
          ? model.nodes[id]?.in
          : undefined)
  )
    removeFromRows(doc, model, id)
  for (const [field, value] of Object.entries(fields)) {
    if (value === undefined || (value === '' && !(entity === 'groups' && field === 'label')))
      doc.deleteIn([...path, field])
    else doc.setIn([...path, field], value)
  }
}

function removeFromRows(doc: Document, model: RootInput, id: string) {
  for (const [gid, group] of Object.entries(model.groups ?? {})) {
    const currentRows =
      (
        doc.getIn(['groups', gid, 'rows']) as { toJSON?: () => string[][] } | undefined
      )?.toJSON?.() ?? group.rows
    if (!currentRows?.some((row) => row.includes(id))) continue
    const rows = currentRows
      .map((row) => row.filter((member) => member !== id))
      .filter((row) => row.length)
    if (rows.length) doc.setIn(['groups', gid, 'rows'], rows)
    else doc.deleteIn(['groups', gid, 'rows'])
  }
}

export function removeEntity(doc: Document, model: RootInput, selection: NonNullable<Selection>) {
  const { entity, id } = selection
  if (entity === 'edges') {
    doc.deleteIn(['edges', Number(id)])
    return
  }
  if (entity === 'nodes') {
    // Scenario routing can also depend on a node not explicitly mentioned by a step.
    // Keep those references intact; authors can edit the scenario before deleting the node.
    if (Object.keys(model.scenarios ?? {}).length) {
      throw new Error(
        'This diagram has scenarios. Remove or update them in YAML before deleting nodes.',
      )
    }
    const indices = (model.edges ?? []).flatMap((edge, index) =>
      edge.from === id || edge.to === id ? [index] : [],
    )
    for (const index of indices.reverse()) doc.deleteIn(['edges', index])
  } else {
    const parent = model.groups?.[id]?.in
    for (const [nid, node] of Object.entries(model.nodes)) {
      if (node.in === id) setFields(doc, model, 'nodes', nid, { in: parent })
    }
    for (const [gid, group] of Object.entries(model.groups ?? {})) {
      if (group.in === id) setFields(doc, model, 'groups', gid, { in: parent })
    }
  }
  removeFromRows(doc, model, id)
  for (const [vid, view] of Object.entries(model.views ?? {})) {
    for (const field of ['include', 'exclude'] as const) {
      const value = view[field]
      if (Array.isArray(value) && value.includes(id)) {
        doc.setIn(
          ['views', vid, field],
          value.filter((member) => member !== id),
        )
      }
    }
  }
  doc.deleteIn([entity, id])
}

export function groupOptions(model: RootInput, selectedGroup?: string): string[] {
  return Object.keys(model.groups ?? {}).filter((id) => {
    const seen = new Set<string>()
    for (let current: string | undefined = id; current; current = model.groups?.[current]?.in) {
      if (current === selectedGroup || seen.has(current)) return false
      seen.add(current)
    }
    return true
  })
}
