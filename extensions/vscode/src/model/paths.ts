// Where a file sits in a diagram folder: `<name>/diagram.yaml`, `scenarios/<id>.yaml`,
// `nodes/<id>.md`, or anything else (local icons). Only the path and a probe for
// `diagram.yaml` are used, so this works the same on disk and in tests.
import { basename, dirname, isAbsolute, relative, sep } from 'node:path'

export const DIAGRAM_FILES = ['diagram.yaml', 'diagram.yml']

export type FileRole = 'diagram' | 'scenario' | 'node-doc' | 'asset'

export interface Located {
  /** Absolute path of the diagram folder. */
  folder: string
  /** The diagram's name: the folder's name. */
  name: string
  role: FileRole
  /** Scenario id for `scenario` files, node id for `node-doc` files. */
  id?: string
}

/** Whether `child` is `parent` or below it. A sibling whose name starts the same does not count. */
export function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export interface Probe {
  exists(path: string): boolean
}

export function diagramFileIn(folder: string, probe: Probe, join: (...p: string[]) => string) {
  return DIAGRAM_FILES.map((f) => join(folder, f)).find((f) => probe.exists(f))
}

/** How deep below the diagram folder a file may be and still belong to it (`icons/a/b.svg`). */
const MAX_DEPTH = 4

export function locate(
  file: string,
  probe: Probe,
  join: (...p: string[]) => string,
): Located | undefined {
  let dir = dirname(file)
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (diagramFileIn(dir, probe, join))
      return { folder: dir, name: basename(dir), ...role(dir, file) }
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
  return undefined
}

function role(folder: string, file: string): { role: FileRole; id?: string } {
  const parts = relative(folder, file).split(sep)
  const [first, second] = parts
  if (parts.length === 1 && DIAGRAM_FILES.includes(first ?? '')) return { role: 'diagram' }
  if (parts.length === 2 && first === 'scenarios' && /\.ya?ml$/.test(second ?? '')) {
    return { role: 'scenario', id: (second ?? '').replace(/\.ya?ml$/, '') }
  }
  if (parts.length === 2 && first === 'nodes' && /\.md$/.test(second ?? '')) {
    return { role: 'node-doc', id: (second ?? '').replace(/\.md$/, '') }
  }
  return { role: 'asset' }
}
