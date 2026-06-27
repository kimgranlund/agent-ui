// validate.ts — the single shared A2UI validator (renderer LLD-C11, SPEC-R11/N6).
//
// `validateA2ui(msgOrOutput, catalog)` is the ONE implementation imported by both the renderer
// and corpus admission (`corpus/validate.ts` re-exports it) so both return the identical verdict
// (parity, SPEC-N6 / corpus SPEC-N1). Pure and TOTAL — it never throws; every defect becomes a
// structured `Failure`. Pipeline (LLD-C11 §8):
//
//   MIME/shape → schema (per version) → catalog-conformance → id-graph → JSON-pointer validity
//
// Stage→code map (renderer LLD §9 error table):
//   raw-string parse fail ............ PARSE
//   not an object/array, bad envelope, missing/extra/typed-wrong fields ... SCHEMA
//   version not in the pinned set .... VERSION_UNSUPPORTED
//   unknown component type / prop / type mismatch ... CATALOG (via catalog conformance)
//   missing `root`, second `root`, cycle, dangling ref ... IDGRAPH
//   malformed JSON-Pointer in a binding / data path ... POINTER
//
// Granularity (renderer LLD §8 "Id-graph granularity"): the id-graph stage judges a COMPLETE
// component set. Missing-root and dangling are legal *transient* states mid-stream (SPEC-R4), so
// the renderer host (LLD-C13) MUST call this at FINALIZE granularity — never per incremental
// `updateComponents`. A 2nd `root` and a cycle are always invalid. The corpus passes a complete
// `a2uiOutput`, so both callers judge the same set → identical verdict (N6).

import { SUPPORTED_VERSIONS } from '../protocol.ts'
import type { A2uiComponent, Failure } from '../protocol.ts'
import type { Catalog } from '../catalog/catalog.ts'
import { validateCatalogConformance } from '../catalog/conformance.ts'

export interface ValidationVerdict {
  valid: boolean
  failures: Failure[]
}

// `SUPPORTED_VERSIONS` (the pinned protocol set, SPEC-R13) is imported from `protocol.ts` — the single
// source shared with the dispatch router so the two can't drift on which versions are routable (N6).
const MESSAGE_KINDS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'actionResponse'] as const
// Structural adjacency keys, not bindable catalog props (kept out of pointer scanning).
const RESERVED = new Set(['id', 'component', 'child', 'children'])

/** Validate a single A2UI message or a full message stream against a catalog. Never throws. */
export function validateA2ui(msgOrOutput: unknown, catalog: Catalog): ValidationVerdict {
  try {
    return run(msgOrOutput, catalog)
  } catch {
    // Totality safety net: any unforeseen input still yields a verdict, never a throw (LLD-C11).
    return { valid: false, failures: [{ code: 'SCHEMA', path: '' }] }
  }
}

interface SurfaceGraph {
  rootCount: number // count of `root` deliveries (a second one is an IDGRAPH error)
  byId: Map<string, A2uiComponent> // merged (upsert) view for dangling/cycle checks
}

function run(input: unknown, catalog: Catalog): ValidationVerdict {
  const failures: Failure[] = []

  // Stage 1 — MIME/shape. A raw string is parsed first (PARSE on failure); the payload normalizes
  // to a list of messages (a single message object → a one-element list).
  const norm = normalize(input)
  if (norm.kind === 'parse') return verdict([{ code: 'PARSE', path: '' }])
  if (norm.kind === 'shape') return verdict([{ code: 'SCHEMA', path: '' }])

  const surfaces = new Map<string, SurfaceGraph>()
  norm.messages.forEach((msg, i) => validateMessage(msg, i, catalog, failures, surfaces))

  // Stage 4 — id-graph, per surface that delivered components.
  for (const [sid, g] of surfaces) checkIdGraph(sid, g, failures)

  return verdict(failures)
}

const verdict = (failures: Failure[]): ValidationVerdict => ({ valid: failures.length === 0, failures })

type Normalized = { kind: 'parse' } | { kind: 'shape' } | { kind: 'ok'; messages: unknown[] }

function normalize(input: unknown): Normalized {
  let payload = input
  if (typeof input === 'string') {
    try {
      payload = JSON.parse(input)
    } catch {
      return { kind: 'parse' }
    }
  }
  if (Array.isArray(payload)) return { kind: 'ok', messages: payload }
  if (isObject(payload)) return { kind: 'ok', messages: [payload] }
  return { kind: 'shape' }
}

function validateMessage(
  msg: unknown,
  i: number,
  catalog: Catalog,
  failures: Failure[],
  surfaces: Map<string, SurfaceGraph>,
): void {
  const loc = `[${i}]`
  if (!isObject(msg)) return push(failures, 'SCHEMA', loc)

  // Stage 2 — schema (per version).
  if (typeof msg.version !== 'string') return push(failures, 'SCHEMA', `${loc}.version`)
  if (!SUPPORTED_VERSIONS.has(msg.version)) return push(failures, 'VERSION_UNSUPPORTED', loc)

  const kinds = MESSAGE_KINDS.filter((k) => k in msg)
  if (kinds.length !== 1) return push(failures, 'SCHEMA', loc) // unknown / missing / ambiguous envelope
  const kind = kinds[0]
  const body = msg[kind]
  if (!isObject(body)) return push(failures, 'SCHEMA', `${loc}.${kind}`)

  switch (kind) {
    case 'createSurface':
      requireStr(body, 'surfaceId', `${loc}.createSurface`, failures)
      requireStr(body, 'catalogId', `${loc}.createSurface`, failures)
      return
    case 'updateComponents':
      return validateUpdateComponents(body, loc, catalog, failures, surfaces)
    case 'updateDataModel':
      requireStr(body, 'surfaceId', `${loc}.updateDataModel`, failures)
      if (body.path !== undefined && (typeof body.path !== 'string' || !isValidPointer(body.path))) {
        push(failures, 'POINTER', `${loc}.updateDataModel.path`)
      }
      return
    case 'deleteSurface':
      requireStr(body, 'surfaceId', `${loc}.deleteSurface`, failures)
      return
    case 'actionResponse':
      requireStr(body, 'surfaceId', `${loc}.actionResponse`, failures)
      requireStr(body, 'actionId', `${loc}.actionResponse`, failures)
      return
  }
}

function validateUpdateComponents(
  body: Record<string, unknown>,
  loc: string,
  catalog: Catalog,
  failures: Failure[],
  surfaces: Map<string, SurfaceGraph>,
): void {
  if (typeof body.surfaceId !== 'string') return push(failures, 'SCHEMA', `${loc}.updateComponents.surfaceId`)
  if (!Array.isArray(body.components)) return push(failures, 'SCHEMA', `${loc}.updateComponents.components`)

  const g = surfaceOf(surfaces, body.surfaceId)
  body.components.forEach((c, ci) => {
    if (!isObject(c) || typeof c.id !== 'string' || typeof c.component !== 'string') {
      return push(failures, 'SCHEMA', `${loc}.updateComponents.components[${ci}]`)
    }
    const comp = c as A2uiComponent

    // id-graph accumulation
    if (comp.id === 'root') g.rootCount++
    g.byId.set(comp.id, comp)

    // Stage 3 — catalog conformance (CATALOG).
    for (const f of validateCatalogConformance(comp, catalog)) failures.push(f)

    // Stage 5 — JSON-pointer validity on bound props (POINTER).
    for (const [k, v] of Object.entries(comp)) {
      if (RESERVED.has(k)) continue
      if (isBinding(v) && !isValidPointer(v.path)) push(failures, 'POINTER', `${comp.id}.${k}`)
    }
  })
}

function checkIdGraph(sid: string, g: SurfaceGraph, failures: Failure[]): void {
  if (g.byId.size === 0) return

  // EXACTLY one root, on this COMPLETE set (renderer LLD §8/§9). Missing-root and 2nd-root both fail;
  // both are finalize-only judgments — a transient rootless set mid-stream is legal (SPEC-R4), which
  // the host guarantees by calling validate at finalize granularity (existing root kept, R3 AC2).
  if (g.rootCount === 0) push(failures, 'IDGRAPH', `${sid}:root-missing`)
  else if (g.rootCount > 1) push(failures, 'IDGRAPH', `${sid}:root`)

  // no dangling: every child/children reference must resolve in the merged set (on finalize, R4).
  for (const comp of g.byId.values()) {
    for (const ref of refsOf(comp)) {
      if (!g.byId.has(ref)) push(failures, 'IDGRAPH', `${comp.id}->${ref}`)
    }
  }

  // acyclic: a back-edge in the child/children graph is a cycle.
  if (hasCycle(g.byId)) push(failures, 'IDGRAPH', `${sid}:cycle`)
}

function refsOf(comp: A2uiComponent): string[] {
  const out: string[] = []
  if (typeof comp.child === 'string') out.push(comp.child)
  if (Array.isArray(comp.children)) for (const c of comp.children) if (typeof c === 'string') out.push(c)
  return out
}

function hasCycle(byId: Map<string, A2uiComponent>): boolean {
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  for (const id of byId.keys()) color.set(id, WHITE)

  const dfs = (id: string): boolean => {
    color.set(id, GRAY)
    for (const ref of refsOf(byId.get(id)!)) {
      if (!byId.has(ref)) continue // dangling handled separately
      const c = color.get(ref)
      if (c === GRAY) return true
      if (c === WHITE && dfs(ref)) return true
    }
    color.set(id, BLACK)
    return false
  }

  for (const id of byId.keys()) if (color.get(id) === WHITE && dfs(id)) return true
  return false
}

// RFC-6901 syntactic validity (NOT resolution — an undefined-but-well-formed path is a runtime
// placeholder, R4 AC2, never a POINTER error). Absolute pointers begin with `/`; relative
// child-scope pointers begin with a digit (lenient — list scope is out of this slice).
function isValidPointer(p: string): boolean {
  if (p === '') return true
  if (/~(?![01])/.test(p)) return false // a `~` escape must be `~0` or `~1`
  if (p[0] === '/') return true
  return /^[0-9]/.test(p)
}

// — small helpers —————————————————————————————————————————————————————————————

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isBinding = (v: unknown): v is { path: string } =>
  isObject(v) && typeof (v as { path?: unknown }).path === 'string'

function surfaceOf(surfaces: Map<string, SurfaceGraph>, sid: string): SurfaceGraph {
  let g = surfaces.get(sid)
  if (!g) {
    g = { rootCount: 0, byId: new Map() }
    surfaces.set(sid, g)
  }
  return g
}

function requireStr(body: Record<string, unknown>, key: string, loc: string, failures: Failure[]): void {
  if (typeof body[key] !== 'string') push(failures, 'SCHEMA', `${loc}.${key}`)
}

function push(failures: Failure[], code: Failure['code'], path: string): void {
  failures.push({ code, path })
}
