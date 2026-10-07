/**
 * 1-based numbers of the lines in `next` that are not part of the longest common run of lines
 * with `prev`. The landing page uses it to mark what each step of the tour adds to the file.
 */
export function addedLines(prev: string, next: string): number[] {
  const a = prev.split('\n')
  const b = next.split('\n')
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)

  const added: number[] = []
  let i = 0
  let j = 0
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      i++
      j++
    } else if (i < a.length && lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      i++
    } else {
      added.push(j + 1)
      j++
    }
  }
  return added
}
