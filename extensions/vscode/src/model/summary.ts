// What the status bar says about a diagram. Pure, so the wording is tested.
import type { CompiledDiagram } from '@packagelab/docspp-core'
import type { Diagnostic } from '@packagelab/docspp-core/browser'

export interface Summary {
  name: string
  errors: number
  warnings: number
  nodes: number
  edges: number
  scenarios: number
}

export function summarize(
  name: string,
  diagram: CompiledDiagram | undefined,
  diagnostics: Diagnostic[],
): Summary {
  return {
    name,
    errors: diagnostics.filter((d) => d.severity === 'error').length,
    warnings: diagnostics.filter((d) => d.severity === 'warning').length,
    nodes: diagram ? Object.keys(diagram.nodes).length : 0,
    edges: diagram ? Object.keys(diagram.edges).length : 0,
    scenarios: diagram ? diagram.scenarios.length : 0,
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The text on the status bar: an icon and, when there is something to fix, how many. */
export function statusText(s: Summary): string {
  if (s.errors) return `$(error) ${s.errors}${s.warnings ? ` $(warning) ${s.warnings}` : ''}`
  if (s.warnings) return `$(warning) ${s.warnings}`
  return '$(check) docspp'
}

export function statusTooltip(s: Summary): string {
  const problems = s.errors
    ? `${plural(s.errors, 'error')}${s.warnings ? `, ${plural(s.warnings, 'warning')}` : ''}`
    : s.warnings
      ? plural(s.warnings, 'warning')
      : 'no problems'
  const size = s.nodes
    ? ` · ${plural(s.nodes, 'node')}, ${plural(s.edges, 'edge')}, ${plural(s.scenarios, 'scenario')}`
    : ''
  return `${s.name}: ${problems}${size}`
}

/** What a click does: show the problems when there are any, otherwise open the preview. */
export function statusCommand(s: Summary): string {
  return s.errors || s.warnings ? 'workbench.actions.view.problems' : 'docspp.openPreviewToSide'
}
