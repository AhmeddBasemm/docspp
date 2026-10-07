import type { Frame, Layout } from '@idocs/core'
import { cx } from './util'

interface Props {
  frame: Frame
  layout: Layout
  paths: Map<string, SVGPathElement>
}

export function Packets({ frame, layout, paths }: Props) {
  return (
    <div className="idocs-overlay" style={{ width: layout.width, height: layout.height }}>
      {frame.pulses.map((p) => {
        const r = layout.nodes[p.node]
        if (!r) return null
        const grow = 4 + p.progress * 8
        return (
          <div key={`${p.stepId}-${p.node}`}>
            <div
              className="idocs-pulse"
              style={{
                left: r.x - grow / 2,
                top: r.y - grow / 2,
                width: r.w + grow,
                height: r.h + grow,
                opacity: Math.max(0, 1 - p.progress * 0.9),
              }}
            />
            {p.label && (
              <div
                className={cx('idocs-caption', p.kind && `kind-${p.kind}`)}
                style={{ left: r.x + r.w / 2, top: r.y - 8 }}
              >
                {p.label}
              </div>
            )}
          </div>
        )
      })}
      {frame.packets.map((p) => {
        const path = paths.get(p.edge)
        if (!path?.isConnected) return null
        const len = path.getTotalLength()
        const at = path.getPointAtLength((p.reverse ? 1 - p.progress : p.progress) * len)
        return (
          <div
            key={`${p.stepId}-${p.edge}`}
            className={cx('idocs-packet', `kind-${p.kind}`)}
            style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
          >
            <span className="idocs-packet-dot" />
            {p.label && <span className="idocs-packet-label">{p.label}</span>}
          </div>
        )
      })}
    </div>
  )
}
