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
// `updateComponents`. A 2nd `root` (within one epoch, see below) and a cycle are always invalid. The corpus passes a complete
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
//
// ADR-0064 amendment (2026-10-03, A2 to A4; GH #1736 ruling, GH #1740 build): SURFACE EPOCHS. A
// surface's messages in one payload partition into epochs, because the renderer frees a surface's
// whole graph at `deleteSurface` (`renderer.ts#onDeleteSurface` tears it down and `store.delete`s it),
// so a later `root` for the same id is a first delivery, not a resend. An epoch opens at a
// `createSurface`, or at the first `updateComponents` for a surface this payload never deleted (the
// implicit open this validator always had); it closes at the next `deleteSurface` for that id. After a
// `deleteSurface`, ONLY a `createSurface` reopens the id (the amendment's erratum, 2026-10-04): the
// renderer drops an `updateComponents`/`updateDataModel` for a deleted surface
// (`renderer.ts#onUpdateComponents`, the unknown/deleted no-op), so such a delivery fails IDGRAPH
// `sid:update-after-delete` at its own message and joins no graph. Every epoch is judged
// by `checkIdGraph` + `checkContainment` on ITS OWN graph: a closed epoch on the graph it held when it
// closed (an empty closed epoch mounted nothing, so it is exempt; a non-empty one is judged in full,
// in both modes), the epoch still open at payload end with the finalize arm as before. Judgment runs
// at Stage 4 over those frozen graphs, so failure order stays stage-major and byte-identical to the
// pre-epoch validator for every payload that neither deletes nor re-creates a surface it delivered to.
//
// ADR-0064 re-create erratum (2026-10-04, GH #1772 ruling): a `createSurface` is ALSO an epoch boundary.
// The renderer replaces a live surface on a re-create (`renderer.ts#onCreateSurface` tears the DOM down
// and `SurfaceStore.create` disposes the prior surface and builds a fresh one), so every `createSurface`
// closes the sid's open epoch, if any, and opens a fresh one: the new epoch holds no `root`, no
// components and no seed. No `deleteSurface` is needed. A create over an empty open epoch (a leading
// create, a create right after a create, or after a delete) closes nothing that mounted, so it changes
// no verdict. Two shapes change: `createSurface s, root, createSurface s, root` now VALIDATES (the second
// `root` is a first delivery, as it is after a delete; it failed `sid:root` before), and a re-create
// whose own epoch delivers components but no `root` now fails `sid:root-missing` (the first epoch's
// `root` no longer satisfies it). A re-create with nothing after it stays clean in default mode and
// fails `sid:root-missing` at finalize, as a create after a delete always did (A3). The resend rule
// holds WITHIN an epoch: two `root`s with no `createSurface` or `deleteSurface` between still fail
// `sid:root`. Codes are unchanged (`sid:update-after-delete`, from the delete erratum above, is still the
// one path no delete-free payload can produce).

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
   *  pre-ADR-0187 validator, for every caller, test and fixture. Under surface epochs (ADR-0064
   *  amendment A3) the judgment applies to each surface's epoch still OPEN at payload end; an epoch a
   *  `deleteSurface` closed is never judged empty. */
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

/** ADR-0064 amendment A2: one epoch of a surface's lifecycle within this payload (see module header). */
interface Epoch extends SurfaceGraph {
  /** A4: a `createSurface` opened this epoch, so the TKT-0081 seed never applies to it (the re-create
   *  erratum: every `createSurface` opens its own epoch, so none ever "lands inside" one). */
  created: boolean
}

/** One surface's epochs in stream order: those a `deleteSurface` closed, then the one still open. */
interface SurfaceLifecycle {
  closed: Epoch[]
  open: Epoch | undefined
}

/** Every surface this payload opened an epoch for (Map insertion order = first-open order, the order
 *  Stage 4 reports in), plus the sids currently DELETED: a `deleteSurface` addressed them and no
 *  `createSurface` has re-created them since (the erratum rule). A delivery to a deleted sid is the
 *  renderer's dropped message, `sid:update-after-delete`. The set is kept apart from `bySid` so a
 *  leading delete never registers a surface (and never moves its position in the report order). */
interface PayloadSurfaces {
  bySid: Map<string, SurfaceLifecycle>
  deleted: Set<string>
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

  const surfaces: PayloadSurfaces = { bySid: new Map(), deleted: new Set() }
  norm.messages.forEach((msg, i) => validateMessage(msg, i, catalog, failures, surfaces))

  // TKT-0081 — merge each seeded surface's PRIOR graph UNDER this payload's deliveries, only for
  // surfaces this payload actually touched (an untouched prior surface has nothing to judge). This
  // payload's records WIN an id collision (a resend REPLACES, the renderer's upsert); the seed's
  // root delivery COUNTS (so a re-delivery here is the same `sid:root` failure the renderer emits).
  //
  // ADR-0064 amendment A4: the seed describes the surface the prior turn left live, so it can only
  // continue this payload's FIRST epoch for that sid, and only when that epoch is a continuation: not
  // opened by (or holding) a `createSurface` of this payload (TKT-0081's `createdHere`, GH #307 F2), and
  // not preceded by a `deleteSurface` of this payload (the delete freed the seeded graph). The second
  // condition needs no check of its own: after a delete only a `createSurface` reopens the sid (the
  // erratum rule), so an epoch preceded by a delete is always `created`. Every later epoch is fresh.
  if (sessionSeed !== undefined) {
    for (const [sid, lifecycle] of surfaces.bySid) {
      const seed = sessionSeed.get(sid)
      const first = lifecycle.closed[0] ?? lifecycle.open
      if (seed === undefined || first === undefined || first.created) continue
      for (const comp of seed.components) if (!first.byId.has(comp.id)) first.byId.set(comp.id, comp)
      if (seed.rootDelivered) first.rootCount += 1
    }
  }

  // Stage 4: id-graph, per epoch, each on its own graph (ADR-0064 amendment A2/A3). A CLOSED epoch
  // never takes the finalize emptiness arm: an empty one mounted nothing and was torn down, so nothing
  // was abandoned (A3, the one case ADR-0187's former same-payload `deletedHere` exemption keeps); a
  // non-empty one is judged in full in both modes (a dangling reference followed by a delete still
  // fails). The epoch still OPEN at payload end is what the renderer would be showing, so it alone takes
  // the ADR-0187 arm: in finalize mode an empty one is the abandoned-surface defect (`sid:root-missing`),
  // including one opened by a `createSurface` after the last `deleteSurface`.
  for (const [sid, lifecycle] of surfaces.bySid) {
    for (const epoch of lifecycle.closed) checkIdGraph(sid, epoch, failures, false)
    if (lifecycle.open !== undefined) checkIdGraph(sid, lifecycle.open, failures, atFinalize)
  }

  // Stage 4b: containment (a2ui-container-vocabulary SPEC-R6), on the SAME assembled (post-seed-merge)
  // per-epoch graphs id-graph judged above; a region's parent is only knowable once every delivery to
  // its epoch is merged.
  for (const lifecycle of surfaces.bySid.values()) {
    for (const epoch of lifecycle.closed) checkContainment(epoch, failures)
    if (lifecycle.open !== undefined) checkContainment(lifecycle.open, failures)
  }

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
  surfaces: PayloadSurfaces,
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
      // Before this, `createSurface` was the only surface-bearing kind that never registered a graph, so
      // a surface created and never given any `updateComponents` was INVISIBLE to the id-graph stage —
      // not merely exempted by `checkIdGraph`'s empty-set early return, never even visited. Gated on
      // `surfaceId` being a string so a SCHEMA-invalid line (flagged just above) isn't double-flagged.
      // BEHAVIOR-NEUTRAL ALONE: with the empty-set early returns intact for default mode, an empty graph
      // still yields no failure from `checkIdGraph`/`checkContainment`, and the TKT-0081 seed loop skips
      // every `created` epoch, so only a caller passing `atFinalize` sees any difference.
      // ADR-0064 amendment A2/A4 + the 2026-10-04 re-create erratum (GH #1772): registration CLOSES the
      // sid's open epoch, if any (the renderer replaces a live surface on a re-create), then OPENS a fresh
      // one and marks it `created`. It is also the ONLY message that takes a deleted sid back (the
      // erratum rule).
      if (typeof body.surfaceId === 'string') {
        surfaces.deleted.delete(body.surfaceId)
        recreateEpoch(surfaces, body.surfaceId)
      }
      return
    case 'updateComponents':
      return validateUpdateComponents(body, loc, catalog, failures, surfaces)
    case 'updateDataModel':
      requireStr(body, 'surfaceId', `${loc}.updateDataModel`, failures)
      if (typeof body.surfaceId === 'string') rejectIfDeleted(surfaces, body.surfaceId, failures)
      if (body.path !== undefined && (typeof body.path !== 'string' || !isValidPointer(body.path))) {
        push(failures, 'POINTER', `${loc}.updateDataModel.path`)
      }
      return
    case 'deleteSurface':
      requireStr(body, 'surfaceId', `${loc}.deleteSurface`, failures)
      // ADR-0064 amendment A2: the delete frees the surface's id graph, closing its open epoch. Gated on a
      // string `surfaceId`, mirroring `createSurface`'s registration (a SCHEMA-invalid line closes nothing).
      if (typeof body.surfaceId === 'string') closeEpoch(surfaces, body.surfaceId)
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
  surfaces: PayloadSurfaces,
): void {
  if (typeof body.surfaceId !== 'string') return push(failures, 'SCHEMA', `${loc}.updateComponents.surfaceId`)
  if (!Array.isArray(body.components)) return push(failures, 'SCHEMA', `${loc}.updateComponents.components`)

  // The implicit open when no create precedes it (A2), unless the sid is deleted: then the renderer
  // drops this message, so it joins NO graph (its components still get the per-component checks below).
  const g = rejectIfDeleted(surfaces, body.surfaceId, failures) ? undefined : openEpoch(surfaces, body.surfaceId)
  body.components.forEach((c, ci) => {
    if (!isObject(c) || typeof c.id !== 'string' || typeof c.component !== 'string') {
      return push(failures, 'SCHEMA', `${loc}.updateComponents.components[${ci}]`)
    }
    const comp = c as A2uiComponent

    // id-graph accumulation
    if (g !== undefined) {
      if (comp.id === 'root') g.rootCount++
      g.byId.set(comp.id, comp)
    }

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

function checkIdGraph(sid: string, g: SurfaceGraph, failures: Failure[], judgeEmpty: boolean): void {
  // ADR-0187 / LLD §3 mechanic 3 — the finalize arm. An EMPTY merged set is a legal transient
  // mid-stream state (SPEC-R4: content may still be coming), so default mode keeps exempting it. In
  // FINALIZE mode the caller has asserted nothing more is coming, so an empty set instead falls
  // through to the `rootCount === 0` judgment below and emits the EXISTING `${sid}:root-missing` — the
  // abandoned-createSurface defect (GH #829/#802), at the one granularity where it is decidable.
  // (The dangling/depth/cycle checks below are all vacuous over an empty set — no new code needed.)
  // `judgeEmpty` is `atFinalize` for the epoch still open at payload end and always false for a closed
  // epoch (ADR-0064 amendment A3: an empty closed epoch mounted nothing, so nothing was abandoned).
  if (g.byId.size === 0 && !judgeEmpty) return

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
// Exported for the A2UI test kit's generated per-type matrix (tools/testkit/minimal-node.ts), which wraps
// these in a Card instead of keeping a second copy; not re-exported from the renderer barrel.
export const CARD_REGION_TYPES: ReadonlySet<string> = new Set(['CardHeader', 'CardContent', 'CardFooter'])

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

/**
 * ADR-0064 amendment A2: the epoch an `updateComponents` lands in. Returns the sid's OPEN epoch (the one a
 * `createSurface` or an earlier delivery opened), opening a fresh one only when none is open: the first
 * delivery to a surface this payload never saw (the validator's implicit open for an uncreated surface).
 * Never reached by a delivery to a DELETED sid (`rejectIfDeleted` stops it first). `createSurface` does
 * not call it directly: it goes through `recreateEpoch`.
 */
function openEpoch(surfaces: PayloadSurfaces, sid: string): Epoch {
  let lifecycle = surfaces.bySid.get(sid)
  if (lifecycle === undefined) {
    lifecycle = { closed: [], open: undefined }
    surfaces.bySid.set(sid, lifecycle)
  }
  if (lifecycle.open === undefined) lifecycle.open = { rootCount: 0, byId: new Map(), created: false }
  return lifecycle.open
}

/**
 * Close the sid's open epoch, freezing its graph for Stage 4. A sid with no open epoch (the prior turn's
 * surface, or none) registers nothing, so closing it never shifts the report order. The one close path
 * shared by `deleteSurface` (`closeEpoch`) and `createSurface` (`recreateEpoch`).
 */
function freezeOpenEpoch(surfaces: PayloadSurfaces, sid: string): void {
  const lifecycle = surfaces.bySid.get(sid)
  if (lifecycle?.open === undefined) return
  lifecycle.closed.push(lifecycle.open)
  lifecycle.open = undefined
}

/**
 * ADR-0064 amendment A2: `deleteSurface` closes the sid's open epoch, freezing its graph for Stage 4,
 * and marks the sid DELETED until a `createSurface` re-creates it. A delete for a surface with no epoch
 * yet in this payload (the prior turn's surface, or none) registers no graph, so it never shifts the
 * report order. A delete with no open epoch frees nothing more: a no-op, as in the renderer.
 */
function closeEpoch(surfaces: PayloadSurfaces, sid: string): void {
  surfaces.deleted.add(sid)
  freezeOpenEpoch(surfaces, sid)
}

/**
 * ADR-0064 re-create erratum (2026-10-04, GH #1772): a `createSurface` closes the sid's open epoch, if
 * any, then opens a fresh one marked `created` (the TKT-0081 seed never applies to it, A4). The renderer
 * replaces a live surface on a re-create, so the prior epoch's `root`, components and seed are gone; the
 * new epoch is judged on what it delivers alone. Unlike `closeEpoch` it does NOT mark the sid deleted
 * (the create IS the reopen). An empty epoch it closes mounted nothing, so A3 exempts it.
 */
function recreateEpoch(surfaces: PayloadSurfaces, sid: string): void {
  freezeOpenEpoch(surfaces, sid)
  openEpoch(surfaces, sid).created = true
}

/**
 * ADR-0064 amendment erratum (2026-10-04): a delivery (`updateComponents`/`updateDataModel`) to a sid
 * this payload deleted and has not re-created is the message the renderer drops (it addresses no
 * surface), so it fails the EXISTING IDGRAPH code at `sid:update-after-delete`, once per such message.
 * A sid this payload never deleted is untouched (the implicit open stands), so a payload without a
 * `deleteSurface` judges exactly as before. Returns whether the delivery was rejected.
 */
function rejectIfDeleted(surfaces: PayloadSurfaces, sid: string, failures: Failure[]): boolean {
  if (!surfaces.deleted.has(sid)) return false
  push(failures, 'IDGRAPH', `${sid}:update-after-delete`)
  return true
}

function requireStr(body: Record<string, unknown>, key: string, loc: string, failures: Failure[]): void {
  if (typeof body[key] !== 'string') push(failures, 'SCHEMA', `${loc}.${key}`)
}

function push(failures: Failure[], code: Failure['code'], path: string): void {
  failures.push({ code, path })
}
