// tree.ts — component buffer + tree reconstructor, render-on-root (renderer LLD-C4, SPEC-R3/R4).
//
// `updateComponents` ships a flat adjacency list. This module buffers components by `id` into
// `surface.components`, reconstructs the parent→child tree via `child`/`children` references, and
// begins rendering the moment a valid `root` (the component with `id:'root'`, SPEC-R3 AC1) exists —
// there is no explicit "begin" signal (SPEC-R3). Rendering means: walk the tree depth-first and ask
// the injected `createWidget` (renderer LLD-C7) for each node's live control, wiring child controls
// under their parent in declaration order (child order is semantic).
//
// Out-of-order tolerance (SPEC-R4). A parent may reference a `child`/`children` id that has not
// arrived yet. We mount a position-preserving comment **anchor** in its slot and remember it in
// `pendingParents` keyed by the missing id; when a later `updateComponents` delivers that id we
// mount its subtree and swap it in for the anchor — no re-render of the unaffected tree (SPEC-R4 AC1).
//
// Eager id-graph guard (LLD-C4 / §8). The shared validator (validate.ts) judges the COMPLETE
// component set at *finalize*, where missing-root and dangling are legal transient mid-stream states.
// The two *always*-invalid cases — a 2nd `root` and a cycle — are guarded here, in-stream, per
// SPEC-R3 AC2: a 2nd `id:'root'` keeps the existing root and emits `IDGRAPH`; a cycle in
// `child`/`children` emits `IDGRAPH` and refuses to mount the invalid graph.
//
// Decoupling. The widget factory (renderer LLD-C7, a sibling slice) is consumed through the
// B0-pinned `CreateWidget` signature (`./types.ts`); this module is proven against a stub. The host
// (LLD-C13) owns one `SurfaceTree` per surface, wires `createWidget` + the client-error `onError`
// callback, and reads `surface.widgets.get('root')` to attach the rendered root into the document.

import type { A2uiComponent, A2uiError, A2uiServerMessage } from '../protocol.ts'
import type { Surface } from './surface.ts'
import type { CreateWidget } from './types.ts'

/** The `updateComponents` server-message envelope — the only message the tree consumes (LLD-C4). */
export type UpdateComponentsMessage = Extract<A2uiServerMessage, { updateComponents: object }>

/** Cross-slice collaborators the tree needs: the widget factory (LLD-C7) and a client-error sink. */
export interface TreeDeps {
  /** Resolve + instantiate the live control for one node (renderer LLD-C7); pinned via `./types.ts`. */
  createWidget: CreateWidget
  /** Emit a client→server error (here only `IDGRAPH`); the host wraps it in `{version, error}`. */
  onError: (error: A2uiError) => void
}

/**
 * One surface's component buffer + reconstructed tree (renderer LLD-C4). Holds the per-surface mount
 * state (pending anchors, whether the root is up) that the flat `Surface` model does not carry, so
 * the host keeps one instance per surface for the surface's lifetime.
 */
export class SurfaceTree {
  readonly #surface: Surface
  readonly #deps: TreeDeps
  // missing id → the comment anchors holding its slot under each waiting parent (SPEC-R4).
  readonly #pendingParents = new Map<string, Comment[]>()
  #rootDelivered = false // a first `id:'root'` was accepted; a later one is an IDGRAPH (SPEC-R3 AC2).
  #rootMounted = false // the tree has been mounted from `root` (mount-once gate).
  #cycleReported = false // a cycle was found; the graph is invalid, so further batches are inert.

  constructor(surface: Surface, deps: TreeDeps) {
    this.#surface = surface
    this.#deps = deps
  }

  /** The rendered root control once mounted; the host attaches this into the document (SPEC-R3). */
  get rootElement(): HTMLElement | undefined {
    return this.#surface.widgets.get('root')
  }

  /** Whether the tree has mounted on a valid `root` yet. */
  get isMounted(): boolean {
    return this.#rootMounted
  }

  /**
   * Apply one `updateComponents` batch: buffer by id, eager-guard the always-invalid id-graph cases,
   * then mount on the first valid `root` or patch newly-delivered ids into waiting slots.
   */
  apply(message: UpdateComponentsMessage): void {
    const delivered: string[] = []
    for (const comp of message.updateComponents.components) {
      if (comp.id === 'root' && this.#rootDelivered) {
        // SPEC-R3 AC2: a second `root` is an id-graph error; keep the existing root, drop the dupe.
        this.#idgraph(`${this.#surface.id}:root`)
        continue
      }
      if (comp.id === 'root') this.#rootDelivered = true
      this.#surface.components.set(comp.id, comp) // buffer (upsert) by id (SPEC-R3)
      delivered.push(comp.id)
    }

    // Eager id-graph guard (in-stream): a cycle in `child`/`children` is always invalid (LLD-C4 §8).
    // Detected over the delivered set only — a dangling ref is a legal out-of-order hold, not a cycle.
    if (this.#cycleReported) return
    if (hasCycle(this.#surface.components)) {
      this.#cycleReported = true
      this.#idgraph(`${this.#surface.id}:cycle`)
      return // refuse to mount an invalid graph
    }

    if (!this.#rootMounted) {
      // Render-on-root: nothing paints until the `root` component exists (SPEC-R3 AC1).
      if (this.#surface.components.has('root')) this.#mountTree()
      return
    }

    // Root already up: patch in any just-delivered id a mounted parent is holding a slot for (R4 AC1).
    for (const id of delivered) {
      if (this.#pendingParents.has(id)) this.#patchPending(id)
    }
  }

  /** Depth-first mount from `root` (guaranteed present by the caller); fills `surface.widgets`. */
  #mountTree(): void {
    this.#mountNode('root')
    this.#rootMounted = true
  }

  /**
   * Build the DOM node for `id`: the real widget subtree, or a position-preserving comment anchor if
   * the component has not arrived (registered in `pendingParents` for later patch-in, SPEC-R4).
   */
  #mountNode(id: string): Node {
    const node = this.#surface.components.get(id)
    if (node === undefined) {
      const anchor = document.createComment(`a2ui:pending:${id}`)
      const waiting = this.#pendingParents.get(id)
      if (waiting !== undefined) waiting.push(anchor)
      else this.#pendingParents.set(id, [anchor])
      return anchor
    }
    // A tree node is reached once; reuse defends against a degenerate multi-reference / re-entry.
    const existing = this.#surface.widgets.get(id)
    if (existing !== undefined) return existing

    const el = this.#deps.createWidget(node, this.#surface)
    this.#surface.widgets.set(id, el)
    for (const childId of childRefs(node)) el.appendChild(this.#mountNode(childId))
    return el
  }

  /** A previously-missing id arrived: mount its subtree and swap it in for each waiting anchor. */
  #patchPending(id: string): void {
    const anchors = this.#pendingParents.get(id)
    if (anchors === undefined) return
    this.#pendingParents.delete(id)
    for (const anchor of anchors) {
      const parent = anchor.parentNode
      const node = this.#mountNode(id) // may register fresh anchors for this id's own missing children
      if (parent !== null) parent.replaceChild(node, anchor)
    }
  }

  #idgraph(path: string): void {
    this.#deps.onError({ code: 'IDGRAPH', surfaceId: this.#surface.id, path, message: `id-graph violation: ${path}` })
  }
}

/** A node's child ids in render order: `child` first, then `children` in array order (semantic). */
function childRefs(node: A2uiComponent): string[] {
  const out: string[] = []
  if (typeof node.child === 'string') out.push(node.child)
  if (Array.isArray(node.children)) for (const c of node.children) if (typeof c === 'string') out.push(c)
  return out
}

/**
 * Cycle in the buffered `child`/`children` graph, by three-colour DFS (mirrors validate.ts so the
 * eager guard and the finalize validator agree). A reference to a not-yet-delivered id is skipped —
 * that is an out-of-order hold (SPEC-R4), not a cycle.
 */
function hasCycle(byId: Map<string, A2uiComponent>): boolean {
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()

  const dfs = (id: string): boolean => {
    color.set(id, GRAY)
    const node = byId.get(id)
    if (node !== undefined) {
      for (const ref of childRefs(node)) {
        if (!byId.has(ref)) continue // dangling = out-of-order hold, handled by pendingParents
        const c = color.get(ref) ?? WHITE
        if (c === GRAY) return true
        if (c === WHITE && dfs(ref)) return true
      }
    }
    color.set(id, BLACK)
    return false
  }

  for (const id of byId.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE && dfs(id)) return true
  }
  return false
}
