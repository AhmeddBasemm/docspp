const TOKENS = new Set([
  'ink',
  'accent',
  'tunnel',
  'muted',
  'ok',
  'warn',
  'bad',
  'blue',
  'amber',
  'violet',
  'green',
  'teal',
  'red',
  'slate',
])

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** Edge kinds name a theme token (`accent`) or carry any CSS colour. */
export function colorVar(color: string): string {
  return TOKENS.has(color) ? `var(--docspp-${color})` : color
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
export function roman(n: number): string {
  return ROMAN[n] ?? String(n + 1)
}
