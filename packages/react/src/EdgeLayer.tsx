import { type CompiledDiagram, type CompiledView, type Layout, roundedPath } from '@docspp/core'
import { colorVar, cx } from './util'

export interface EdgeState {
  hl?: boolean
  dim?: boolean
  lit?: boolean
  trail?: boolean
  hidden?: boolean
}

interface Props {
  uid: string
  diagram: CompiledDiagram
  view: CompiledView
  layout: Layout
  stateOf: (edgeId: string) => EdgeState
  onHover: (edgeId: string | null) => void
  register: (edgeId: string, el: SVGPathElement | null) => void
}

export function EdgeLayer({ uid, diagram, view, layout, stateOf, onHover, register }: Props) {
  const kinds = [...new Set(view.edgeIds.map((id) => diagram.edges[id]!.kind))]
  return (
    <svg className="docspp-svg" width={layout.width} height={layout.height} aria-hidden="true">
      <defs>
        {kinds.map((k) => {
          const def = diagram.edgeKinds[k]!
          const size = Math.max(8, def.width * 2.6)
          return (
            <marker
              key={k}
              id={`${uid}-ah-${k}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth={size}
              markerHeight={size}
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10z" fill={colorVar(def.color)} />
            </marker>
          )
        })}
      </defs>
      {view.edgeIds.map((id) => {
        const e = diagram.edges[id]!
        const l = layout.edges[id]
        if (!l) return null
        const def = diagram.edgeKinds[e.kind]!
        const s = stateOf(id)
        const d = roundedPath(l.points, 9)
        const marker = `url(#${uid}-ah-${e.kind})`
        return (
          <g key={id} onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)}>
            {!e.hidden && <path className="docspp-edge-hit" d={d} />}
            <path
              ref={(el) => register(id, el)}
              className={cx(
                'docspp-edge',
                e.hidden && 'is-ghost',
                `st-${e.status}`,
                s.hl && 'is-hl',
                s.dim && 'is-dim',
                s.lit && 'is-lit',
                s.trail && 'is-trail',
                s.hidden && 'is-hidden',
              )}
              d={d}
              style={
                { '--ec': colorVar(def.color), '--ew': `${def.width}px` } as React.CSSProperties
              }
              strokeDasharray={e.status === 'built' ? def.dash : undefined}
              strokeLinecap={def.width >= 4 ? 'round' : undefined}
              markerEnd={marker}
              markerStart={e.both ? marker : undefined}
            />
          </g>
        )
      })}
      {view.edgeIds.map((id) => {
        const l = layout.edges[id]
        const e = diagram.edges[id]!
        if (!l?.label) return null
        const key = view.keys[id]
        const s = stateOf(id)
        const r = l.label
        const textX = r.x + (key ? 22 : 0) + (r.w - (key ? 22 : 0)) / 2
        return (
          <g
            key={`l-${id}`}
            className={cx('docspp-elabel', s.hl && 'is-hl', s.dim && 'is-dim')}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
          >
            {key && l.key && (
              <>
                <circle className="docspp-key" cx={l.key.x} cy={l.key.y} r={8.5} />
                <text
                  className="docspp-key-text"
                  x={l.key.x}
                  y={l.key.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {key}
                </text>
              </>
            )}
            {e.label && (
              <text x={textX} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="central">
                {e.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
