// validate.ts — the single shared A2UI validator (renderer LLD-C11, SPEC-R11/N6).
//
// `validateA2ui(msgOrOutput, catalog)` is the ONE implementation imported by both the renderer
// and corpus admission (`corpus/validate.ts` re-exports it) so both return the identical verdict
// (parity, SPEC-N6 / corpus SPEC-N1). Pure and TOTAL — it never throws; every defect becomes a
// structured `Failure`. Pipeline (LLD-C11 §8):
//
//   MIME/shape → schema (per version) → catalog-conformance → id-graph → containment → JSON-pointer validity
//
// Stage→code map (renderer LLD §9 error table):
//   raw-string parse fail ............ PARSE
//   not an object/array, bad envelope, missing/extra/typed-wrong fields ... SCHEMA
//   version not in the pinned set .... VERSION_UNSUPPORTED
//   unknown component type / prop / type mismatch ... CATALOG (via catalog conformance)
//   missing `root`, second `root`, cycle, dangling ref ... IDGRAPH
//   root-reachable nesting past the cap (SPEC-R2/GH #473) ... DEPTH_EXCEEDED
//   a CardHeader/CardContent/CardFooter node whose id-graph parent is not a Card
//     (a2ui-container-vocabulary SPEC-R6) ... CONTAINMENT
//   malformed JSON-Pointer in a binding / data path ... POINTER
//
// Granularity (renderer LLD §8 "Id-graph granularity"): the id-graph stage judges a COMPLETE
// component set. Missing-root and dangling are legal *transient* states mid-stream (SPEC-R4), so
// the renderer host (LLD-C13) MUST call this at FINALIZE granularity — never per incremental
// `updateComponents`. A 2nd `root` and a cycle are always invalid. The corpus passes a complete
// `a2uiOutput`, so both callers judge the same set → identical verdict (N6).
//
// ADR-0187 / GH #829 — the FINALIZE SIGNAL (`opts.atFinalize`). One fact this function cannot know
// from its input alone: *is more content still coming?* A `createSurface` with zero
// `updateComponents` is BYTE-IDENTICAL as "a legitimate mid-stream prefix" and as "an abandoned,
// permanently-empty surface" — and the ratified prefix laws (message-lifecycle SPEC-R4 AC1,
// live-agent SPEC-R5 AC1) require every prefix to validate 0-failure. Only the CALLER holds the
// missing fact, so it is passed in explicitly: `atFinalize: true` asserts "this payload is
// COMPLETE", unlocking the finalize-only empty-surface judgment below. Absent/false = byte-identical
// to the pre-ADR-0187 validator (the falsifiable regression contract; see `validate.test.ts`'s
// default-mode block and both prefix suites). Opted in by `renderer.ts#finalizeSurface`,
// `produce.ts`'s per-round verdict, `corpus/admit.ts` stage 5 and `tools/harness/validate-payload.ts`
// (ADR-0187 §4 / LLD §4); the conformance runner opts in PER FIXTURE, everything else stays default.

import { SUPPORTED_VERSIONS, MAX_RENDER_DEPTH } from '../protocol.ts'
import type { A2uiComponent, Failure } from '../protocol.ts'
import type { Catalog } from '../catalog/catalog.ts'
import { validateCatalogConformance } from '../catalog/conformance.ts'

export interface ValidationVerdict {
  valid: boolean
  failures: Failure[]
}

// `SUPPORTED_VERSIONS` (the pinned protocol set, SPEC-R13) is imported from `protocol.ts` — the single
// source shared with the dispatch router so the two can't drift on which versions are routable (N6).
//
// Exported (not just internal) so a parity probe (dispatch.test.ts) can assert this set equals
// `dispatch.ts`'s `DISPATCHED_ENVELOPE_KEYS` — the two lists must never drift (ADR-0055 §1.2 discovered
// gap: `callFunction` was routed by dispatch.ts, SPEC-R14/ADR-0034 shipped, but unrecognized here, so a
// spec-legal callFunction stream was called SCHEMA-invalid; closed by adding it below, no ADR needed —
// it completes an already-ratified contract).
export const MESSAGE_KINDS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'actionResponse', 'callFunction'] as const
// Structural adjacency keys, not bindable catalog props (kept out of pointer scanning).
const RESERVED = new Set(['id', 'component', 'child', 'children'])

/**
 * TKT-0081 — the optional CROSS-TURN seed for one surface: what a prior conversational turn already
 * delivered. Without it the validator judges a payload standalone — correct for single-turn generation
 * (the corpus) but structurally WRONG for a multi-turn producer: a follow-up `updateComponents` without
 * `root` fails `root-missing`/dangling here while re-sending `root` fails the RENDERER's cross-turn
 * IDGRAPH guard (ADR-0128) — a contradiction that live models resolved by shipping full trees and eating
 * a client-error round per move (the Croupier game loop, measured). A seed merges the prior graph UNDER
 * this payload's deliveries, so update-only payloads validate and a root-resend fails HERE (`sid:root`,
 * the renderer's exact failure) — pre-wire, as a self-correct round.
 */
export interface SurfaceSeed {
  /** Prior-turn component records, replay-merged (later resends already collapsed by upsert). */
  components: readonly A2uiComponent[]
  /** Whether `root` was already delivered for this surface in a prior turn. */
  rootDelivered: boolean
}

/**
 * ADR-0187 / GH #829 — the caller's finalize assertion. An options BAG, not a bare boolean 4th
 * parameter, so a future finalize-adjacent knob extends this interface instead of minting param #5.
 */
export interface ValidateA2uiOptions {
  /** TRUE = the caller asserts this payload is COMPLETE — nothing more is coming for it. Unlocks the
   *  finalize-only judgment: a surface created (or touched) with an EMPTY merged component set fails
   *  IDGRAPH `${sid}:root-missing` (the EXISTING missing-root class, judged at a new granularity — no
   *  new failure code, no wire widening; ADR-0187 §3 / LLD §5). Absent/false = byte-identical to the
   *  pre-ADR-0187 validator, for every caller, test and fixture. */
  atFinalize?: boolean
}

/** Validate a single A2UI message or a full message stream against a catalog. Never throws.
 *  `sessionSeed` (optional, TKT-0081) merges prior-turn graphs per surfaceId into the id-graph judgment —
 *  absent, behavior is byte-identical to before.
 *  `opts.atFinalize` (optional, ADR-0187) asserts the payload is complete — see the module header. */
export function validateA2ui(
  msgOrOutput: unknown,
  catalog: Catalog,
  sessionSeed?: ReadonlyMap<string, SurfaceSeed>,
  opts?: ValidateA2uiOptions,
): ValidationVerdict {
  try {
    return run(msgOrOutput, catalog, sessionSeed, opts?.atFinalize === true)
  } catch {
    // Totality safety net: any unforeseen input still yields a verdict, never a throw (LLD-C11).
    return { valid: false, failures: [{ code: 'SCHEMA', path: '' }] }
  }
}

interface SurfaceGraph {
  rootCount: number // count of `root` deliveries (a second one is an IDGRAPH error)
  byId: Map<string, A2uiComponent> // merged (upsert) view for dangling/cycle checks
}

function run(
  input: unknown,
  catalog: Catalog,
  sessionSeed: ReadonlyMap<string, SurfaceSeed> | undefined,
  atFinalize: boolean,
): ValidationVerdict {
  const failures: Failure[] = []

  // Stage 1 — MIME/shape. A raw string is parsed first (PARSE on failure); the payload normalizes
  // to a list of messages (a single message object → a one-element list).
  const norm = normalize(input)
  if (norm.kind === 'parse') return verdict([{ code: 'PARSE', path: '' }])
  if (norm.kind === 'shape') return verdict([{ code: 'SCHEMA', path: '' }])

  const surfaces = new Map<string, SurfaceGraph>()
  norm.messages.forEach((msg, i) => validateMessage(msg, i, catalog, failures, surfaces))

  // TKT-0081 — merge each seeded surface's PRIOR graph UNDER this payload's deliveries, only for
  // surfaces this payload actually touched (an untouched prior surface has nothing to judge). This
  // payload's records WIN an id collision (a resend REPLACES, the renderer's upsert); the seed's
  // root delivery COUNTS (so a re-delivery here is the same `sid:root` failure the renderer emits).
  if (sessionSeed !== undefined) {
    // A payload that itself (re-)creates a surface starts that surface FRESH — its seed must not apply
    // (a legitimate delete+create re-delivery of `root` is not a resend).
    const createdHere = surfaceIdsOf(norm.messages, 'createSurface')
    for (const [sid, g] of surfaces) {
      const seed = sessionSeed.get(sid)
      if (seed === undefined || createdHere.has(sid)) continue
      for (const comp of seed.components) if (!g.byId.has(comp.id)) g.byId.set(comp.id, comp)
      if (seed.rootDelivered) g.rootCount += 1
    }
  }

  // ADR-0187 / LLD §3 mechanic 4 — the ONE new edge the finalize arm needs: a payload that
  // `createSurface`s AND `deleteSurface`s the same sid leaves nothing mounted, so nothing was
  // abandoned. Built ONLY in finalize mode (the emptiness arm is its sole consumer — a dangling-ref
  // set followed by a delete still fails today's checks in both modes, untouched).
  const deletedHere = atFinalize ? surfaceIdsOf(norm.messages, 'deleteSurface') : NO_SURFACE_IDS

  // Stage 4 — id-graph, per surface that delivered components (and, in finalize mode, per surface
  // this payload merely CREATED — an empty one is then the abandoned-surface defect, ADR-0187).
  for (const [sid, g] of surfaces) checkIdGraph(sid, g, failures, atFinalize && !deletedHere.has(sid))

  // Stage 4b — containment (a2ui-container-vocabulary SPEC-R6), on the SAME assembled (post-seed-merge)
  // graph id-graph judged above — a region's parent is only knowable once every delivery is merged.
  for (const g of surfaces.values()) checkContainment(g, failures)

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
      // ADR-0187 §3 clause 2 / GH #829 root cause — REGISTER the created surface into the judged set.
      // Before this, `createSurface` was the only surface-bearing kind that never called `surfaceOf`, so
      // a surface created and never given any `updateComponents` was INVISIBLE to the id-graph stage —
      // not merely exempted by `checkIdGraph`'s empty-set early return, never even visited. Gated on
      // `surfaceId` being a string so a SCHEMA-invalid line (flagged just above) isn't double-flagged.
      // BEHAVIOR-NEUTRAL ALONE: with the empty-set early returns intact for default mode, an empty graph
      // still yields no failure from `checkIdGraph`/`checkContainment`, and the TKT-0081 seed loop skips
      // every `createdHere` sid — so only a caller passing `atFinalize` sees any difference.
      if (typeof body.surfaceId === 'string') surfaceOf(surfaces, body.surfaceId)
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
    case 'callFunction':
      // SPEC-R14 / ADR-0034: envelope-level (no `surfaceId`) — `functionCallId` is a TOP-LEVEL sibling
      // of `callFunction`, not nested inside it (unlike every other kind's body-only fields), so it is
      // checked against `msg`, not `body`. `args`/`wantResponse` are optional and left unchecked (open
      // schema, matching this validator's Postel stance on other envelopes' optional fields).
      requireStr(msg, 'functionCallId', loc, failures)
      requireStr(body, 'call', `${loc}.callFunction`, failures)
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

    // Stage 5 — JSON-pointer validity on bound props (POINTER). A component binding may be ABSOLUTE or
    // list-item-RELATIVE (ADR-0024) — `isValidBindingPointer`, not the absolute-only `isValidPointer`
    // `updateDataModel.path` uses (there is no list scope for a document-root data-model write).
    for (const [k, v] of Object.entries(comp)) {
      if (RESERVED.has(k)) continue
      if (isBinding(v) && !isValidBindingPointer(v.path)) push(failures, 'POINTER', `${comp.id}.${k}`)
    }
  })
}

function checkIdGraph(sid: string, g: SurfaceGraph, failures: Failure[], atFinalize: boolean): void {
  // ADR-0187 / LLD §3 mechanic 3 — the finalize arm. An EMPTY merged set is a legal transient
  // mid-stream state (SPEC-R4: content may still be coming), so default mode keeps exempting it. In
  // FINALIZE mode the caller has asserted nothing more is coming, so an empty set instead falls
  // through to the `rootCount === 0` judgment below and emits the EXISTING `${sid}:root-missing` — the
  // abandoned-createSurface defect (GH #829/#802), at the one granularity where it is decidable.
  // (The dangling/depth/cycle checks below are all vacuous over an empty set — no new code needed.)
  if (g.byId.size === 0 && !atFinalize) return

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

  // Render-depth guard (a2ui-runtime SPEC-R15, GH #473, SPEC-N6 parity with tree.ts's identically-
  // shaped in-stream guard) — checked BEFORE `hasCycle` for the same reason tree.ts orders it first:
  // `hasCycle` is native-recursive with no depth bound, so a pathologically deep payload must never
  // reach it. Corpus admission REJECTS a too-deep payload outright (this is the strict admission
  // gate); the renderer instead degrades gracefully (truncates, survives) — same guard, two postures.
  if (exceedsMaxDepth(g.byId, MAX_RENDER_DEPTH)) push(failures, 'DEPTH_EXCEEDED', `${sid}:depth`)

  // acyclic: a back-edge in the child/children graph is a cycle.
  if (hasCycle(g.byId)) push(failures, 'IDGRAPH', `${sid}:cycle`)
}

// The three Card-region types SPEC-R6 scopes containment to (v1: no Tabs/Swiper sub-types — a future
// extension of the SAME code, non-goal here, a2ui-container-vocabulary.spec.md SPEC-R6).
const CARD_REGION_TYPES = new Set(['CardHeader', 'CardContent', 'CardFooter'])

/**
 * Containment (a2ui-container-vocabulary SPEC-R6): a `CardHeader`/`CardContent`/`CardFooter` node is
 * "only meaningful as a direct child of its owning container" (SPEC-R6 §2 Definitions) — so a region
 * with NO parent at all (delivered as `root`, or unreferenced by any other node's `child`/`children`)
 * fails exactly like one whose parent is some OTHER component type: neither case is "a direct child of
 * a Card". Runs on the SAME merged (post-seed) `byId` set `checkIdGraph` judges, but independently of
 * it — a dangling ref or a cycle elsewhere in the graph does not gate this check (it only needs to know,
 * for each region node, what ELSE in the merged set points at it).
 */
function checkContainment(g: SurfaceGraph, failures: Failure[]): void {
  if (g.byId.size === 0) return

  const parentType = new Map<string, string>() // childId -> parent's `component` type
  for (const comp of g.byId.values()) {
    for (const ref of refsOf(comp)) parentType.set(ref, comp.component)
  }

  for (const comp of g.byId.values()) {
    if (CARD_REGION_TYPES.has(comp.component) && parentType.get(comp.id) !== 'Card') {
      push(failures, 'CONTAINMENT', comp.id)
    }
  }
}

function refsOf(comp: A2uiComponent): string[] {
  const out: string[] = []
  if (typeof comp.child === 'string') out.push(comp.child)
  if (Array.isArray(comp.children)) for (const c of comp.children) if (typeof c === 'string') out.push(c)
  return out
}

/**
 * Render-depth guard (a2ui-runtime SPEC-R15, GH #473) — mirrors tree.ts's identically-shaped guard
 * exactly (SPEC-N6 parity: both import the SAME `MAX_RENDER_DEPTH` constant so the two can't drift on
 * the cap value, even though — like `hasCycle` below, an existing established pattern in this file —
 * the traversal body itself is duplicated per-caller rather than shared). Deliberately ITERATIVE (a
 * BFS over explicit array frontiers, no native recursion): this check itself can never stack-overflow
 * regardless of how deep or cyclic the input is, and it MUST run before `hasCycle`, which has no depth
 * bound of its own.
 */
function exceedsMaxDepth(byId: Map<string, A2uiComponent>, cap: number): boolean {
  if (!byId.has('root')) return false
  const visited = new Set<string>(['root'])
  let frontier = ['root']
  let depth = 1
  while (frontier.length > 0) {
    if (depth > cap) return true
    const next: string[] = []
    for (const id of frontier) {
      const node = byId.get(id)
      if (node === undefined) continue
      for (const ref of refsOf(node)) {
        if (!byId.has(ref) || visited.has(ref)) continue
        visited.add(ref)
        next.push(ref)
      }
    }
    frontier = next
    depth++
  }
  return false
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
// placeholder, R4 AC2, never a POINTER error). ABSOLUTE-ONLY: used for `updateDataModel.path`, which
// addresses the data-model ROOT directly — a data-model push has no enclosing list-item scope, so a
// relative (non-`/`-led) form has no meaning here and stays rejected.
function isValidPointer(p: string): boolean {
  if (p === '') return true
  if (/~(?![01])/.test(p)) return false // a `~` escape must be `~0` or `~1`
  return p[0] === '/'
}

/**
 * Syntactic validity for a component-property BINDING's `{path}` (renderer LLD-C5/C6, ADR-0024): either
 * ABSOLUTE (root-relative, `/`-led — `isValidPointer`'s rule) OR list-item-RELATIVE, resolved against
 * the enclosing item's scope. The relative grammar mirrors what `binding.ts`'s `scopedPointer` actually
 * implements — ANY non-empty, non-`/`-led string (a plain identifier or a `/`-separated chain), NOT the
 * narrower "must start with a digit" placeholder this replaces (discovered building the ADR-0055
 * examples gate: the shipped `/site` list pages already bind plain relative names like `{path:'name'}`,
 * `{path:'title'}`, `{path:'items'}` — the old digit-only rule flagged every one of them POINTER-invalid
 * despite the renderer resolving them correctly at runtime; no ADR needed, a prior rule marked
 * "lenient — list scope is out of this slice" completed to match the shipped resolver, not reversed).
 * Both arms share the `~`-escape-validity rule.
 */
function isValidBindingPointer(p: string): boolean {
  if (/~(?![01])/.test(p)) return false // a `~` escape must be `~0` or `~1`
  return true // '/'-led absolute or bare relative (list-item scope) — both syntactically legal here
}

// — small helpers —————————————————————————————————————————————————————————————

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isBinding = (v: unknown): v is { path: string } =>
  isObject(v) && typeof (v as { path?: unknown }).path === 'string'

/** The zero-allocation stand-in for `deletedHere` in DEFAULT mode — the emptiness arm that consults it
 *  is finalize-only, so default mode never needs the set built (ADR-0187). */
const NO_SURFACE_IDS: ReadonlySet<string> = new Set<string>()

/**
 * Every string `surfaceId` this payload names under one envelope kind — the shared construction behind
 * TKT-0081's `createdHere` (seed-merge skip) and ADR-0187's `deletedHere` (finalize emptiness skip).
 * Both want the same thing: "which surfaces did THIS payload itself create / delete?" Set membership
 * only — deliberately order-INSENSITIVE, matching the ruled semantics of each caller (a create and a
 * delete of one sid in one payload leaves nothing mounted regardless of their order).
 */
function surfaceIdsOf(messages: readonly unknown[], kind: 'createSurface' | 'deleteSurface'): ReadonlySet<string> {
  const out = new Set<string>()
  for (const m of messages) {
    if (!isObject(m)) continue
    const body = m[kind]
    if (isObject(body) && typeof body.surfaceId === 'string') out.add(body.surfaceId)
  }
  return out
}

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
