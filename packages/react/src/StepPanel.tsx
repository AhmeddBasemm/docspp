import type { CompiledDiagram, CompiledScenario } from '@packagelab/docspp-core'
import { cx, roman } from './util'

interface Props {
  diagram: CompiledDiagram
  scenario: CompiledScenario
  /** Index of the step in progress, -1 before the start. */
  current: number
  ended: boolean
  onSeek: (index: number) => void
}

export function StepPanel({ diagram, scenario, current, ended, onSeek }: Props) {
  const title = (id?: string) => (id ? (diagram.nodes[id]?.title ?? id) : '')
  const showPhases = scenario.phases.some((p) => p.title)
  let lastPhase = -1
  return (
    <div className="docspp-steps" role="list" aria-label="Steps">
      {scenario.steps.map((s, i) => {
        const header =
          showPhases && s.phase !== lastPhase ? (
            <div className="docspp-phase" key={`p${s.phase}`}>
              <span className="docspp-phase-num">{roman(s.phase)}</span>
              <span className="docspp-phase-title">{scenario.phases[s.phase]?.title}</span>
              {scenario.phases[s.phase]?.caption && (
                <span className="docspp-phase-caption">{scenario.phases[s.phase]?.caption}</span>
              )}
            </div>
          ) : null
        lastPhase = s.phase
        const via =
          s.type === 'flow' && s.hops.length > 1 ? s.hops.slice(0, -1).map((h) => title(h.to)) : []
        return (
          <div key={s.id} style={{ display: 'contents' }}>
            {header}
            <div
              className={cx(
                'docspp-step',
                i === current && 'is-active',
                (ended || i < current) && 'is-done',
              )}
              role="listitem"
              tabIndex={0}
              onClick={() => onSeek(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSeek(i)
                }
              }}
            >
              <span className="docspp-step-n">{s.n}</span>
              <div className="docspp-step-main">
                <span className="docspp-step-route">
                  {s.type === 'self' ? (
                    title(s.at)
                  ) : (
                    <>
                      {title(s.from)}
                      <span className="docspp-step-arrow">→</span>
                      {title(s.to)}
                    </>
                  )}
                </span>
                {via.length > 0 && <span className="docspp-step-label">via {via.join(', ')}</span>}
                {s.label && (
                  <span className={cx('docspp-step-label', `kind-${s.kind}`)}>{s.label}</span>
                )}
                {s.status !== 'built' && (
                  <span className={cx('docspp-pill', `st-${s.status}`)}>{s.status}</span>
                )}
              </div>
              {s.noteHtml && (
                <div
                  className="docspp-step-note"
                  dangerouslySetInnerHTML={{ __html: s.noteHtml }}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
