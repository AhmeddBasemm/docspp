declare module 'virtual:idocs/diagrams' {
  import type { CompiledDiagram } from '@the-package-labs/idocs-core'
  import type { Diagnostic } from '@the-package-labs/idocs-core/node'
  export const diagrams: Record<string, CompiledDiagram>
  export const diagnostics: Diagnostic[]
  export default diagrams
}
