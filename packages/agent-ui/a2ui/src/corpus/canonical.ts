// canonical.ts — the A2UI output canonicalizer (corpus LLD-C3, SPEC-R6/N6).
//
// `updateComponents` is an ADJACENCY LIST: declaration order is insignificant (refs are by id) but
// child order WITHIN a container is semantic and MUST be preserved (LLD §4). Two exemplars whose
// component/data-model CONTENT is identical up to id-spelling, delivery order, and object key order
// must canonicalize to the identical hash (dedup's exact-match leg, LLD-C4); anything that changes
// the bound tree or the bundled data model must change it.
//
// Algorithm (LLD §4):
//   1. fold the stream — upsert `updateComponents` by id into one component map; apply `updateDataModel`
//      writes (in order) into ONE data-model value.
//   2. assert a `root` component exists (defensive backstop — tier-1 `validateA2ui` already rejects a
//      missing/duplicate root or a cycle before admission ever reaches this module, LLD §6).
//   3. DFS from `root` (via `child`, then `children` — declared field order), assigning canonical ids
//      `c0=root, c1, c2, …` in visit order; a node reachable through more than one parent is visited once.
//   4. rewrite every id reference (`child`, `children: string[]`, and a children-template's `componentId`,
//      A2uiChildTemplate — v1.0's dynamic-list form) to its canonical id. JSON-Pointer paths are NEVER
//      rewritten — they address the data model, not component ids.
//   5/6. serialize `{components, dataModel}` with a stable writer (recursively sorted object keys, array
//      order preserved, no insignignificant whitespace) and hash it via `crypto.subtle` (SHA-256, N6).
//
// ADR-0064 amendment (2026-10-03, A5) / GH #1740: EPOCHS. The renderer frees a surface's graph and data
// model at `deleteSurface`, and the shared validator judges each epoch on its own graph (A2), so step 1
// folds PER EPOCH: `foldStream` resets the component map and the data model at every `deleteSurface`.
// Steps 2 to 4 run on each epoch alone. A record with ONE epoch serializes exactly as before (byte-
// identical, so every committed `canonicalHash` re-derives unchanged); a record with N >= 2 serializes
// the ordered LIST of per-epoch forms, each the existing shape, and the hash covers the list. An epoch
// that delivered no components mounted nothing and contributes no form (the validator's A3 exemption
// for an empty closed epoch), so a leading or trailing `deleteSurface` never changes the hash.
//
// Zero-dep, platform-neutral (SPEC-N5): only `protocol.ts` types are imported; hashing rides the
// platform's `crypto.subtle` (Node ≥ 19 and every browser) — no `node:crypto`, no reactive-kernel
// coupling (this folds a whole stream in one pass; it needs no per-path memoization).

import type { A2uiOutput, A2uiComponent, A2uiChildTemplate, ErrorCode } from '../protocol.ts'

/** A component in canonical form: same shape as the wire `A2uiComponent`, but `id`/`child`/`children`
 * (and a children-template's `componentId`) are rewritten to canonical ids (LLD §4 step 4). */
export interface CanonicalComponent {
  id: string
  component: string
  child?: string
  children?: string[] | A2uiChildTemplate
  [prop: string]: unknown
}

/** The canonicalized tree + folded data model (LLD §4 step 5). Component order is DFS visit order —
 * significant (it IS the canonical numbering); each component's own keys sort during serialization. */
export interface CanonicalForm {
  components: CanonicalComponent[]
  dataModel: unknown
}

/**
 * `canonicalize`'s result. `form`/`hash`/`componentsUsed` are the LLD §4 contract; `serialized` and
 * `disconnected` are additive (not a widened wire contract — nothing here crosses the wire): `serialized`
 * is the exact string `hash` was computed over, so a caller/test can assert byte-identical serialization
 * directly (SPEC-R6 AC1), not just hash equality; `disconnected` names the declared-but-unreachable
 * component ids the DFS dropped (LLD §4 "dropped and noted" edge case) so admission can log them.
 */
export interface CanonicalizeResult {
  /** The FINAL epoch's canonical form. For a one-epoch record (every record before ADR-0064's 2026-10-03
   *  amendment) it is exactly the value `serialized` encodes. */
  form: CanonicalForm
  /** ADR-0064 amendment A5: every epoch's form in stream order (length >= 1). With two or more, this
   *  ordered list is what `serialized` encodes and `hash` covers; with one, it is `[form]`. */
  epochs: CanonicalForm[]
  serialized: string
  hash: string
  componentsUsed: string[]
  disconnected: string[]
}

/**
 * Thrown by the DFS's defensive root/cycle guard (LLD §4 step 2). Tier-1 (`validateA2ui`) already
 * rejects a missing/duplicate root or a cycle before admission's canonical+hash stage ever runs
 * (LLD §6) — this is a backstop, not a new validation surface. A future admission slice (LLD-C5) maps
 * `code` to `E_IDGRAPH` (LLD §6 table) the same way it maps every other tier-1 `ErrorCode`.
 */
export class CanonicalizeError extends Error {
  readonly code: ErrorCode = 'IDGRAPH'
  constructor(message: string) {
    super(message)
    this.name = 'CanonicalizeError'
  }
}

/** Reduce an A2UI message stream to its canonical form + a stable SHA-256 hash (LLD-C3, SPEC-R6/N6). */
export async function canonicalize(out: A2uiOutput): Promise<CanonicalizeResult> {
  const epochs = foldStream(out).map(canonicalizeEpoch)
  const final = epochs[epochs.length - 1]!
  const forms = epochs.map((e) => e.form)

  // ADR-0064 amendment A5: one epoch serializes as the bare form (today's bytes), N >= 2 as the list.
  const serialized = stableStringify(forms.length === 1 ? final.form : forms)
  const hash = await sha256Hex(serialized)
  // The final epoch's types, the rule ADR-0231 §2 states for the epoch-aware fold (what the record ends
  // up rendering); identical to today's set for a one-epoch record.
  const componentsUsed = [...final.used].sort()
  const disconnected = epochs.flatMap((e) => e.disconnected)

  return { form: final.form, epochs: forms, serialized, hash, componentsUsed, disconnected }
}

/** Steps 2 to 4 on ONE epoch's fold: DFS numbering, id rewrite, and the unreachable ids it dropped. */
function canonicalizeEpoch({ byId, dataModel }: FoldedEpoch): {
  form: CanonicalForm
  used: Set<string>
  disconnected: string[]
} {
  const { order, used } = computeVisitOrder(byId)

  const canonicalIds = new Map<string, string>(order.map((id, i) => [id, `c${i}`]))
  const components = order.map((id) => buildCanonicalComponent(byId.get(id)!, canonicalIds))
  const disconnected = [...byId.keys()].filter((id) => !canonicalIds.has(id))

  return { form: { components, dataModel }, used, disconnected }
}

// ── step 1: fold the stream, per epoch ──────────────────────────────────────────────

/** One epoch's fold: its upserted component map and the data model its writes built. */
interface FoldedEpoch {
  byId: Map<string, A2uiComponent>
  dataModel: unknown
}

/**
 * Fold the stream into its epochs, in order (ADR-0064 amendment A5). Within an epoch: upsert
 * `updateComponents` by id, apply `updateDataModel` writes in stream order. At a `deleteSurface` the
 * epoch closes and the next starts from an empty component map and an undefined data model, the state
 * the renderer's fresh surface starts from. Only epochs that delivered at least one component are
 * returned. A stream that delivered none folds to ONE empty epoch, so the DFS's defensive no-root guard
 * fires exactly as it always has.
 */
function foldStream(out: A2uiOutput): FoldedEpoch[] {
  const epochs: FoldedEpoch[] = []
  let byId = new Map<string, A2uiComponent>()
  let dataModel: unknown

  const close = (): void => {
    if (byId.size > 0) epochs.push({ byId, dataModel })
    byId = new Map()
    dataModel = undefined
  }

  for (const msg of out) {
    if ('updateComponents' in msg) {
      for (const comp of msg.updateComponents.components) byId.set(comp.id, comp) // upsert by id
    } else if ('updateDataModel' in msg) {
      const { path, value } = msg.updateDataModel
      // Whole-document replace when no path, "" or "/" (the upstream protocol's root alias — ADR-0099;
      // mirrors the renderer's `#onUpdateDataModel`); else an absolute RFC-6901 write, applied in stream
      // order.
      dataModel =
        path === undefined || path === '' || path === '/' ? value : setAtPointer(dataModel, path, value)
    } else if ('deleteSurface' in msg) {
      close() // the epoch boundary: the renderer frees the surface's graph and data model here
    }
    // createSurface / actionResponse / callFunction carry no component/data-model content and are not
    // boundaries (a createSurface never resets an open epoch, matching the validator's A2 rule).
  }
  close()

  return epochs.length > 0 ? epochs : [{ byId: new Map(), dataModel: undefined }]
}

const decodePointerToken = (token: string): string => token.replace(/~1/g, '/').replace(/~0/g, '~')

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Immutably apply one `updateDataModel` write at an absolute RFC-6901 pointer, materializing missing
 * objects along the path. Mirrors the renderer's `binding.ts#setPointer` semantics; reimplemented here
 * (rather than imported) so this module stays decoupled from the reactive kernel — folding a whole
 * stream in one pass needs no per-path memoization, and the corpus core imports only `protocol.ts`.
 */
function setAtPointer(doc: unknown, pointer: string, value: unknown): unknown {
  if (pointer[0] !== '/') return doc // malformed/non-absolute — tier-1 rejects this before canonicalize runs
  const tokens = pointer.slice(1).split('/').map(decodePointerToken)
  const set = (node: unknown, i: number): unknown => {
    if (i === tokens.length) return value
    const key = tokens[i]!
    if (Array.isArray(node)) {
      const copy = node.slice()
      copy[Number(key)] = set(node[Number(key)], i + 1)
      return copy
    }
    const base = isPlainObject(node) ? node : {}
    return { ...base, [key]: set(base[key], i + 1) }
  }
  return set(doc, 0)
}

// ── steps 2–3: DFS from root, canonical numbering ──────────────────────────────────

function isChildTemplate(v: string[] | A2uiChildTemplate | undefined): v is A2uiChildTemplate {
  return v !== undefined && !Array.isArray(v)
}

/** DFS from `root` (via `child` then `children`, declared field order — LLD §4 step 3). Returns the
 * visit order (canonical numbering source) and the set of reachable component type names. */
function computeVisitOrder(byId: Map<string, A2uiComponent>): { order: string[]; used: Set<string> } {
  if (!byId.has('root')) {
    throw new CanonicalizeError('exactly one root component is required (found none) — LLD §4 step 2')
  }

  const order: string[] = []
  const used = new Set<string>()
  const visited = new Set<string>()
  const visiting = new Set<string>() // in-progress DFS stack — a re-entry here is a cycle

  const visit = (id: string): void => {
    if (visited.has(id)) return // already numbered (a shared child reached via a 2nd parent)
    if (visiting.has(id)) throw new CanonicalizeError(`cycle detected at component "${id}" — LLD §4 step 2`)
    const comp = byId.get(id)
    if (comp === undefined) return // dangling ref — tier-1 rejects this before canonicalize runs

    visiting.add(id)
    order.push(id)
    used.add(comp.component)

    if (typeof comp.child === 'string') visit(comp.child)
    if (Array.isArray(comp.children)) {
      for (const childId of comp.children) visit(childId) // declared order — semantic, preserved
    } else if (isChildTemplate(comp.children)) {
      visit(comp.children.componentId) // the template's target joins the DFS once (LLD §4 step 4)
    }

    visiting.delete(id)
    visited.add(id)
  }

  visit('root')
  return { order, used }
}

// ── step 4: rewrite id references ───────────────────────────────────────────────────

function buildCanonicalComponent(comp: A2uiComponent, canonicalIds: ReadonlyMap<string, string>): CanonicalComponent {
  const out: CanonicalComponent = { id: canonicalIds.get(comp.id)!, component: comp.component }

  if (typeof comp.child === 'string') {
    out.child = canonicalIds.get(comp.child) ?? comp.child
  }
  if (Array.isArray(comp.children)) {
    out.children = comp.children.map((c) => canonicalIds.get(c) ?? c)
  } else if (isChildTemplate(comp.children)) {
    out.children = {
      path: comp.children.path, // a JSON-Pointer into the data model — never rewritten
      componentId: canonicalIds.get(comp.children.componentId) ?? comp.children.componentId,
    }
  }

  // Every other property copied verbatim — including `{path}`/`{call}` bindings: those address the
  // data model or a function, never a component id, so they are NOT rewritten (LLD §4 step 4).
  for (const [key, value] of Object.entries(comp)) {
    if (key === 'id' || key === 'component' || key === 'child' || key === 'children') continue
    out[key] = value
  }
  return out
}

// ── steps 5–6: stable serialization + hash ──────────────────────────────────────────

/** JSON-compatible encoding with recursively sorted object keys and no insignificant whitespace
 * (LLD §4 step 6). Array order is preserved (it is semantic). Mirrors `JSON.stringify`'s treatment of
 * `undefined` (an object property holding `undefined` is omitted; an array element becomes `null`). */
function encode(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) return `[${value.map((v) => encode(v) ?? 'null').join(',')}]`
  if (isPlainObject(value)) {
    const parts: string[] = []
    for (const key of Object.keys(value).sort()) {
      const enc = encode(value[key])
      if (enc !== undefined) parts.push(`${JSON.stringify(key)}:${enc}`)
    }
    return `{${parts.join(',')}}`
  }
  if (typeof value === 'function' || typeof value === 'symbol') return undefined
  return JSON.stringify(value) // string / number / boolean / null
}

function stableStringify(value: unknown): string {
  return encode(value) ?? 'null'
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
