import { describe, expect, it } from 'vitest'
import { statusCommand, statusText, statusTooltip, summarize } from '../src/model/summary'

const problem = (severity: 'error' | 'warning') => ({ severity, message: 'm', file: 'f' })

describe('status bar', () => {
  it('says all is well when there is nothing to fix', () => {
    const s = summarize('shop', undefined, [])
    expect(statusText(s)).toBe('$(check) docspp')
    expect(statusTooltip(s)).toBe('shop: no problems')
    expect(statusCommand(s)).toBe('docspp.openPreviewToSide')
  })

  it('counts errors and warnings, errors first', () => {
    const s = summarize('shop', undefined, [problem('warning'), problem('error'), problem('error')])
    expect(statusText(s)).toBe('$(error) 2 $(warning) 1')
    expect(statusTooltip(s)).toBe('shop: 2 errors, 1 warning')
    expect(statusCommand(s)).toBe('workbench.actions.view.problems')
  })

  it('shows only warnings when that is all there is', () => {
    const s = summarize('shop', undefined, [problem('warning')])
    expect(statusText(s)).toBe('$(warning) 1')
    expect(statusTooltip(s)).toBe('shop: 1 warning')
  })

  it('adds the size of the diagram when there is one', () => {
    const diagram = {
      nodes: { a: {}, b: {} },
      edges: { e: {} },
      scenarios: [{}],
    } as never
    expect(statusTooltip(summarize('shop', diagram, []))).toBe(
      'shop: no problems · 2 nodes, 1 edge, 1 scenario',
    )
  })
})
