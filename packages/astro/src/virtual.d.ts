declare module 'virtual:docspp/diagrams' {
  import type { CompiledDiagram } from '@docspp/core'
  import type { Diagnostic } from '@docspp/core/node'
  export const diagrams: Record<string, CompiledDiagram>
  export const diagnostics: Diagnostic[]
  export default diagrams
}
