import type { Problem } from '../src/preview/protocol'

interface Props {
  problems: Problem[]
  onReveal(problem: Problem): void
}

export function ProblemList({ problems, onReveal }: Props) {
  return (
    <ul className="vsc-problems" id="vsc-problems" aria-label="Problems">
      {problems.map((p) => (
        <li key={`${p.file}:${p.line}:${p.col}:${p.message}`}>
          <button
            type="button"
            className={`vsc-problem is-${p.severity}`}
            onClick={() => onReveal(p)}
          >
            <span className="vsc-dot" aria-hidden="true" />
            <span className="vsc-problem-text">
              <span className="vsc-problem-message">{p.message}</span>
              {p.hint && <span className="vsc-problem-hint">{p.hint}</span>}
            </span>
            <span className="vsc-problem-where">
              {p.label}
              {p.line ? `:${p.line}${p.col ? `:${p.col}` : ''}` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
