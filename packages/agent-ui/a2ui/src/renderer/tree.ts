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

import type { A2uiChildTemplate, A2uiComponent, A2uiError, A2uiServerMessage } from '../protocol.ts'
import type { Surface } from './surface.ts'
import type { CreateWidget, ItemScope, CreateOnly, RewireNode, ResetProp, ComponentDefOf } from './types.ts'
import type { Scope } from '@agent-ui/components'
import { createScope, effect } from '@agent-ui/components'
import { renderList } from './list.ts'

/** The `updateComponents` server-message envelope — the only message the tree consumes (LLD-C4). */
export type UpdateComponentsMessage = Extract<A2uiServerMessage, { updateComponents: object }>

/**
 * Cross-slice collaborators the tree needs: the widget factory (LLD-C7), a client-error sink, and — for
 * structural-resend reconciliation (RSR-C4..C7, ADR-0128) — the three additional host entry points that
 * let `#reconcileProps` re-wire an EXISTING element without ever minting a new one.
 */
export interface TreeDeps {
  /** Resolve + instantiate the live control for one node (renderer LLD-C7); pinned via `./types.ts`. */
  createWidget: CreateWidget
  /** Mint ONLY (no wiring) — reused for `#resetOmittedProps`' throwaway pristine-default read (RSR-C6). */
  create: CreateOnly
  /** Wire props/action/checks onto an EXISTING element (RSR-C6's `#reconcileProps`) — never re-mints. */
  rewireNode: RewireNode
  /** Resolve `node`'s factory and call its `applyProp` — the narrowed identity-mapped omitted-prop reset. */
  resetProp: ResetProp
  /** The catalog `ComponentDef` for a node's type — the enum/`mapsTo` authority `#resetOmittedProps` reads. */
  componentDefOf: ComponentDefOf
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
  // id → this STATIC-tree node's own disposable scopes (RSR-C1, ADR-0128) — generalizes the LLD-C6
  // per-item pair to every node the ordinary DFS mounts (never a list-item instance, which stays
  // untracked here exactly as today). Populated at mount; consumed by structural-resend reconciliation.
  //
  // SPLIT into TWO scopes (post-review correction — a single combined scope was a real defect): a
  // container's `childrenScope` is the `parentScope` a nested dynamic-list TEMPLATE (LLD-C6) roots its
  // reconcile loop + teardown carrier in (`#mountChildrenInto`'s template branch). A PROP-ONLY resend
  // (`#reconcileProps`) must dispose+rebuild ONLY this node's own bound-prop/input/action/checks wiring —
  // disposing `childrenScope` too would silently freeze a nested list (its grow/shrink effect dies, and
  // `rewireNode` never re-invokes `renderList`, since prop reconcile never touches children). So
  // `#reconcileProps` disposes/rebuilds `propsScope` ONLY; `childrenScope` is disposed ONLY by
  // `#disposeSubtree` (this node's own removal) or the surface-teardown carrier below (whole-surface
  // teardown) — never by a prop-only reconcile. `ac` stays single: it gates only this node's OWN
  // input/action/checks listeners, all installed during prop wiring, never during the children walk
  // (renderList threads its OWN per-item ac's internally, never this node's).
  readonly #nodeScopes = new Map<string, { propsScope: Scope; childrenScope: Scope; ac: AbortController }>()
  #rootDelivered = false // a first `id:'root'` was accepted; a later one is an IDGRAPH (SPEC-R3 AC2).
  #rootMounted = false // the tree has been mounted from `root` (mount-once gate).
  #cycleReported = false // a cycle was found; the graph is invalid, so further batches are inert.

  constructor(surface: Surface, deps: TreeDeps) {
    this.#surface = surface
    this.#deps = deps
    // Surface-teardown carrier (RSR-C1): a per-node scope nothing else ever disposes on WHOLE-surface
    // teardown is a leak — `disposeSurface` only calls `surface.scope.dispose()`, which does not reach a
    // flat, independently-created `createScope()` unless something explicitly disposes it. Mirrors
    // `list.ts`'s own teardown-carrier `effect` (no reactive read ⇒ its cleanup fires ONLY when
    // `surface.scope` disposes, never on a re-run) so `deleteSurface`/`dispose()` still leave zero live
    // signals/listeners (runtime SPEC-N3) even though every static node now owns its own scope.
    this.#surface.scope.run(() =>
      effect(() => () => {
        for (const { propsScope, childrenScope, ac } of this.#nodeScopes.values()) {
          propsScope.dispose()
          childrenScope.dispose()
          ac.abort()
        }
        this.#nodeScopes.clear()
      }),
    )
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
   * then mount on the first valid `root`, patch newly-delivered ids into waiting slots, and — structural-
   * resend reconciliation (RSR-C4, ADR-0128) — reconcile any id that was ALREADY mounted against its
   * previous buffered record.
   */
  apply(message: UpdateComponentsMessage): void {
    const delivered: string[] = []
    const resent = new Map<string, A2uiComponent>() // id → its PREVIOUS record, only for already-mounted ids
    for (const comp of message.updateComponents.components) {
      if (comp.id === 'root' && this.#rootDelivered) {
        // SPEC-R3 AC2: a second `root` is an id-graph error; keep the existing root, drop the dupe.
        this.#idgraph(`${this.#surface.id}:root`)
        continue
      }
      if (comp.id === 'root') this.#rootDelivered = true
      const previous = this.#surface.components.get(comp.id)
      // A resend: this id already has a live widget (not merely buffered — an out-of-order first arrival
      // has a buffered record too, from an EARLIER dangling reference, but no widget yet).
      if (previous !== undefined && this.#surface.widgets.has(comp.id)) resent.set(comp.id, previous)
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
      // Render-on-root: nothing paints until the `root` component exists (SPEC-R3 AC1). Nothing can be a
      // resend yet (no widget is mounted before this point), so `resent` is empty here.
      if (this.#surface.components.has('root')) this.#mountTree()
      return
    }

    // Root already up: patch in any just-delivered id a mounted parent is holding a slot for (R4 AC1).
    for (const id of delivered) {
      if (this.#pendingParents.has(id)) this.#patchPending(id)
    }

    // Structural-resend reconciliation (RSR-C4, SPEC-R1/R2/R3): every id that was ALREADY mounted and is
    // resent in THIS batch reconciles against its previous record — runs AFTER the pending-parent patch-in
    // so a resend that also newly-references a first-arrival id sees that child already mounted.
    for (const [id, previous] of resent) this.#reconcileNode(id, previous, this.#surface.components.get(id)!)
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

    // RSR-C1 (ADR-0128): every STATIC-tree node gets its own disposable scopes — generalizing the LLD-C6
    // per-item pair to the whole static tree, not only list-item instances. `"root"` gets them too, for
    // symmetry (SPEC-R4 — it is simply never reconciled). TWO scopes, not one (the H1 review fix):
    // `propsScope` owns this node's OWN bound-prop effects (what a later prop-only reconcile may
    // dispose+rebuild in isolation); `childrenScope` owns whatever a nested dynamic-list TEMPLATE roots
    // here (its reconcile loop + teardown carrier, via `#mountChildrenInto`'s template branch) — disposed
    // only when this whole node is removed, never by a prop-only reconcile.
    const propsScope = createScope()
    const childrenScope = createScope()
    const ac = new AbortController()
    this.#nodeScopes.set(id, { propsScope, childrenScope, ac })
    const el = this.#deps.createWidget(node, this.#surface, propsScope, undefined, ac)
    this.#surface.widgets.set(id, el)
    this.#mountChildrenInto(el, node, childrenScope, undefined, false, ac)
    return el
  }

  /**
   * Walk `node`'s children into `el`, threading `scope`, `itemScope`, and `ac` so every descendant
   * resolves bindings in the right context and registers DOM listeners on the right controller
   * (renderer LLD-C6 / ADR-0024 amendment + listener-leak fix). Two modes:
   *  - `instance=false` (static tree): each child id is looked up via `#mountNode` — the ordinary DFS
   *    that registers anchors in `#pendingParents` and records widgets by id. Byte-for-byte equivalent
   *    to the previous inline children-loop in `#mountNode`, so all static-tree tests are unchanged.
   *  - `instance=true` (list-item descendant): each child id is looked up via `#mountInstance` — which
   *    does NOT register in `#pendingParents` or `widgets` (ids alias across N instances). A missing
   *    id in instance mode yields an inert comment anchor and is NOT patched later.
   * A `children`-TEMPLATE at any depth hands off to `renderList` with `mountChildren` bound to this
   * same `#mountChildrenInto` (instance mode), so subtrees and NESTED lists compose for free. The
   * `mountChildren` callback receives the per-item `ac` created by `appendInstance` so every
   * descendant's DOM listeners are gated on the item's lifetime, not the surface's.
   */
  #mountChildrenInto(el: HTMLElement, node: A2uiComponent, scope: Scope, itemScope: ItemScope | undefined, instance: boolean, ac: AbortController): void {
    // A `children`-TEMPLATE (`{path, componentId}`, A2UI v1.0) is a dynamic list: hand the container
    // to the positional loop. Pass `mountChildren` so list items that are themselves containers recurse
    // back here; pass `parentScope`/`parentItemScope` so the inner loop is scoped to `scope` — for a
    // nested list this binds the inner list's lifetime to the outer item's child scope. The callback
    // receives `childAc` (the per-item AbortController from `appendInstance`) so descendants thread it.
    if (isChildTemplate(node.children)) {
      renderList({
        container: el,
        template: node.children,
        surface: this.#surface,
        createWidget: this.#deps.createWidget,
        mountChildren: (childEl, childNode, childScope, childItemScope, childAc) =>
          this.#mountChildrenInto(childEl, childNode, childScope, childItemScope, true, childAc),
        parentScope: scope,
        parentItemScope: itemScope,
      })
    } else {
      for (const childId of childRefs(node)) {
        el.appendChild(
          instance
            ? this.#mountInstance(childId, scope, itemScope, ac)
            : this.#mountNode(childId),
        )
      }
    }
  }

  /**
   * Build one descendant node INSIDE a list item — the instance-mode counterpart of `#mountNode`.
   * Differences from `#mountNode`: (a) a missing id produces an INERT comment anchor that is NOT
   * registered in `#pendingParents` (ids alias across N instances — a patch triggered for one alias
   * would not reach the others); (b) the widget is NOT stored in `surface.widgets` (only the item
   * root is relevant to the host via `widgets.get('root')`); (c) the per-item `scope`, `itemScope`,
   * and `ac` are threaded so every descendant's bound-prop effects are owned by the item scope,
   * relative bindings resolve to this item's pointer, and DOM listeners are gated on the item's `ac`.
   */
  #mountInstance(id: string, scope: Scope, itemScope: ItemScope | undefined, ac: AbortController): Node {
    const node = this.#surface.components.get(id)
    if (node === undefined) {
      // Not yet delivered: inert anchor. Not patched in later (see class header; instance ids alias).
      return document.createComment(`a2ui:pending:${id}`)
    }
    const el = this.#deps.createWidget(node, this.#surface, scope, itemScope, ac)
    this.#mountChildrenInto(el, node, scope, itemScope, true, ac)
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

  // ── structural-resend reconciliation (RSR-C4..C7, ADR-0128 / renderer-structural-resend.spec.md) ──────

  /**
   * Dispatch one resent id's reconciliation (RSR-C4): computes both diffs against the SAME previous/next
   * pair and gates each independently, so a resend touching only `children` runs SPEC-R1's child diff and
   * skips SPEC-R2's prop rewire, and vice versa. `"root"` is never reconciled (SPEC-R4) — the shipped
   * IDGRAPH guard already forecloses a second `root` delivery before this would ever be reached, but the
   * check is kept here too as the SPEC's own explicit carve-out.
   */
  #reconcileNode(id: string, previous: A2uiComponent, next: A2uiComponent): void {
    if (id === 'root') return
    const oldRefs = childRefs(previous)
    const newRefs = childRefs(next)
    if (!sameOrder(oldRefs, newRefs)) this.#reconcileChildren(id, oldRefs, newRefs)
    if (!samePropsDeep(previous, next)) this.#reconcileProps(id, previous, next)
  }

  /**
   * Children reconcile: an id-KEYED set diff (RSR-C5, SPEC-R1) — never positional (contrast LLD-C6's
   * array-template lists, which have no id at all). A removed id's whole subtree tears down leak-free
   * (SPEC-N1); a newly-referenced id mounts fresh via the ordinary `#mountNode` path (SPEC-R1 AC1 — an
   * out-of-order child within the same wave falls to the existing pending-anchor mechanism unchanged) and
   * inserts at its position in the new order; a SURVIVOR (present in both sets) keeps its current DOM
   * node and position untouched, regardless of any reorder in the new list (SPEC-R5 — deferred, ADR-0128).
   *
   * Walking `newRefs` in REVERSE and tracking `anchor` as "the next already-positioned sibling" gives
   * correct insertion order in one pass with no DOM query per insert; `insertBefore(x, null)` is
   * `appendChild`, the natural base case for the last-in-order child.
   *
   * TKT-0031: a survivor's anchor is only ever adopted when it is still genuinely `el`'s OWN direct
   * child — a child-relocating container (ADR-0017 family) may have moved a survivor's widget into its
   * own internal panel by resend time, and such a node cannot serve as an `insertBefore(x, anchor)`
   * anchor against `el` (it would throw `NotFoundError`, the ticket's defect). See the per-iteration
   * comment below for the ownership argument.
   */
  #reconcileChildren(id: string, oldRefs: string[], newRefs: string[]): void {
    const el = this.#surface.widgets.get(id)! // guaranteed present — this id is a resend of a mounted node
    const oldSet = new Set(oldRefs)
    const newSet = new Set(newRefs)
    for (const removedId of oldRefs) if (!newSet.has(removedId)) this.#disposeSubtree(removedId) // SPEC-R1 AC2, SPEC-N1

    let anchor: Node | null = null
    for (let i = newRefs.length - 1; i >= 0; i--) {
      const childId = newRefs[i]!
      if (oldSet.has(childId)) {
        // Survivor: SPEC-R5, untouched — never moved/re-created. A survivor still AWAITING its own
        // out-of-order arrival has no widget yet — its slot is one of THIS container's own pending comment
        // anchors (`el`'s child, not some other waiting parent's), found by parentage among `childId`'s
        // registered anchors (L1 review fix — a naive `?? anchor` fallback here would insert a new sibling
        // relative to the WRONG anchor when a still-pending survivor sits between it and the next survivor).
        const survivor = this.#surface.widgets.get(childId) ?? this.#pendingParents.get(childId)?.find((a) => a.parentNode === el)
        // TKT-0031: a child-relocating container (the ADR-0017 family — select/combo-box/menu/popover/
        // tooltip/modal/command-modal/disclosure) may, by resend time, have MOVED a survivor's widget out
        // of `el` into its own internal panel/overlay (select.ts's listbox adoption is the shipped
        // precedent). Such a survivor is no longer genuinely `el`'s own child, so it is UNUSABLE as an
        // `insertBefore` anchor here — `el.insertBefore(x, anchor)` requires `anchor.parentNode === el`
        // and throws `NotFoundError` otherwise. Only adopt a survivor as `anchor` when it still IS `el`'s
        // direct child; a relocated survivor is skipped (this iteration leaves `anchor` pointing at the
        // next-still-genuine survivor, or `null`), which is always a valid anchor. This is the fix's
        // named ownership argument (ticket's Arm 1): once a control adopts a child, the light-DOM order is
        // no longer the rendered order, so a NEW sibling can only be positioned relative to `el`'s
        // remaining real children — the relocating control owns wherever it places new children after
        // adoption (see e.g. select.ts's `#syncOptions` doc, which already documents "always lands at the
        // listbox's current tail" for exactly this reason — so no positional fidelity is lost by this skip
        // that the control itself would have preserved anyway).
        if (survivor !== undefined && survivor.parentNode === el) anchor = survivor
        continue
      }
      const node = this.#mountNode(childId) // fresh mount — SPEC-R1 AC1, the ordinary #mountNode path
      el.insertBefore(node, anchor) // safe: `node` was never previously connected
      anchor = node
    }
  }

  /**
   * Recursively dispose a removed subtree, leak-free (RSR-C7, SPEC-N1). Depth-first, children-before-
   * parent: a mounted descendant recurses first; an UN-arrived descendant's `#pendingParents` anchor(s)
   * rooted under THIS element are purged (filtered by `el.contains(a)`) so `#patchPending`'s later,
   * unconditional `#mountNode(id)` never mints an orphaned widget + node scope for an anchor that lived
   * inside an already-removed subtree — a real, pre-existing leak this reconcile must not inherit. This
   * node's own `(scope, ac)` pair disposes LAST — cascading into any nested dynamic list (LLD-C6) rooted
   * here via its shared `parentScope` teardown-carrier (SPEC-N1 AC1), since a container's OWN node scope
   * (§ RSR-C1) is exactly the `parentScope` a nested list's reconcile loop + teardown carrier were
   * installed in. `surface.components.delete(id)` makes a LATER re-add of this same id behave exactly
   * like a first-ever arrival — no stale buffered record left for the resend-diff (RSR-C4) to misread.
   */
  #disposeSubtree(id: string): void {
    const node = this.#surface.components.get(id)
    const el = this.#surface.widgets.get(id)
    if (node !== undefined) {
      for (const childId of childRefs(node)) {
        if (this.#surface.widgets.has(childId)) {
          this.#disposeSubtree(childId) // a mounted descendant: recurse
          continue
        }
        // `childId` never arrived — this subtree may be holding one of its `#pendingParents` anchors.
        // Purge only OUR anchor(s); a DIFFERENT still-live parent waiting on the same missing id is untouched.
        const anchors = this.#pendingParents.get(childId)
        if (anchors !== undefined && el !== undefined) {
          const remaining = anchors.filter((a) => !el.contains(a))
          if (remaining.length > 0) this.#pendingParents.set(childId, remaining)
          else this.#pendingParents.delete(childId)
        }
      }
    }
    const pair = this.#nodeScopes.get(id)
    pair?.propsScope.dispose() // kills this node's own bound-prop/input/action/checks wiring
    pair?.childrenScope.dispose() // AND, if a dynamic list is rooted here, its reconcile loop + teardown
    pair?.ac.abort() // carrier effect — cascading the list's own items (SPEC-N1 AC1)
    this.#nodeScopes.delete(id)
    el?.remove()
    this.#surface.widgets.delete(id)
    this.#surface.components.delete(id)
  }

  /**
   * Prop reconcile (RSR-C6, SPEC-R2): disposes and rebuilds ONLY the resent node's own `propsScope`+`ac`,
   * then re-wires the COMPLETE new record onto the SAME existing element — whole-record-upsert fidelity
   * (an omitted static literal does not linger for identity-mapped props, a rebound `{path}` target
   * re-resolves against the new target, not the old). `el` itself is never touched by `.remove()`/
   * `.replaceChild()` — only its bound-prop effects and structural wiring (input/action/checks) are torn
   * down and reinstalled, which is what preserves DOM identity, focus, and any component-internal state.
   *
   * `childrenScope` is DELIBERATELY left untouched (the H1 review fix): if this node's `children` is a
   * dynamic-list TEMPLATE (LLD-C6), `childrenScope` is the `parentScope` that template's reconcile loop +
   * teardown carrier are rooted in — disposing it here (as the first draft's single combined scope did)
   * would silently freeze the list on ANY prop-only resend of its container (e.g. a changed `gap`), since
   * `rewireNode` below re-wires props/input/action/checks only, never re-invokes `renderList`. A prop
   * reconcile never touches `children` by design (SPEC-R1/R2 are independently gated in `#reconcileNode`),
   * so `childrenScope` must survive; only `#disposeSubtree` (this node's own removal) or the surface-
   * teardown carrier disposes it.
   */
  #reconcileProps(id: string, previous: A2uiComponent, next: A2uiComponent): void {
    const el = this.#surface.widgets.get(id)!
    const old = this.#nodeScopes.get(id)!
    old.propsScope.dispose() // kills every bound-prop effect AND the input/action/checks listeners this
    old.ac.abort() // node installed — same one-two as #disposeSubtree, but the ELEMENT (and children) survive

    this.#resetOmittedProps(previous, next, el) // SPEC-R2 AC3 — narrowed, honest scope (below)

    const propsScope = createScope()
    const ac = new AbortController()
    this.#nodeScopes.set(id, { propsScope, childrenScope: old.childrenScope, ac })
    this.#deps.rewireNode(el, next, this.#surface, propsScope, undefined, ac) // re-applies the FULL new record
  }

  /**
   * SPEC-R2 AC3's narrowed omitted-prop reset. Disposing the old scope stops an effect from re-running; it
   * does NOT undo whatever value that effect (or a one-time `applyProp`) already wrote to `el` — a key
   * dropped between `previous` and `next` is never revisited by `rewireNode` (which only visits keys
   * present in `next`) and its stale value would otherwise stick. Resets ONLY when the catalog's mapping
   * for the dropped prop is IDENTITY (`PropDef.mapsTo === prop`, the majority of the catalog, verified
   * against `catalog/default/factories.ts`'s `accessorFactory` rows) — a fresh, never-yet-written pristine
   * instance's property read IS the class's declared default for an identity-mapped prop (`dom/props.ts`'s
   * lazy-inited signal). A bespoke, non-identity mapping (e.g. `Button.label`) is NOT reset by this wave —
   * the `WidgetFactory` interface has no per-prop default reader, only `applyProp`; closing this fully
   * needs a new, optional catalog-level capability, out of this ticket's scope (ADR-0128 Consequences).
   *
   * The `componentDef` guard runs BEFORE the pristine `create()` call (M1 review fix) — `next.component`
   * being unresolved (an unknown type, the placeholder path) must not re-resolve the factory a SECOND time
   * from a reconcile path: `create()` would re-emit `CATALOG` (a reconcile emitting anything at all
   * violates SPEC-N3) purely to mint a throwaway element nothing downstream could use anyway (no
   * `componentDef` means every `droppedKeys` entry fails the identity-mapped check below regardless).
   */
  #resetOmittedProps(previous: A2uiComponent, next: A2uiComponent, el: HTMLElement): void {
    const STRUCTURAL = new Set(['id', 'component', 'child', 'children', 'checks']) // widget.ts's REAL reserved set
    const droppedKeys = Object.keys(previous).filter((k) => !STRUCTURAL.has(k) && !(k in next))
    if (droppedKeys.length === 0) return
    const componentDef = this.#deps.componentDefOf(next, this.#surface)
    if (componentDef === undefined) return // unresolved factory — never re-emit CATALOG from a reconcile (SPEC-N3)
    const pristine = this.#deps.create(next, this.#surface) // never connected, never appended — GC'd on return
    for (const key of droppedKeys) {
      if (componentDef.properties[key]?.mapsTo !== key) continue // non-identity (bespoke) mapping: not reset
      this.#deps.resetProp(el, next, this.#surface, key, (pristine as unknown as Record<string, unknown>)[key])
    }
  }
}

/**
 * A `children` that is the v1.0 dynamic-list TEMPLATE form (`{path, componentId}`) rather than a static
 * `string[]` (renderer LLD-C6). Unambiguous: the static form is an array, the template is an object with
 * both string keys — so this never misreads a `string[]` as a template (or vice versa).
 */
function isChildTemplate(children: A2uiComponent['children']): children is A2uiChildTemplate {
  return (
    typeof children === 'object' &&
    children !== null &&
    !Array.isArray(children) &&
    typeof children.path === 'string' &&
    typeof children.componentId === 'string'
  )
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

// ── structural-resend diff helpers (RSR-C4, SPEC-R1/R3) ─────────────────────────────────────────────

/** Exact-order child-ref equality — a byte-identical array is a no-op (SPEC-R1 AC3); any add, remove, OR
 *  pure reorder (SPEC-R5 — reorder alone is deliberately NOT realized, but it still routes into
 *  `#reconcileChildren`, whose survivor-only-if-present-in-both-sets logic is a correct no-op for it). */
function sameOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

/**
 * Structural (not reference) equality over a resent record's non-structural props (RSR-C4, SPEC-R3). A
 * freshly `JSON.parse`'d message re-delivers every object-valued prop — a `{path}` binding, a `{call}`,
 * an action object — as a NEW reference even when semantically unchanged; a reference-only compare
 * (`Object.is`) would defeat SPEC-R3's no-op guarantee for any node carrying one.
 */
function samePropsDeep(a: A2uiComponent, b: A2uiComponent): boolean {
  const structural = new Set(['id', 'component', 'child', 'children'])
  const ak = Object.keys(a).filter((k) => !structural.has(k))
  const bk = Object.keys(b).filter((k) => !structural.has(k))
  if (ak.length !== bk.length) return false
  return ak.every((k) => k in b && deepEqualJson(a[k], b[k]))
}

/**
 * A standard JSON-shaped structural equal (primitive `===`, array element-wise, object key-wise) — safe
 * because a buffered `A2uiComponent` is pure `JSON.parse` output: no cycles, no functions, no `Date`/
 * `Map`/`Set`, just plain objects/arrays/primitives.
 */
function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => deepEqualJson(v, b[i]))
  }
  const ak = Object.keys(a as Record<string, unknown>)
  const bk = Object.keys(b as Record<string, unknown>)
  if (ak.length !== bk.length) return false
  return ak.every((k) => k in (b as Record<string, unknown>) && deepEqualJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
