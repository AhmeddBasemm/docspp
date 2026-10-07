import { fileURLToPath } from 'node:url'
import { compileDiagram, type DiagramSource, loadProject } from '../src/node'

export const docsRoot = fileURLToPath(new URL('../../../apps/docs', import.meta.url))

export function loadDocs() {
  return loadProject(docsRoot)
}

export function compileText(text: string, extra: Partial<DiagramSource> = {}) {
  return compileDiagram({ name: 't', file: 't.yaml', text, ...extra })
}

/** A node height for layout tests that does not depend on a browser. */
export function fakeSizes(ids: string[], h = 84) {
  return Object.fromEntries(ids.map((id) => [id, { h }]))
}
