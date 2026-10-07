// Expands the shorthand authors write into the explicit shapes the schema validates.
// Array indices and record keys are preserved, so schema error paths still point at the source.

type Obj = Record<string, unknown>

const EDGE_ARROW = /^(\S+?)\s*(<->|->)\s*(\S+?)(?:\s*:\s+(.*))?$/
const STEP_ARROW = /^(\S+?)\s*->\s*(\S+)$/
const SELF_STEP = /^at\s+(\S+)$/

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function mapValues(o: Obj, fn: (v: unknown, k: string) => unknown): Obj {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fn(v, k)]))
}

/** A compact key's value: a string is the label, an object is extra properties, null is nothing. */
function compactValue(v: unknown, stringKey: string): Obj | unknown {
  if (v == null) return {}
  if (typeof v === 'string' || typeof v === 'number') return { [stringKey]: String(v) }
  return v
}

export function normalizeRoot(raw: unknown): unknown {
  if (!isObj(raw)) return raw
  const out: Obj = { ...raw }
  if (isObj(raw.nodes)) {
    out.nodes = mapValues(raw.nodes, (v) => (typeof v === 'string' ? { title: v } : (v ?? {})))
  }
  if (isObj(raw.groups)) {
    out.groups = mapValues(raw.groups, (v) => (typeof v === 'string' ? { label: v } : v))
  }
  if (Array.isArray(raw.edges)) out.edges = raw.edges.map(normalizeEdge)
  if (isObj(raw.scenarios)) out.scenarios = mapValues(raw.scenarios, normalizeScenario)
  return out
}

export function normalizeEdge(item: unknown): unknown {
  if (typeof item === 'string') {
    const m = item.match(EDGE_ARROW)
    return m ? edgeFrom(m[1]!, m[2]!, m[3]!, m[4] ? { label: m[4] } : {}) : item
  }
  if (isObj(item)) {
    const keys = Object.keys(item)
    const first = keys[0]
    if (keys.length === 1 && first && !('from' in item)) {
      const m = first.match(EDGE_ARROW)
      if (m && !m[4]) {
        const extra = compactValue(item[first], 'label')
        return isObj(extra) ? edgeFrom(m[1]!, m[2]!, m[3]!, extra) : item
      }
    }
  }
  return item
}

function edgeFrom(from: string, arrow: string, to: string, extra: Obj): Obj {
  return { from, to, ...(arrow === '<->' ? { both: true } : {}), ...extra }
}

function normalizeScenario(raw: unknown): unknown {
  if (!isObj(raw)) return raw
  const out: Obj = { ...raw }
  if (Array.isArray(raw.steps)) out.steps = normalizeSteps(raw.steps)
  if (Array.isArray(raw.phases)) {
    out.phases = raw.phases.map((p) =>
      isObj(p) && Array.isArray(p.steps) ? { ...p, steps: normalizeSteps(p.steps) } : p,
    )
  }
  return out
}

function normalizeSteps(steps: unknown[]): unknown[] {
  return steps.map(normalizeStep)
}

export function normalizeStep(item: unknown): unknown {
  if (typeof item === 'string') {
    const m = item.match(STEP_ARROW)
    return m ? { type: 'flow', from: m[1], to: m[2] } : item
  }
  if (!isObj(item)) return item
  if ('type' in item) return item
  if ('from' in item && 'to' in item) return { type: 'flow', ...item }
  if ('at' in item) return { type: 'self', ...item }

  const keys = Object.keys(item)
  const first = keys[0]
  if (keys.length !== 1 || !first) return item
  const value = item[first]

  if (first === 'par') {
    return { type: 'par', steps: Array.isArray(value) ? normalizeSteps(value) : value }
  }
  const flow = first.match(STEP_ARROW)
  if (flow) {
    const extra = compactValue(value, 'label')
    return isObj(extra) ? { type: 'flow', from: flow[1], to: flow[2], ...extra } : item
  }
  const self = first.match(SELF_STEP)
  if (self) {
    const extra = compactValue(value, 'label')
    return isObj(extra) ? { type: 'self', at: self[1], ...extra } : item
  }
  return item
}
