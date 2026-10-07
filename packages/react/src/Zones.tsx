import type { CompiledDiagram, Layout } from '@idocs/core'
import { Icon } from './Icon'
import { cx } from './util'

interface Props {
  diagram: CompiledDiagram
  groupIds: string[]
  layout: Layout
  dim: (groupId: string) => boolean
}

export function Zones({ diagram, groupIds, layout, dim }: Props) {
  return (
    <>
      {groupIds.map((id) => {
        const g = diagram.groups[id]!
        const r = layout.groups[id]
        if (!r) return null
        return (
          <div
            key={id}
            className={cx(
              'idocs-zone',
              g.style === 'zone' ? 'is-zone' : 'is-frame',
              `st-${g.status}`,
              dim(id) && 'is-dim',
            )}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          >
            <div className="idocs-zone-head">
              {g.icon && <Icon icon={g.icon} />}
              <span>{g.label}</span>
              {g.caption && <span className="idocs-zone-caption">{g.caption}</span>}
            </div>
          </div>
        )
      })}
    </>
  )
}
