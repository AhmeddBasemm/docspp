import { BUILTIN_EDGE_KINDS, BUILTIN_KINDS } from '@packagelab/idocs-core'
import type { RootInput } from '@packagelab/idocs-core/browser'
import { useState } from 'react'
import type { Document } from 'yaml'
import { type Entity, groupOptions, nextId, removeEntity, type Selection, setFields } from './model'

interface Props {
  model: RootInput
  selection: Selection
  onSelect: (selection: Selection) => void
  onEdit: (edit: (doc: Document, model: RootInput) => void) => void
}
const families = ['blue', 'amber', 'violet', 'green', 'teal', 'red', 'slate']
const statuses = ['built', 'planned', 'legacy', 'optional']

export function Builder({ model, selection, onSelect, onEdit }: Props) {
  const [entity, setEntity] = useState<Entity>('nodes')
  const [kind, setKind] = useState('service')
  const tab = selection?.entity ?? entity
  const nodeIds = Object.keys(model.nodes)
  const groups = groupOptions(model, selection?.entity === 'groups' ? selection.id : undefined)
  const chosen =
    selection?.entity === 'nodes'
      ? model.nodes[selection.id]
      : selection?.entity === 'groups'
        ? model.groups?.[selection.id]
        : selection?.entity === 'edges'
          ? model.edges?.[Number(selection.id)]
          : undefined
  const patch = (fields: Record<string, unknown>) => {
    if (selection)
      onEdit((doc, current) => setFields(doc, current, selection.entity, selection.id, fields))
  }
  const value = (field: string) =>
    String((chosen as Record<string, unknown> | undefined)?.[field] ?? '')
  const textField = (label: string, field: string, placeholder?: string) => (
    <label className="pg-field">
      {label}
      <input
        value={value(field)}
        placeholder={placeholder}
        onChange={(e) => patch({ [field]: e.target.value })}
      />
    </label>
  )
  const selectField = (
    label: string,
    field: string,
    options: string[],
    defaultLabel = 'Default',
  ) => (
    <label className="pg-field">
      {label}
      <select
        aria-label={label}
        value={value(field)}
        onChange={(e) => patch({ [field]: e.target.value })}
      >
        <option value="" disabled={field === 'from' || field === 'to'}>
          {defaultLabel}
        </option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  )
  const add = () => {
    if (tab === 'nodes') {
      const id = nextId(kind, nodeIds)
      onEdit((doc) =>
        doc.setIn(['nodes', id], {
          title: id === kind ? kind[0]!.toUpperCase() + kind.slice(1) : id,
          kind,
        }),
      )
      onSelect({ entity: 'nodes', id })
    } else if (tab === 'groups') {
      const id = nextId('group', Object.keys(model.groups ?? {}))
      onEdit((doc) =>
        doc.setIn(['groups', id], { label: id === 'group' ? 'New group' : id, family: 'blue' }),
      )
      onSelect({ entity: 'groups', id })
    } else {
      const id = String(model.edges?.length ?? 0)
      onEdit((doc, current) => {
        if (!current.edges) doc.set('edges', [])
        doc.addIn(['edges'], {
          from: nodeIds[0],
          to: nodeIds[1],
          label: 'Connection',
          kind: 'http',
        })
      })
      onSelect({ entity: 'edges', id })
    }
  }
  const entries =
    tab === 'nodes'
      ? Object.entries(model.nodes).map(([id, node]) => ({
          id,
          label: node.title ?? id,
          sub: node.kind ?? 'node',
        }))
      : tab === 'groups'
        ? Object.entries(model.groups ?? {}).map(([id, group]) => ({
            id,
            label: group.label,
            sub: `${Object.values(model.nodes).filter((n) => n.in === id).length} nodes`,
          }))
        : (model.edges ?? []).map((edge, index) => ({
            id: String(index),
            label: `${edge.from} → ${edge.to}`,
            sub: edge.label ?? edge.kind ?? 'http',
          }))
  const viewId = Object.keys(model.views ?? {})[0] ?? 'overview'
  return (
    <div className="pg-builder">
      <label className="pg-field">
        Diagram title
        <input
          value={model.title}
          onChange={(e) => onEdit((doc) => doc.set('title', e.target.value))}
        />
      </label>
      <label className="pg-field">
        Flow direction
        <select
          aria-label="Flow direction"
          value={model.views?.[viewId]?.direction ?? 'AUTO'}
          onChange={(e) =>
            onEdit((doc) => doc.setIn(['views', viewId, 'direction'], e.target.value))
          }
        >
          {['AUTO', 'RIGHT', 'DOWN', 'LEFT', 'UP'].map((direction) => (
            <option key={direction} value={direction}>
              {direction === 'AUTO' ? 'Automatic' : direction.toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="pg-segments" aria-label="Builder sections">
        {(['nodes', 'groups', 'edges'] as const).map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={tab === item}
            onClick={() => {
              setEntity(item)
              onSelect(null)
            }}
          >
            {item === 'edges' ? 'Connections' : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </fieldset>
      <div className="pg-add-row">
        {tab === 'nodes' && (
          <select aria-label="New node kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.keys({ ...BUILTIN_KINDS, ...model.kinds }).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        )}
        <button
          className="pg-button pg-primary"
          type="button"
          onClick={add}
          disabled={tab === 'edges' && nodeIds.length < 2}
        >
          + Add {tab === 'nodes' ? 'node' : tab === 'groups' ? 'group' : 'connection'}
        </button>
      </div>
      {tab === 'edges' && nodeIds.length < 2 && (
        <p className="pg-note">Add two nodes to connect them.</p>
      )}
      <section className="pg-entity-list" aria-label={tab}>
        {entries.map((entry) => (
          <button
            type="button"
            key={entry.id}
            aria-pressed={selection?.id === entry.id && selection.entity === tab}
            onClick={() => onSelect({ entity: tab, id: entry.id })}
          >
            <span>
              {entry.label}
              <small>{entry.sub}</small>
            </span>
            <code>{tab === 'edges' ? `#${Number(entry.id) + 1}` : entry.id}</code>
          </button>
        ))}
        {!entries.length && (
          <p className="pg-note">
            No {tab === 'edges' ? 'connections' : tab} yet. Add your first one above.
          </p>
        )}
      </section>
      {selection && chosen ? (
        <div className="pg-inspector" key={`${selection.entity}:${selection.id}`}>
          <div className="pg-inspector-heading">
            <strong>
              Edit{' '}
              {selection.entity === 'nodes'
                ? 'node'
                : selection.entity === 'groups'
                  ? 'group'
                  : 'connection'}
            </strong>
            <code>{selection.id}</code>
          </div>
          {selection.entity === 'nodes' && (
            <>
              {textField('Title', 'title', selection.id)}
              {textField('Subtitle', 'sub', 'Stack, port, or version')}
              {selectField(
                'Kind',
                'kind',
                Object.keys({ ...BUILTIN_KINDS, ...model.kinds }),
                'No kind',
              )}
              {textField('Icon', 'icon', 'postgresql or lucide:server')}
              {selectField('Group', 'in', groups, 'Ungrouped')}
              <label className="pg-field">
                Body lines <small>One line per row</small>
                <textarea
                  rows={3}
                  value={model.nodes[selection.id]?.lines?.join('\n') ?? ''}
                  onChange={(e) =>
                    patch({ lines: e.target.value ? e.target.value.split('\n') : undefined })
                  }
                />
              </label>
              <label className="pg-field">
                Description <small>Markdown, shown in the details drawer</small>
                <textarea
                  rows={3}
                  value={value('description')}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </label>
            </>
          )}
          {selection.entity === 'groups' && (
            <>
              {textField('Label', 'label')}
              {textField('Caption', 'caption')}
              {selectField('Parent group', 'in', groups, 'Top level')}
              {selectField('Layout', 'layout', ['flow', 'row', 'grid'])}
              {selectField('Group direction', 'direction', ['AUTO', 'RIGHT', 'DOWN'])}
            </>
          )}
          {selection.entity === 'edges' && (
            <>
              {selectField('From', 'from', nodeIds, 'Choose a node')}
              {selectField('To', 'to', nodeIds, 'Choose a node')}
              {textField('Connection label', 'label')}
              {selectField(
                'Connection kind',
                'kind',
                Object.keys({ ...BUILTIN_EDGE_KINDS, ...model.edgeKinds }),
              )}
              <label className="pg-check">
                <input
                  type="checkbox"
                  checked={model.edges?.[Number(selection.id)]?.both ?? false}
                  onChange={(e) => patch({ both: e.target.checked || undefined })}
                />
                Arrows in both directions
              </label>
            </>
          )}
          {selection.entity !== 'edges' && selectField('Color', 'family', families)}
          {selectField('Status', 'status', statuses, 'Built (default)')}
          <button
            className="pg-button pg-danger"
            type="button"
            onClick={() => {
              onEdit((doc, current) => removeEntity(doc, current, selection))
              onSelect(null)
            }}
          >
            Delete{' '}
            {selection.entity === 'nodes'
              ? 'node and its connections'
              : selection.entity === 'groups'
                ? 'group'
                : 'connection'}
          </button>
        </div>
      ) : (
        <p className="pg-note">Select an item above, or click a node in the diagram to edit it.</p>
      )}
    </div>
  )
}
