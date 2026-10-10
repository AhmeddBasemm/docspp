import type { CompiledDiagram, CompiledView } from '@the-package-labs/idocs-core'
import { cx } from './util'

interface Props {
  diagram: CompiledDiagram
  view: CompiledView
  hover: string | null
  onHover: (edgeId: string | null) => void
}

export function InterfaceTable({ diagram, view, hover, onHover }: Props) {
  const edges = view.edgeIds.map((id) => diagram.edges[id]!).filter((e) => !e.hidden)
  if (edges.length === 0) return null
  const title = (id: string) => diagram.nodes[id]?.title ?? id
  return (
    <div className="idocs-table-wrap">
      <table className="idocs-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>From → To</th>
            <th>Kind</th>
            <th>Auth</th>
            <th>What travels</th>
          </tr>
        </thead>
        <tbody>
          {edges.map((e) => (
            <tr
              key={e.id}
              className={cx(hover === e.id && 'is-hl')}
              onMouseEnter={() => onHover(e.id)}
              onMouseLeave={() => onHover(null)}
            >
              <td>{view.keys[e.id] ?? ''}</td>
              <td>
                {title(e.from)} {e.both ? '↔' : '→'} {title(e.to)}
              </td>
              <td>
                <span className="idocs-kind-tag">{e.kind}</span>
              </td>
              <td>{e.auth ?? '—'}</td>
              <td>{e.payload ?? e.label ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
