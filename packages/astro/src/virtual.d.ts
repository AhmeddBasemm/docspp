declare module 'virtual:idocs/diagrams' {
  import type { CompiledDiagram } from '@idocs/core'
  import type { Diagnostic } from '@idocs/core/node'
  export const diagrams: Record<string, CompiledDiagram>
  export const diagnostics: Diagnostic[]
  export default diagrams
}
