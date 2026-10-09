import { describe, expect, it } from 'vitest'
import { diagnosticSpan } from '../src/language/diagnostics'

const underline = (text: string, line: number, col: number) => {
  const lines = text.split('\n')
  const span = diagnosticSpan({ line, col }, lines)
  return (lines[span.start.line] ?? '').slice(span.start.character, span.end.character)
}

describe('diagnosticSpan', () => {
  it('covers a key', () => {
    expect(underline('nodes:\n  api:\n    nope: 1', 3, 5)).toBe('nope')
  })

  it('covers a plain value up to a comment or the end of the line', () => {
    expect(underline('kind: bogus # why', 1, 7)).toBe('bogus')
    expect(underline('kind: two words', 1, 7)).toBe('two words')
  })

  it('stops at the end of a flow entry', () => {
    expect(underline('a: { kind: bogus, label: x }', 1, 12)).toBe('bogus')
    expect(underline('via: [one, two]', 1, 7)).toBe('one')
  })

  it('covers a quoted string whole', () => {
    expect(underline('kind: "a, b: c"', 1, 7)).toBe('"a, b: c"')
  })

  it('covers the arrow of a shorthand edge up to its colon', () => {
    expect(underline('edges:\n  - web -> nope: HTTPS', 2, 5)).toBe('web -> nope')
  })

  it('marks the first line when nothing is located', () => {
    const span = diagnosticSpan({}, ['title: x', 'nodes: {}'])
    expect(span).toEqual({ start: { line: 0, character: 0 }, end: { line: 0, character: 8 } })
  })

  it('never returns an empty range', () => {
    const span = diagnosticSpan({ line: 1, col: 5 }, ['kind'])
    expect(span.end.character).toBeGreaterThan(span.start.character - 1)
  })
})
