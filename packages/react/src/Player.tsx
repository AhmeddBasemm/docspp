import type { Timeline } from '@packagelab/docspp-core'
import type { Player as PlayerState } from './usePlayer'
import { fmtTime } from './util'

interface Props {
  player: PlayerState
  timeline: Timeline
  mode: 'flow' | 'sequence' | 'story'
  onMode: (m: 'flow' | 'sequence' | 'story') => void
  stepIndex: number
}

const icon = (d: string) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
)

export function Player({ player, timeline, mode, onMode, stepIndex }: Props) {
  const total = timeline.scenario.steps.length
  const label = player.playing
    ? 'Pause'
    : player.ended
      ? 'Replay'
      : player.t > 0
        ? 'Resume'
        : 'Play'
  return (
    <div className="docspp-player" role="group" aria-label="Scenario player">
      <div className="docspp-player-buttons">
        <button
          type="button"
          className="docspp-btn"
          onClick={player.prev}
          aria-label="Previous step"
          title="Previous step"
          disabled={stepIndex < 0}
        >
          {icon('M3 2.5h1.8v11H3zM13 2.5v11L6 8z')}
        </button>
        <button type="button" className="docspp-btn is-primary" onClick={player.toggle}>
          {player.playing ? icon('M4 2.5h2.8v11H4zM9.2 2.5H12v11H9.2z') : icon('M4 2.5v11l9-5.5z')}
          {label}
        </button>
        <button
          type="button"
          className="docspp-btn"
          onClick={player.next}
          aria-label="Next step"
          title="Next step"
          disabled={stepIndex >= total - 1 && player.ended}
        >
          {icon('M11.2 2.5H13v11h-1.8zM3 2.5l7 5.5-7 5.5z')}
        </button>
      </div>
      <input
        className="docspp-scrub"
        type="range"
        min={0}
        max={timeline.duration}
        step={0.01}
        value={player.t}
        onChange={(e) => player.scrub(Number(e.target.value))}
        aria-label="Scenario position"
      />
      <span className="docspp-time">
        {stepIndex >= 0 ? `step ${stepIndex + 1}/${total}` : `${total} steps`} · {fmtTime(player.t)}
      </span>
      <select
        className="docspp-btn"
        value={player.speed}
        onChange={(e) => player.setSpeed(Number(e.target.value))}
        aria-label="Playback speed"
      >
        <option value={0.5}>0.5×</option>
        <option value={1}>1×</option>
        <option value={2}>2×</option>
      </select>
      <div className="docspp-modes" role="group" aria-label="Presentation">
        <button type="button" aria-pressed={mode === 'flow'} onClick={() => onMode('flow')}>
          Flow
        </button>
        <button type="button" aria-pressed={mode === 'sequence'} onClick={() => onMode('sequence')}>
          Sequence
        </button>
        <button type="button" aria-pressed={mode === 'story'} onClick={() => onMode('story')}>
          Story
        </button>
      </div>
    </div>
  )
}
