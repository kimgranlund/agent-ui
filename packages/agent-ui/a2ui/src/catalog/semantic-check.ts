// semantic-check.ts: the opt-in persona semantic-check hook (ADR-0238; GH #1795).
//
// The shared validator (`validateA2ui`) judges STRUCTURE: shapes, catalog membership, the id graph. It
// cannot see that a payload contradicts itself in its own domain, for example a blackjack zone listing
// three dealer cards that sum to 14 while its total readout says 17. A persona that knows its domain may
// declare SEMANTIC CHECKS on its `PersonaCatalogManifest` (`semanticChecks`); the host resolves them for
// the selected catalog and passes them to `produce()` as `ProduceDeps.semanticChecks`. `produce()` runs
// them on a round whose payload ALREADY passed structural validation, and a finding feeds the existing
// self-correct round exactly like a validator failure, bounded by `maxRounds`.
//
// Contract:
// - A check is pure and synchronous. It reads a `SurfaceView` per surface this round's payload touches:
//   the component graph and the data model MERGED over the session's prior assistant turns, the same
//   replay the renderer performs (create resets, delete drops, components upsert by id, data model writes
//   at a pointer). A check never sees a surface this round did not touch: a finished round left as
//   history is never re-judged, because the model cannot repair it.
// - Findings are `{code, path, message}`. `code` is upper snake case and rides `TurnTrace.failureCodes`
//   (it never joins the protocol's closed `ErrorCode` union, the FEED_SCOPE precedent). `message` is one
//   model-facing sentence naming the contradiction and the repair; it reaches the model only through the
//   self-correct feedback turn, never the wire. No new wire format.
// - Fail-open: a check that throws contributes no findings and is reported by id in `errored`, so a buggy
//   check can never stall a turn. `produce()` tallies that on the trace.
// - Default off: no `semanticChecks` (or an empty list) means `produce()` never builds a view or calls
//   this module, so a persona that declares none streams byte-identically.
//
// DOM-less and node-free on purpose: a persona manifest that declares checks is imported by both server
// hosts (`dev-proxy-plugin.ts`, `worker/index.ts`), so nothing here may touch `@agent-ui/components` or
// `node:*` (the binding module's own `setPointer` imports the signals kernel, hence the local copy below).
// It lives under `src/catalog/` beside `compose.ts` (whose `PersonaCatalogManifest` declares checks), not
// under `src/agent/`: no module outside `src/agent/` may import from it (ADR-0137), and `produce()` may
// import from here.

import type { A2uiComponent, A2uiOutput } from '../protocol.ts'

/** The slice of the producer's `Session` the replay reads (structural, so this catalog-side module never
 *  imports `src/agent/`: ADR-0137's composition-containment gate, `agent/gates.test.ts`). */
export interface SemanticTurnLog {
  readonly turns: readonly { readonly role: string; readonly content: string }[]
}

/** One semantic contradiction a check found in a round's payload. */
export interface SemanticFinding {
  /** Upper snake case, check-defined (e.g. `HAND_TOTAL`). Rides `TurnTrace.failureCodes` as-is. */
  code: string
  /** Where: `<surfaceId>:<componentId>` or `<surfaceId>:<data-model pointer>`. */
  path: string
  /** One model-facing sentence: what disagrees with what, and the repair. Never sent on the wire. */
  message: string
}

/** One surface as the renderer will hold it after this round: prior turns replayed, this payload on top. */
export interface SurfaceView {
  readonly surfaceId: string
  /** The merged component graph, keyed by id (a later delivery of an id replaces the earlier one). */
  readonly components: ReadonlyMap<string, A2uiComponent>
  /** The merged data model (`undefined` when no `updateDataModel` reached this surface). */
  readonly dataModel: unknown
}

/** What a check reads: every surface this round's payload creates or updates, in first-touch order. */
export interface SemanticCheckInput {
  readonly surfaces: readonly SurfaceView[]
}

/** A persona-declared semantic check (ADR-0238). Pure and synchronous; `[]` means consistent. */
export interface SemanticCheck {
  /** Stable kebab id, reported in `SemanticCheckResult.errored` when the check throws. */
  readonly id: string
  check(input: SemanticCheckInput): readonly SemanticFinding[]
}

export interface SemanticCheckResult {
  findings: SemanticFinding[]
  /** Ids of checks that threw (fail-open: they contributed no findings). */
  errored: string[]
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const decodeToken = (token: string): string => token.replace(/~1/g, '/').replace(/~0/g, '~')

/** Read an absolute RFC-6901 pointer off a document; `undefined` when any step is absent. `''` and `'/'`
 *  read the whole document (the protocol's root alias, the renderer's `updateDataModel` reading). */
export function readPointer(doc: unknown, pointer: string): unknown {
  if (pointer === '' || pointer === '/') return doc
  if (!pointer.startsWith('/')) return undefined
  let cur: unknown = doc
  for (const raw of pointer.slice(1).split('/')) {
    const key = decodeToken(raw)
    if (Array.isArray(cur)) cur = cur[Number(key)]
    else if (isRecord(cur)) cur = cur[key]
    else return undefined
    if (cur === undefined) return undefined
  }
  return cur
}

/** Set `value` at an absolute pointer WITHOUT mutating `doc`: only the nodes along the path are copied,
 *  so the payload objects this round will still ship are never written to. Mirrors `binding.ts`. */
function writePointer(doc: unknown, pointer: string, value: unknown): unknown {
  const tokens = pointer.slice(1).split('/').map(decodeToken)
  const set = (node: unknown, i: number): unknown => {
    if (i === tokens.length) return value
    const key = tokens[i]!
    if (Array.isArray(node)) {
      const copy = node.slice()
      copy[Number(key)] = set(node[Number(key)], i + 1)
      return copy
    }
    const base = isRecord(node) ? node : {}
    return { ...base, [key]: set(base[key], i + 1) }
  }
  return set(doc, 0)
}

interface MutableView {
  components: Map<string, A2uiComponent>
  dataModel: unknown
}

/** Apply one server message to the replay state, the way the renderer applies it. Anything that is not a
 *  recognizable create/update/delete for a string surfaceId is ignored (never thrown). */
function apply(views: Map<string, MutableView>, msg: unknown): string | undefined {
  if (!isRecord(msg)) return undefined
  const create = msg['createSurface']
  if (isRecord(create) && typeof create['surfaceId'] === 'string') {
    views.set(create['surfaceId'], { components: new Map(), dataModel: undefined }) // teardown and rebuild
    return create['surfaceId']
  }
  const del = msg['deleteSurface']
  if (isRecord(del) && typeof del['surfaceId'] === 'string') {
    views.delete(del['surfaceId'])
    return undefined
  }
  const comps = msg['updateComponents']
  if (isRecord(comps) && typeof comps['surfaceId'] === 'string' && Array.isArray(comps['components'])) {
    const sid = comps['surfaceId']
    const view = views.get(sid) ?? { components: new Map<string, A2uiComponent>(), dataModel: undefined }
    for (const c of comps['components']) if (isRecord(c) && typeof c['id'] === 'string') view.components.set(c['id'], c as A2uiComponent)
    views.set(sid, view)
    return sid
  }
  const data = msg['updateDataModel']
  if (isRecord(data) && typeof data['surfaceId'] === 'string') {
    const sid = data['surfaceId']
    const view = views.get(sid) ?? { components: new Map<string, A2uiComponent>(), dataModel: undefined }
    const path = data['path']
    view.dataModel =
      path === undefined || path === '' || path === '/' ? data['value'] : typeof path === 'string' && path.startsWith('/') ? writePointer(view.dataModel, path, data['value']) : view.dataModel
    views.set(sid, view)
    return sid
  }
  return undefined
}

/**
 * The surfaces a check judges: the session's prior ASSISTANT turns (stored validated JSONL, one message
 * per line) replayed in order, then this round's `output` on top. Only surfaces this round's `output`
 * creates or updates, and that survive to the end of it, are returned, in first-touch order.
 */
export function semanticSurfaceViews(session: SemanticTurnLog, output: A2uiOutput): SurfaceView[] {
  const views = new Map<string, MutableView>()
  for (const turn of session.turns) {
    if (turn.role !== 'assistant') continue
    for (const line of turn.content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      try {
        apply(views, JSON.parse(trimmed))
      } catch {
        // not JSON (never expected for a stored assistant turn): skip rather than throw
      }
    }
  }
  const touched: string[] = []
  for (const msg of output) {
    const sid = apply(views, msg)
    if (sid !== undefined && !touched.includes(sid)) touched.push(sid)
  }
  const out: SurfaceView[] = []
  for (const sid of touched) {
    const view = views.get(sid)
    if (view !== undefined) out.push({ surfaceId: sid, components: view.components, dataModel: view.dataModel })
  }
  return out
}

/** Run every check over one input; a throwing check is skipped and named in `errored` (fail-open). */
export function runSemanticChecks(checks: readonly SemanticCheck[], input: SemanticCheckInput): SemanticCheckResult {
  const findings: SemanticFinding[] = []
  const errored: string[] = []
  for (const c of checks) {
    try {
      findings.push(...c.check(input))
    } catch {
      errored.push(c.id)
    }
  }
  return { findings, errored }
}
