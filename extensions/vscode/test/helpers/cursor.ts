import type { Pos } from '../../src/model/yaml'

/** Splits `text` at the last `|`: the text without it, and where it was. */
export function at(marked: string): { text: string; pos: Pos } {
  const index = marked.lastIndexOf('|')
  if (index < 0) throw new Error('no | marker')
  const before = marked.slice(0, index)
  const lines = before.split('\n')
  return {
    text: marked.slice(0, index) + marked.slice(index + 1),
    pos: { line: lines.length - 1, character: lines[lines.length - 1]?.length ?? 0 },
  }
}
