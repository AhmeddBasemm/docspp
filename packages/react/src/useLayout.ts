import { type CompiledDiagram, type Layout, layoutView } from '@packagelab/idocs-core'
import { useEffect, useRef, useState } from 'react'

/**
 * Two passes: render every node card offscreen to learn its height at its fixed width,
 * then hand the sizes to ELK. Re-runs when web fonts finish loading, since text wraps differently.
 */
export function useLayout(diagram: CompiledDiagram, viewId: string) {
  const measureRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fontTick, setFontTick] = useState(0)

  useEffect(() => {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    if (!fonts) return
    const bump = () => setFontTick((n) => n + 1)
    fonts.addEventListener('loadingdone', bump)
    return () => fonts.removeEventListener('loadingdone', bump)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: fontTick re-triggers measuring on purpose
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      await document.fonts?.ready
      const host = measureRef.current
      if (!host || cancelled) return
      const sizes: Record<string, { w: number; h: number }> = {}
      host.querySelectorAll<HTMLElement>('[data-measure]').forEach((el) => {
        sizes[el.dataset.measure!] = { w: el.offsetWidth, h: el.offsetHeight }
      })
      try {
        const next = await layoutView(diagram, viewId, sizes)
        if (!cancelled) {
          setError(null)
          setLayout(next)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [diagram, viewId, fontTick])

  return { layout, error, measureRef }
}
