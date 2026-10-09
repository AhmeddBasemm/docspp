// Where to underline a compiler diagnostic. The compiler reports where a node starts; the editor
// wants the whole word.
import type { Span } from '../model/yaml'

/** The token that starts at the reported position, or the first line when none is reported. */
export function diagnosticSpan(d: { line?: number; col?: number }, lines: string[]): Span {
  if (!d.line) {
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: (lines[0] ?? '').length },
    }
  }
  const line = d.line - 1
  const start = Math.max(0, (d.col ?? 1) - 1)
  const text = lines[line] ?? ''
  return { start: { line, character: start }, end: { line, character: tokenEnd(text, start) } }
}

function tokenEnd(text: string, start: number): number {
  const first = text[start]
  if (first === '"' || first === "'") {
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === '\\' && first === '"') i++
      else if (text[i] === first) return i + 1
    }
    return text.length
  }
  let end = start
  for (; end < text.length; end++) {
    const c = text[end]
    const next = text[end + 1]
    if (c === ',' || c === '}' || c === ']') break
    if (c === ':' && (next === undefined || next === ' ')) break
    if (c === '#' && end > start && text[end - 1] === ' ') break
  }
  const token = text.slice(start, end).trimEnd()
  return start + Math.max(token.length, 1)
}
