// Gathers the text of a diagram folder the way the compiler's loader does (`loadProject` in
// @packagelab/idocs-core/node): diagram.yaml, scenarios/*.yaml sorted by name, and a reader for
// documentation and icons that cannot leave the folder. The file system is injected so the editor
// can substitute unsaved buffers. test/sources.test.ts checks the result against the real loader.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import type { DiagramSource } from '@packagelab/idocs-core/browser'
import { diagramFileIn } from './paths'

export interface Fs {
  readText(path: string): string | undefined
  /** Names inside a directory; empty when it does not exist. */
  readDir(path: string): string[]
  exists(path: string): boolean
}

/** Files that exist only as editor buffers, or whose buffer differs from the disk. */
export interface Overlay {
  /** The buffer's text, which is only fetched when a file is read. */
  text(path: string): string | undefined
  has(path: string): boolean
}

const NO_OVERLAY: Overlay = { text: () => undefined, has: () => false }

/** The real file system, with unsaved editor text taking precedence over what is on disk. */
export function nodeFs(overlay: Overlay = NO_OVERLAY): Fs {
  return {
    readText(path) {
      const open = overlay.text(path)
      if (open !== undefined) return open
      try {
        return readFileSync(path, 'utf8')
      } catch {
        return undefined
      }
    },
    readDir(path) {
      try {
        return readdirSync(path)
      } catch {
        return []
      }
    },
    exists: (path) => overlay.has(path) || existsSync(path),
  }
}

/** Everything the compiler needs for the diagram in `folder`, or undefined if it is not one. */
export function gatherSource(folder: string, fs: Fs): DiagramSource | undefined {
  const file = diagramFileIn(folder, fs, join)
  if (!file) return undefined

  const scenarioDir = join(folder, 'scenarios')
  const scenarioFiles = fs
    .readDir(scenarioDir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => ({
      id: f.replace(/\.ya?ml$/, ''),
      file: join(scenarioDir, f),
      text: fs.readText(join(scenarioDir, f)) ?? '',
    }))

  return {
    name: basename(folder),
    file,
    text: fs.readText(file) ?? '',
    scenarioFiles,
    readFile: (rel) => readInside(folder, rel, fs),
  }
}

/** Read a file below `folder`; paths that escape it are treated as missing. */
function readInside(folder: string, rel: string, fs: Fs): string | undefined {
  const full = resolve(folder, rel)
  if (full !== folder && !full.startsWith(folder + sep)) return undefined
  return fs.readText(full)
}
