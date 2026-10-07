import {
  buildTimeline,
  type CompiledDiagram,
  DEFAULT_NODE_WIDTH,
  type Frame,
  frameAt,
  type Layout,
  type Rect,
} from '@docspp/core'
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Canvas, type Focus } from './Canvas'
import { Drawer } from './Drawer'
import { EdgeLayer, type EdgeState } from './EdgeLayer'
import { InterfaceTable } from './InterfaceTable'
import { Legend } from './Legend'
import { NodeCard, type NodeCardState } from './NodeCard'
import { Packets } from './Packets'
import { Player } from './Player'
import { SequenceView } from './SequenceView'
import { StepPanel } from './StepPanel'
import { useLayout } from './useLayout'
import { usePlayer } from './usePlayer'
import { cx } from './util'
import { Zones } from './Zones'

export interface DiagramViewProps {
  diagram: CompiledDiagram
  /** View to show first. Defaults to the diagram's first view. */
  view?: string
  /** Scenario to select first. */
  scenario?: string
  mode?: 'flow' | 'sequence'
  /** Tallest the canvas may grow before it scrolls inside its frame, in px. */
  maxHeight?: number
  showTitle?: boolean
  /** Show the diagram's description above the first view. */
  showDescription?: boolean
  /** Keep the selected scenario and step in the URL hash so they can be shared. */
  hash?: boolean
  className?: string
}

const EMPTY: EdgeState = {}

export function DiagramView({
  diagram,
  view: viewProp,
  scenario: scenarioProp,
  mode: modeProp = 'flow',
  maxHeight = 780,
  showTitle = false,
  showDescription = false,
  hash = true,
  className,
}: DiagramViewProps) {
  const uid = useId().replace(/:/g, '')
  const rootRef = useRef<HTMLDivElement>(null)
  const paths = useRef(new Map<string, SVGPathElement>()).current
  const register = useCallback(
    (id: string, el: SVGPathElement | null) => {
      if (el) paths.set(id, el)
      else paths.delete(id)
    },
    [paths],
  )

  const [viewId, setViewId] = useState(viewProp ?? diagram.views[0]!.id)
  const view = diagram.views.find((v) => v.id === viewId) ?? diagram.views[0]!
  const scenarios = useMemo(
    () => diagram.scenarios.filter((s) => s.view === view.id),
    [diagram, view.id],
  )
  const [scenarioId, setScenarioId] = useState<string | null>(scenarioProp ?? null)
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? null
  const [mode, setMode] = useState(modeProp)
  const [hover, setHover] = useState<{ node?: string; edge?: string }>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [hidePlanned, setHidePlanned] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  // null means automatic: follow the action when the diagram is too big to read at once.
  const [follow, setFollow] = useState<boolean | null>(null)

  const { layout, error, measureRef } = useLayout(diagram, view.id)

  const timeline = useMemo(() => {
    if (!layout || !scenario) return null
    const lengths = Object.fromEntries(
      Object.entries(layout.edges).map(([id, e]) => [id, e.length]),
    )
    return buildTimeline(scenario, lengths)
  }, [layout, scenario])
  const player = usePlayer(timeline)
  const frame = useMemo<Frame | null>(
    () => (timeline ? frameAt(timeline, player.t) : null),
    [timeline, player.t],
  )
  const scenarioActive = !!frame && (player.t > 0 || player.playing)
  const stepIndex = frame?.stepIndex ?? -1

  // Scenario chosen by clicking starts playing; one restored from props or the URL waits for the reader.
  const autoplay = useRef(false)
  const pendingStep = useRef<number | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to a new timeline
  useEffect(() => {
    if (!timeline) return
    if (pendingStep.current !== null) {
      player.showStep(Math.min(pendingStep.current, timeline.steps.length - 1))
      pendingStep.current = null
    } else if (autoplay.current) {
      autoplay.current = false
      player.play()
    }
  }, [timeline])

  const selectScenario = (id: string | null) => {
    const reduced =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    autoplay.current = id !== null && !reduced
    setScenarioId(id)
    setHover({})
    if (id === null) setMode('flow')
  }

  const selectView = (id: string) => {
    setViewId(id)
    setScenarioId(null)
    setSelected(null)
    setMode('flow')
  }

  // Deep links: #<diagram>=<scenario>[.<step>]
  useEffect(() => {
    if (!hash) return
    const hit = readHash(diagram.name)
    if (!hit) return
    const sc = diagram.scenarios.find((s) => s.id === hit.scenario)
    if (!sc) return
    setViewId(sc.view)
    setScenarioId(sc.id)
    if (hit.step) pendingStep.current = hit.step - 1
  }, [diagram, hash])

  useEffect(() => {
    if (!hash || player.playing) return
    writeHash(
      diagram.name,
      scenarioId ? `${scenarioId}${stepIndex >= 0 ? `.${stepIndex + 1}` : ''}` : null,
    )
  }, [hash, diagram.name, scenarioId, stepIndex, player.playing])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen?.()
  }

  const onHoverNode = useCallback((id: string | null) => setHover(id ? { node: id } : {}), [])
  const onHoverEdge = useCallback((id: string | null) => setHover(id ? { edge: id } : {}), [])
  const onSelect = useCallback((id: string) => setSelected((cur) => (cur === id ? null : id)), [])
  const select = useCallback((id: string) => setSelected(id), [])
  const closeDrawer = useCallback(() => setSelected(null), [])

  // Which nodes and edges the pointer (or the open drawer) is pointing at.
  const focus = useMemo(() => {
    if (scenarioActive && player.playing) return null
    const nodeId = hover.node ?? (hover.edge ? undefined : (selected ?? undefined))
    if (!nodeId && !hover.edge) return null
    const nodes = new Set<string>()
    const edges = new Set<string>()
    if (hover.edge) {
      const e = diagram.edges[hover.edge]
      if (e) {
        edges.add(e.id)
        nodes.add(e.from)
        nodes.add(e.to)
      }
    } else if (nodeId) {
      nodes.add(nodeId)
      for (const id of view.edgeIds) {
        const e = diagram.edges[id]!
        if (e.from === nodeId || e.to === nodeId) {
          edges.add(id)
          nodes.add(e.from)
          nodes.add(e.to)
        }
      }
    }
    return { nodes, edges }
  }, [hover, selected, scenarioActive, player.playing, diagram, view])

  const activeKey = frame?.activeEdges.join() ?? ''
  const trailKey = frame?.trailEdges.join() ?? ''
  const visitedKey = frame?.visitedNodes.join() ?? ''

  const nodeFlags = useMemo(() => {
    const visited = new Set(visitedKey ? visitedKey.split(',') : [])
    const out: Record<string, NodeCardState> = {}
    for (const id of view.nodeIds) {
      out[id] = {
        selected: selected === id,
        hl: !!focus?.nodes.has(id),
        dim: focus ? !focus.nodes.has(id) : scenarioActive ? !visited.has(id) : false,
        visited: scenarioActive && visited.has(id),
        hidden: hidePlanned && diagram.nodes[id]!.status === 'planned',
      }
    }
    return out
  }, [view, focus, selected, scenarioActive, visitedKey, hidePlanned, diagram])

  const edgeStates = useMemo(() => {
    const active = new Set(activeKey ? activeKey.split(',') : [])
    const trail = new Set(trailKey ? trailKey.split(',') : [])
    const out: Record<string, EdgeState> = {}
    for (const id of view.edgeIds) {
      const e = diagram.edges[id]!
      const hidden =
        hidePlanned &&
        (e.status === 'planned' ||
          diagram.nodes[e.from]!.status === 'planned' ||
          diagram.nodes[e.to]!.status === 'planned')
      out[id] = {
        hl: !!focus?.edges.has(id),
        dim: focus ? !focus.edges.has(id) : scenarioActive ? !trail.has(id) : false,
        lit: scenarioActive && active.has(id),
        trail: scenarioActive && trail.has(id) && !active.has(id),
        hidden,
      }
    }
    return out
  }, [view, focus, scenarioActive, activeKey, trailKey, hidePlanned, diagram])

  const hasPlanned = useMemo(
    () =>
      view.nodeIds.some((id) => diagram.nodes[id]!.status === 'planned') ||
      view.edgeIds.some((id) => diagram.edges[id]!.status === 'planned'),
    [view, diagram],
  )

  const following = follow ?? (!!layout && (layout.width > 1500 || layout.height > 950))
  const camera = useMemo<Focus | null>(() => {
    if (!following || !layout || !scenario || !timeline || mode !== 'flow') return null
    if (stepIndex < 0)
      return {
        key: `${scenario.id}:start`,
        rect: { x: 0, y: 0, w: layout.width, h: layout.height },
      }
    const step = scenario.steps[stepIndex]
    if (!step) return null
    const group = step.par === undefined ? [step] : scenario.steps.filter((s) => s.par === step.par)
    const boxes: Rect[] = []
    for (const s of group) {
      for (const id of [s.from, s.to, s.at])
        if (id && layout.nodes[id]) boxes.push(layout.nodes[id]!)
      for (const hop of s.hops)
        for (const p of layout.edges[hop.edge]?.points ?? [])
          boxes.push({ x: p.x, y: p.y, w: 0, h: 0 })
    }
    if (!boxes.length) return null
    const x0 = Math.min(...boxes.map((b) => b.x))
    const y0 = Math.min(...boxes.map((b) => b.y))
    const x1 = Math.max(...boxes.map((b) => b.x + b.w))
    const y1 = Math.max(...boxes.map((b) => b.y + b.h))
    return {
      key: `${scenario.id}:${step.par ?? step.id}`,
      rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    }
  }, [following, layout, scenario, timeline, stepIndex, mode])
  const stopFollowing = useCallback(() => setFollow(false), [])

  const stateOf = useCallback((id: string) => edgeStates[id] ?? EMPTY, [edgeStates])
  const showSequence = !!scenario && mode === 'sequence'

  return (
    <div ref={rootRef} className={cx('docspp', className)}>
      {showTitle && <h3 style={{ margin: 0 }}>{diagram.title}</h3>}
      {(showTitle || showDescription) && diagram.descriptionHtml && (
        <div
          className="docspp-summary"
          dangerouslySetInnerHTML={{ __html: diagram.descriptionHtml }}
        />
      )}

      {diagram.views.length > 1 && (
        <div className="docspp-tabs" role="tablist" aria-label="Views">
          {diagram.views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              className="docspp-tab"
              aria-selected={v.id === view.id}
              onClick={() => selectView(v.id)}
            >
              {v.title}
            </button>
          ))}
        </div>
      )}
      {view.summaryHtml && (
        <div className="docspp-summary" dangerouslySetInnerHTML={{ __html: view.summaryHtml }} />
      )}

      {scenarios.length > 0 && (
        <div className="docspp-scenarios" role="group" aria-label="Scenarios">
          <span className="docspp-scenarios-label">Scenario</span>
          <button
            type="button"
            className="docspp-chip-btn"
            aria-pressed={!scenario}
            onClick={() => selectScenario(null)}
          >
            Overview
          </button>
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              className="docspp-chip-btn"
              aria-pressed={s.id === scenario?.id}
              onClick={() => selectScenario(s.id)}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      {scenario?.summaryHtml && (
        <div
          className="docspp-summary"
          dangerouslySetInnerHTML={{ __html: scenario.summaryHtml }}
        />
      )}

      {!showSequence && <Legend diagram={diagram} view={view} />}

      {showSequence ? (
        <SequenceView
          diagram={diagram}
          scenario={scenario}
          current={stepIndex}
          onSeek={player.playStep}
        />
      ) : layout ? (
        <Canvas
          layout={layout}
          maxHeight={maxHeight}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
          onBackgroundClick={closeDrawer}
          focus={camera}
          onUserMove={stopFollowing}
          tools={
            <>
              {scenario && (
                <div className="docspp-toolbar-group">
                  <button
                    type="button"
                    className="docspp-tool is-text"
                    aria-pressed={following}
                    onClick={() => setFollow(!following)}
                    title="Move the view to wherever the action is"
                  >
                    Follow
                  </button>
                </div>
              )}
              {hasPlanned && (
                <div className="docspp-toolbar-group">
                  <button
                    type="button"
                    className="docspp-tool is-text"
                    aria-pressed={hidePlanned}
                    onClick={() => setHidePlanned((v) => !v)}
                    title="Hide items that are not built yet"
                  >
                    {hidePlanned ? 'Planned hidden' : 'Hide planned'}
                  </button>
                </div>
              )}
            </>
          }
          overlay={
            selected && (
              <Drawer
                diagram={diagram}
                view={view}
                nodeId={selected}
                onClose={closeDrawer}
                onSelect={select}
              />
            )
          }
        >
          <World
            uid={uid}
            diagram={diagram}
            view={view}
            layout={layout}
            nodeFlags={nodeFlags}
            stateOf={stateOf}
            edgeStates={edgeStates}
            register={register}
            onHoverNode={onHoverNode}
            onHoverEdge={onHoverEdge}
            onSelect={onSelect}
          />
          {frame && scenarioActive && <Packets frame={frame} layout={layout} paths={paths} />}
        </Canvas>
      ) : (
        <div className="docspp-frame docspp-skeleton">
          {error ? <div className="docspp-error">{error}</div> : 'Loading diagram…'}
        </div>
      )}

      {scenario && timeline && (
        <Player
          player={player}
          timeline={timeline}
          mode={mode}
          onMode={setMode}
          stepIndex={stepIndex}
        />
      )}
      {scenario && (
        <StepPanel
          diagram={diagram}
          scenario={scenario}
          current={stepIndex}
          ended={player.ended}
          onSeek={player.playStep}
        />
      )}
      {view.interfaces && (
        <InterfaceTable
          diagram={diagram}
          view={view}
          hover={hover.edge ?? null}
          onHover={onHoverEdge}
        />
      )}

      <div className="docspp-measure" ref={measureRef} aria-hidden="true">
        {view.nodeIds.map((id) => {
          const n = diagram.nodes[id]!
          return <NodeCard key={id} node={n} measure style={{ width: n.w ?? DEFAULT_NODE_WIDTH }} />
        })}
      </div>
    </div>
  )
}

interface WorldProps {
  uid: string
  diagram: CompiledDiagram
  view: CompiledDiagram['views'][number]
  layout: Layout
  nodeFlags: Record<string, NodeCardState>
  edgeStates: Record<string, EdgeState>
  stateOf: (id: string) => EdgeState
  register: (id: string, el: SVGPathElement | null) => void
  onHoverNode: (id: string | null) => void
  onHoverEdge: (id: string | null) => void
  onSelect: (id: string) => void
}

/** Zones, edges and nodes. Memoised so the per-frame player updates do not touch it. */
const World = memo(function World({
  uid,
  diagram,
  view,
  layout,
  nodeFlags,
  stateOf,
  register,
  onHoverNode,
  onHoverEdge,
  onSelect,
}: WorldProps) {
  const noDim = useCallback(() => false, [])
  return (
    <>
      <Zones diagram={diagram} groupIds={view.groupIds} layout={layout} dim={noDim} />
      <EdgeLayer
        uid={uid}
        diagram={diagram}
        view={view}
        layout={layout}
        stateOf={stateOf}
        onHover={onHoverEdge}
        register={register}
      />
      {view.nodeIds.map((id) => {
        const r = layout.nodes[id]
        if (!r) return null
        return (
          <NodeCard
            key={id}
            node={diagram.nodes[id]!}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
            state={nodeFlags[id]}
            onSelect={onSelect}
            onHover={onHoverNode}
          />
        )
      })}
    </>
  )
})

function readHash(name: string): { scenario: string; step?: number } | null {
  if (typeof location === 'undefined') return null
  for (const part of location.hash.slice(1).split('&')) {
    const [key, value] = part.split('=')
    if (key === name && value) {
      const [scenario, step] = value.split('.')
      return { scenario: scenario!, step: step ? Number(step) || undefined : undefined }
    }
  }
  return null
}

function writeHash(name: string, value: string | null) {
  if (typeof location === 'undefined') return
  const parts = location.hash
    .slice(1)
    .split('&')
    .filter((p) => p && !p.startsWith(`${name}=`))
  if (value) parts.push(`${name}=${value}`)
  const hash = parts.length ? `#${parts.join('&')}` : ''
  if (hash !== location.hash)
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`)
}
