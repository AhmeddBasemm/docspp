import { runBounds, stepAt, type Timeline } from '@docspp/core'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface Player {
  t: number
  playing: boolean
  speed: number
  ended: boolean
  setSpeed: (s: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
  restart: () => void
  scrub: (t: number) => void
  playStep: (index: number) => void
  next: () => void
  prev: () => void
  /** Jump to the end of a step without animating. */
  showStep: (index: number) => void
}

export function usePlayer(tl: Timeline | null): Player {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const tRef = useRef(0)
  const stopAt = useRef<number | null>(null)

  const set = useCallback((value: number) => {
    tRef.current = value
    setT(value)
  }, [])

  // A different scenario starts from zero. A re-layout (web fonts arriving, a resize) builds a new
  // timeline object for the same scenario and must not throw the reader's place away.
  const scenarioId = tl?.scenario.id
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the scenario on purpose
  useEffect(() => {
    stopAt.current = null
    set(0)
    setPlaying(false)
  }, [scenarioId])

  useEffect(() => {
    if (!playing || !tl) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * speed
      last = now
      let next = tRef.current + dt
      let stop = false
      const target = stopAt.current
      if (target !== null && next >= target) {
        next = target
        stop = true
      }
      if (next >= tl.duration) {
        next = tl.duration
        stop = true
      }
      set(next)
      if (stop) {
        stopAt.current = null
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, tl, speed, set])

  const play = useCallback(() => {
    if (!tl) return
    if (tRef.current >= tl.duration - 0.01) set(0)
    stopAt.current = null
    setPlaying(true)
  }, [tl, set])

  const pause = useCallback(() => setPlaying(false), [])

  const restart = useCallback(() => {
    set(0)
    stopAt.current = null
    setPlaying(true)
  }, [set])

  const scrub = useCallback(
    (value: number) => {
      setPlaying(false)
      stopAt.current = null
      set(value)
    },
    [set],
  )

  const playStep = useCallback(
    (index: number) => {
      if (!tl) return
      const { start, end } = runBounds(tl, index)
      set(start)
      stopAt.current = end
      setPlaying(true)
    },
    [tl, set],
  )

  const showStep = useCallback(
    (index: number) => {
      if (!tl) return
      setPlaying(false)
      stopAt.current = null
      set(runBounds(tl, index).end)
    },
    [tl, set],
  )

  const next = useCallback(() => {
    if (!tl) return
    const cur = stepAt(tl, tRef.current)
    if (cur >= 0) {
      const b = runBounds(tl, cur)
      if (tRef.current < b.end - 0.02) {
        stopAt.current = b.end
        setPlaying(true)
        return
      }
      const idx = tl.steps.findIndex((s) => s.start > b.start + 1e-6)
      if (idx >= 0) playStep(idx)
    } else if (tl.steps.length) playStep(0)
  }, [tl, playStep])

  const prev = useCallback(() => {
    if (!tl) return
    const cur = stepAt(tl, tRef.current)
    if (cur < 0) return
    const b = runBounds(tl, cur)
    if (tRef.current - b.start > 0.6) return playStep(cur)
    let idx = -1
    tl.steps.forEach((s, i) => {
      if (s.start < b.start - 1e-6) idx = i
    })
    if (idx >= 0) playStep(idx)
    else scrub(0)
  }, [tl, playStep, scrub])

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play])

  return {
    t,
    playing,
    speed,
    ended: !!tl && t >= tl.duration - 0.01,
    setSpeed,
    play,
    pause,
    toggle,
    restart,
    scrub,
    playStep,
    next,
    prev,
    showStep,
  }
}
