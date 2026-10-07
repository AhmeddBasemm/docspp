import { compileDiagram as compile, type DiagramSource } from './compiler'
import { resolveIcon } from './icons'

export type { CompileResult, Diagnostic, DiagramSource } from './compiler'

/** Compile using the icon catalog installed alongside the Node package. */
export function compileDiagram(src: DiagramSource) {
  return compile(src, { resolveIcon })
}
