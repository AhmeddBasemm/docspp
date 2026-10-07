import type { CompiledDiagram, CompiledView } from '@packagelab/docspp-core'
import { colorVar } from './util'

export function Legend({ diagram, view }: { diagram: CompiledDiagram; view: CompiledView }) {
  const drawn = view.edgeIds.map((id) => diagram.edges[id]!).filter((e) => !e.hidden)
  const kinds = [...new Set(drawn.map((e) => e.kind))]
  const planned =
    drawn.some((e) => e.status === 'planned') ||
    view.nodeIds.some((id) => diagram.nodes[id]!.status === 'planned')
  if (kinds.length === 0 && !planned) return null
  return (
    <div className="docspp-legend" role="group" aria-label="Legend">
      {kinds.map((k) => {
        const def = diagram.edgeKinds[k]!
        const color = colorVar(def.color)
        return (
          <span key={k}>
            <svg viewBox="0 0 44 12" aria-hidden="true">
              <line
                x1="2"
                y1="6"
                x2="34"
                y2="6"
                stroke={color}
                strokeWidth={def.width}
                strokeDasharray={def.dash}
                strokeLinecap={def.width >= 4 ? 'round' : undefined}
              />
              <path d="M32 2L41 6L32 10z" fill={color} />
            </svg>
            {def.label}
          </span>
        )
      })}
      {planned && (
        <span>
          <svg viewBox="0 0 44 12" aria-hidden="true">
            <line
              x1="2"
              y1="6"
              x2="34"
              y2="6"
              stroke="var(--docspp-accent)"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
            <path d="M32 2L41 6L32 10z" fill="var(--docspp-accent)" />
          </svg>
          Dashed: planned
        </span>
      )}
    </div>
  )
}
