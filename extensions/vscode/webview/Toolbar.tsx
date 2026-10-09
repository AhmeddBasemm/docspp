import type { Problem } from '../src/preview/protocol'

interface Props {
  title: string
  name: string
  problems: Problem[]
  /** There is a diagram on screen, and it is older than the text. */
  stale: boolean
  locked: boolean
  open: boolean
  onToggleProblems(): void
  onToggleLock(): void
  onRefresh(): void
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function Toolbar({
  title,
  name,
  problems,
  stale,
  locked,
  open,
  onToggleProblems,
  onToggleLock,
  onRefresh,
}: Props) {
  const errors = problems.filter((p) => p.severity === 'error').length
  const warnings = problems.length - errors
  const level = errors ? 'error' : warnings ? 'warning' : 'ok'
  const label = errors
    ? `${plural(errors, 'error')}${stale ? ' · showing the last valid diagram' : ''}`
    : warnings
      ? plural(warnings, 'warning')
      : 'Up to date'

  return (
    <header className="vsc-bar">
      <div className="vsc-bar-title">
        <strong>{title}</strong>
        {title !== name && <span className="vsc-bar-name">{name}</span>}
      </div>
      <button
        type="button"
        className={`vsc-chip is-${level}`}
        aria-expanded={open}
        aria-controls="vsc-problems"
        disabled={problems.length === 0}
        onClick={onToggleProblems}
        title={problems.length ? 'Show or hide the problems' : undefined}
      >
        <span className="vsc-dot" aria-hidden="true" />
        {label}
      </button>
      <div className="vsc-bar-actions">
        <button
          type="button"
          className="vsc-icon-btn"
          aria-pressed={locked}
          onClick={onToggleLock}
          title={
            locked
              ? 'Following is off: this preview stays on this diagram'
              : 'Keep this preview on this diagram'
          }
        >
          {locked ? <LockIcon /> : <UnlockIcon />}
          <span className="vsc-sr">{locked ? 'Unlock preview' : 'Lock preview'}</span>
        </button>
        <button type="button" className="vsc-icon-btn" onClick={onRefresh} title="Compile again">
          <RefreshIcon />
          <span className="vsc-sr">Refresh</span>
        </button>
      </div>
    </header>
  )
}

const svg = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'currentColor',
  'aria-hidden': true,
}

const LockIcon = () => (
  <svg {...svg}>
    <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm2 5H6V4a2 2 0 1 1 4 0v2Z" />
  </svg>
)
const UnlockIcon = () => (
  <svg {...svg}>
    <path d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H6V4a2 2 0 0 1 3.9-.6.5.5 0 1 0 .96-.28A3 3 0 0 0 8 1Z" />
  </svg>
)
const RefreshIcon = () => (
  <svg {...svg}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9V2.5a.5.5 0 0 1 1 0v3a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1h1.8A4.5 4.5 0 1 0 12.5 8a.5.5 0 0 1 1 0Z" />
  </svg>
)
