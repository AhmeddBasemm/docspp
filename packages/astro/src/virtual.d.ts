declare module 'virtual:docspp/diagrams' {
  import type { CompiledDiagram } from '@packagelab/docspp-core'
  import type { Diagnostic } from '@packagelab/docspp-core/node'
  export const diagrams: Record<string, CompiledDiagram>
  export const diagnostics: Diagnostic[]
  export default diagrams
}
