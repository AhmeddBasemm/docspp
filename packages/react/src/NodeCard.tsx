import type { CompiledNode } from '@the-package-labs/idocs-core'
import { memo } from 'react'
import { IconTile } from './Icon'
import { cx } from './util'

export interface NodeCardState {
  selected?: boolean
  hl?: boolean
  dim?: boolean
  visited?: boolean
  hidden?: boolean
}

interface Props {
  node: CompiledNode
  style?: React.CSSProperties
  state?: NodeCardState
  measure?: boolean
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void
}

export const NodeCard = memo(function NodeCard({
  node,
  style,
  state = {},
  measure,
  onSelect,
  onHover,
}: Props) {
  const interactive = !measure
  return (
    <div
      className={cx(
        'idocs-node',
        node.family && `fam-${node.family}`,
        `st-${node.status}`,
        state.selected && 'is-selected',
        state.hl && 'is-hl',
        state.dim && 'is-dim',
        state.visited && 'is-visited',
        state.hidden && 'is-hidden',
      )}
      style={style}
      data-node={interactive ? node.id : undefined}
      data-measure={measure ? node.id : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive ? `${node.title}${node.sub ? `, ${node.sub}` : ''}. Open details` : undefined
      }
      aria-hidden={measure ? true : undefined}
      onClick={interactive ? () => onSelect?.(node.id) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect?.(node.id)
              }
            }
          : undefined
      }
      onMouseEnter={interactive ? () => onHover?.(node.id) : undefined}
      onMouseLeave={interactive ? () => onHover?.(null) : undefined}
      onFocus={interactive ? () => onHover?.(node.id) : undefined}
      onBlur={interactive ? () => onHover?.(null) : undefined}
    >
      {node.badge && <span className="idocs-badge">{node.badge}</span>}
      <div className="idocs-node-head">
        {node.icon && <IconTile icon={node.icon} />}
        <div className="idocs-node-titles">
          <div className="idocs-node-title">{node.title}</div>
          {node.sub && <div className="idocs-node-sub">{node.sub}</div>}
        </div>
        {node.status !== 'built' && (
          <span className={cx('idocs-pill', `st-${node.status}`)}>{node.status}</span>
        )}
      </div>
      {node.lines.length > 0 && (
        <div className="idocs-node-lines">
          {node.lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}
      {node.chips.length > 0 && (
        <div className="idocs-chips">
          {node.chips.map((c) => (
            <div className="idocs-chip" key={c.label}>
              <b>{c.label}</b>
              {c.sub && <span>{c.sub}</span>}
            </div>
          ))}
        </div>
      )}
      {node.uses.length > 0 && <div className="idocs-node-uses">uses: {node.uses.join(' · ')}</div>}
    </div>
  )
})
