# LLD — Renderer structural-resend reconciliation

> Status: proposed · v0.2 · 2026-07-12 · Layer: LLD (implementation plan)
> Implements: [`../spec/renderer-structural-resend.spec.md`](../spec/renderer-structural-resend.spec.md)
> (SPEC-R1…R5, SPEC-N1…N3).
> Composes on: [`./a2ui-renderer.lld.md`](./a2ui-renderer.lld.md) LLD-C4 (`tree.ts`, SPEC-R3/R4), LLD-C6
> (`list.ts`, the per-item `(scope, ac)` pair this generalizes), LLD-C7 (`widget.ts`, the create/wire split this
> amends), LLD-C13 (`renderer.ts`, the action/checks wiring this reaches into). **This LLD's own components are
> numbered `RSR-C#`, deliberately NOT `LLD-C#`, to avoid colliding with the runtime LLD's own C4/C6/C7/C13 —
> the two documents are cited side by side throughout, and reusing the same numbers for different things in the
> same paragraph is a real ambiguity, caught at doc review.**
> Altitude: the **how** on `@agent-ui/components`' signals kernel; cites `SPEC-R*`/`SPEC-N*` for behavior, never
> re-derives it. No change to `binding.ts`, `functions.ts`, `input.ts`'s writeback math, or `protocol.ts`.

---

## 1. Component map (traceability)

| ID | Component | Implements | File |
|---|---|---|---|
| **RSR-C1** | Per-node scope registry + surface-teardown carrier | SPEC-N1, N2 | `tree.ts` (new `#nodeScopes: Map<string, {scope: Scope; ac: AbortController}>` + a teardown-carrier effect) |
| **RSR-C2** | Create/wire split (widget factory) | SPEC-R2 | `widget.ts` (extract `wireProps` from `makeCreateWidget`'s closure; the unknown-type placeholder path is explicit) |
| **RSR-C3** | Host-level wire split (action + checks) | SPEC-R2, N3 | `renderer.ts` (extract `#wireNode` alongside `#makeHostCreateWidget`) |
| **RSR-C4** | Resend detection + record diff (structural comparison) | SPEC-R1, R2, R3 | `tree.ts` (`apply()` gains a pre-overwrite snapshot + a deep, not reference, diff) |
| **RSR-C5** | Children id-diff reconcile | SPEC-R1, R5 | `tree.ts` (new `#reconcileChildren`) |
| **RSR-C6** | Prop reconcile (rewire onto existing `el`, narrowed omitted-prop reset) | SPEC-R2 | `tree.ts` (new `#reconcileProps`, calls RSR-C2/C3's wire helper) |
| **RSR-C7** | Recursive subtree teardown (incl. `#pendingParents` purge) | SPEC-N1 | `tree.ts` (new `#disposeSubtree`) |

**Kernel reuse (SPEC-N2 unaffected).** All reactivity stays `@agent-ui/components`' `signal`/`computed`/
`effect`/`createScope`/`inspect` — no new primitive. The per-node scope is the **same** `createScope()` the
list already uses per item (runtime LLD-C6); this work only widens WHO gets one — every static-tree node, not
only list items.

## 2. Why a create/wire split is the crux (RSR-C2/C3)

Reconciling props onto a resent id (SPEC-R2) must NEVER call `factory.create()` again — that would mint a new
element and defeat the whole point (identity/focus/state preservation). But today, `widget.ts`'s
`makeCreateWidget` closure does, in one breath: resolve the factory → `factory.create()` → apply every prop
(static once, or a scope-owned reactive effect) → `installInputBinding`. `renderer.ts`'s host wrapper
(`#makeHostCreateWidget`) layers **on top of that**: strip action props → call the base → `#wireAction` →
`wireChecks`. Neither module currently has a way to re-run "apply props + wire input + wire action + wire
checks" against an **already-existing** element.

**The fix is an extract-function refactor, with ONE real branch to preserve: the unknown-type placeholder.**
`widget.ts:110-120` returns a placeholder element (an inert `<a2ui-placeholder>`) BEFORE the prop loop runs, on
an unresolved `factory`. A naive `create()`/`wireProps()` split must not run `wireProps` against a placeholder
as if it had a real factory — `wireProps` re-resolves the factory/`componentDef` itself (today they are shared
closure locals across the single call; after the split each function does its own lookup), and when that
lookup comes back `undefined` (unknown type, or a catalog that vanished after `createSurface`'s guard),
`wireProps` is a documented no-op — it does not re-emit `CATALOG` a second time (`create()` already did, per
today's single-emit behavior) and does not attempt to apply props to an element with no factory:

```ts
// widget.ts
export function create(node: A2uiComponent, surface: Surface, deps: WidgetDeps): HTMLElement {
  const entry = deps.registry.get(surface.catalogId)
  const factory = entry?.factories[node.component]
  if (factory === undefined) {
    deps.emitError({ code: 'CATALOG', surfaceId: surface.id, path: node.id, message: `unknown component type "${node.component}" in catalog "${surface.catalogId}"` })
    return placeholder(node)                     // UNCHANGED — today's exact placeholder path
  }
  return factory.create()
}

export function wireProps(el: HTMLElement, node: A2uiComponent, surface: Surface, scope: Scope, itemScope: ItemScope | undefined, ac: AbortController, deps: WidgetDeps): void {
  const entry = deps.registry.get(surface.catalogId)
  const factory = entry?.factories[node.component]
  if (factory === undefined) return               // NEW, explicit: a placeholder element gets no props/input wiring
  const componentDef = entry?.catalog?.components?.[node.component]
  for (const [prop, value] of Object.entries(node)) { /* UNCHANGED prop loop, now reading factory/componentDef locally */ }
  installInputBinding(el, factory, node, surface, itemScope, ac)
}

export function makeCreateWidget(deps: WidgetDeps): CreateWidget {
  return (node, surface, scope = surface.scope, itemScope, ac = surface.ac) => {
    const el = create(node, surface, deps)
    wireProps(el, node, surface, scope, itemScope, ac, deps)
    return el
  }
}
```

This composition is **byte-for-byte** for `factory !== undefined` (every existing test path); the placeholder
branch is now an explicit two-line no-op in `wireProps` rather than an early `return placeholder(node)` that
skipped the prop loop implicitly — same observable behavior, a named branch instead of an implicit one.

- `renderer.ts`: `#makeHostCreateWidget`'s closure similarly splits into `#create` (calls `widget.ts`'s
  `create`) and `#wireNode(el, node, surface, scope, itemScope, ac)` (calls `widget.ts`'s `wireProps` with the
  action props excluded, then `#wireAction` + `wireChecks` — both already guard gracefully on a placeholder
  element, since `#actionPropsOf`/`wireChecks` read `node`/`surface`, not `el`'s factory). The public
  `#createWidget` composes `#create` + `#wireNode`, unchanged for every existing call site (`tree.ts`'s
  `#mountNode`/`#mountInstance`, `list.ts`'s `appendInstance`).

**Reconcile calls `#wireNode` directly, never `#create`.** This is the ONE new integration point `tree.ts`
needs from the host: a `rewireNode(el, node, surface, scope, itemScope, ac): void` entry (the renamed, exported
`#wireNode`) that applies a node's complete prop/action/checks wiring onto an element that already exists.

```ts
// tree.ts's TreeDeps (runtime LLD-C4) gains four collaborators:
export interface TreeDeps {
  createWidget: CreateWidget                 // unchanged — mint + wire a NEW element
  create: CreateOnly                         // NEW — mint only (no wiring); reused by RSR-C6's pristine-default lookup
  rewireNode: RewireNode                     // NEW — wire props/action/checks onto an EXISTING element
  resetProp: ResetProp                       // NEW — resolve the node's factory and call its applyProp (§7's narrowed reset)
  onError: (error: A2uiError) => void
}
export type CreateOnly = (node: A2uiComponent, surface: Surface) => HTMLElement
export type RewireNode = (el: HTMLElement, node: A2uiComponent, surface: Surface, scope: Scope, itemScope: ItemScope | undefined, ac: AbortController) => void
// resetProp needs node+surface (not just el/prop/value) because applyProp is resolved PER FACTORY
// (registry.get(surface.catalogId)?.factories[node.component]?.applyProp) — it is not a bare function.
export type ResetProp = (el: HTMLElement, node: A2uiComponent, surface: Surface, prop: string, value: unknown) => void
```

## 3. Per-node scope registry + surface-teardown carrier (RSR-C1)

`SurfaceTree` gains a map parallel to `surface.widgets`, keyed by the same static-tree ids (never list-item
instance ids, which are untracked exactly as today):

```ts
readonly #nodeScopes = new Map<string, { scope: Scope; ac: AbortController }>()
```

**Populated at mount, not before.** `#mountNode(id)` — the ordinary first-mount path — creates the node's own
`createScope()` (nested under, but NOT auto-disposed by, `surface.scope` — kernel scopes are flat, per the
list's own documented constraint) and a fresh `AbortController`, stores the pair in `#nodeScopes`, and threads
**this node's own scope/ac** (not `surface.scope`/`surface.ac`) into `wireProps`/`#wireNode` for THIS node's own
props, and into `#mountChildrenInto` as the `scope`/`ac` a nested dynamic list (runtime LLD-C6) would adopt as
its `parentScope`. This is the generalization: today `#mountNode` always passes `this.#surface.scope`/`
this.#surface.ac` for the static tree; after this LLD every static node gets its own pair, mirroring what list
items already receive per instance.

**Surface-teardown carrier (closes a leak the first draft of this LLD missed).** A per-node scope that nothing
ever disposes on WHOLE-SURFACE teardown is a leak — `deleteSurface`/`dispose()` today only call
`surface.scope.dispose()` (via `disposeSurface`, `surface.ts`), which does NOT reach a flat, independently
created `createScope()` unless something explicitly disposes it. `list.ts` solves the identical problem with a
teardown-carrier `effect` (an effect that subscribes to nothing, so its cleanup fires ONLY when its owning
scope disposes, never on a reconcile re-run) — `SurfaceTree` needs the exact same carrier, once, for
`#nodeScopes`:

```ts
// installed once, at SurfaceTree construction, inside surface.scope:
this.#surface.scope.run(() =>
  effect(() => () => {                          // no reactive read ⇒ cleanup fires ONLY on surface.scope.dispose()
    for (const { scope, ac } of this.#nodeScopes.values()) { scope.dispose(); ac.abort() }
    this.#nodeScopes.clear()
  }),
)
```

This guarantees `deleteSurface`/renderer `dispose()` still leave zero live signals/listeners (SPEC-N3 of the
runtime SPEC, unaffected) even though every static node now owns its own scope — mirroring `list.ts`'s own
teardown-carrier discipline one level up, at the surface itself.

**Root exception (SPEC-R4).** `"root"` still gets a node scope (for symmetry — a node scope is cheap and
`root` may itself have bound props), but SPEC-R1/R2 reconciliation never runs against it — the existing
`#rootDelivered`/IDGRAPH guard already forecloses a second `root` delivery before reconciliation would ever be
consulted.

## 4. Resend detection + structural diff (RSR-C4)

`apply()` (`tree.ts`) is amended to capture the **previous** record before the upsert overwrites it, and to
route an already-mounted id's resend into reconciliation instead of the silent no-op it is today:

```ts
apply(message: UpdateComponentsMessage): void {
  const delivered: string[] = []
  const resent = new Map<string, A2uiComponent>()          // id -> its PREVIOUS record, only for already-mounted ids
  for (const comp of message.updateComponents.components) {
    if (comp.id === 'root' && this.#rootDelivered) { this.#idgraph(...); continue }
    if (comp.id === 'root') this.#rootDelivered = true
    const previous = this.#surface.components.get(comp.id)
    if (previous !== undefined && this.#surface.widgets.has(comp.id)) resent.set(comp.id, previous)
    this.#surface.components.set(comp.id, comp)              // buffer (upsert) by id — UNCHANGED (message-lifecycle SPEC-R2)
    delivered.push(comp.id)
  }
  // ...unchanged cycle guard, render-on-root branch...

  // Root already up: existing pendingParents patch-in (UNCHANGED, SPEC-R4 AC1) — first-arrival case.
  for (const id of delivered) if (this.#pendingParents.has(id)) this.#patchPending(id)

  // NEW: reconcile every RESENT already-mounted id against its previous record (SPEC-R1/R2/R3).
  for (const [id, previous] of resent) this.#reconcileNode(id, previous, this.#surface.components.get(id)!)
}
```

`#reconcileNode(id, previous, next)` is the dispatcher: it computes both diffs (children, props) against the
SAME `previous`/`next` pair and gates each independently — a resend touching only `children` runs SPEC-R1's
child diff and skips SPEC-R2's prop rewire, and vice versa.

```ts
#reconcileNode(id: string, previous: A2uiComponent, next: A2uiComponent): void {
  if (id === 'root') return                                  // SPEC-R4 — never reconciled
  const oldRefs = childRefs(previous)
  const newRefs = childRefs(next)
  if (!sameOrder(oldRefs, newRefs)) this.#reconcileChildren(id, oldRefs, newRefs)         // SPEC-R1
  if (!samePropsDeep(previous, next)) this.#reconcileProps(id, previous, next)            // SPEC-R2
}
```

**`samePropsDeep`, not a shallow `Object.is` compare (a real bug the first draft had).** Server messages arrive
as freshly `JSON.parse`'d objects, so an OBJECT-valued prop — a `{path}` binding, a `{call}` FunctionCall, an
action object, a `context` map — is a **new reference every single delivery**, identical or not. `Object.is`
between the previous and next record's SAME semantic binding would therefore report "changed" on every resend,
defeating SPEC-R3's no-op guarantee for the overwhelmingly common case of a node carrying any object-valued
prop. `samePropsDeep` is a small recursive structural-equality helper over the props (excluding
`id`/`component`/`child`/`children`) — safe because a buffered `A2uiComponent` is pure `JSON.parse` output: no
cycles, no functions, no `Date`/`Map`/`Set`, just plain objects/arrays/primitives:

```ts
function samePropsDeep(a: A2uiComponent, b: A2uiComponent): boolean {
  const structural = new Set(['id', 'component', 'child', 'children'])
  const ak = Object.keys(a).filter((k) => !structural.has(k))
  const bk = Object.keys(b).filter((k) => !structural.has(k))
  if (ak.length !== bk.length) return false
  return ak.every((k) => k in b && deepEqualJson(a[k], b[k]))
}
```

`deepEqualJson` is a standard JSON-shaped structural equal (primitive `===`, array element-wise, object
key-wise) — a small, new, pure utility local to `tree.ts` (no kernel dependency, no existing helper reused,
since nothing in the renderer currently needed one).

## 5. Children id-diff reconcile (RSR-C5)

```ts
#reconcileChildren(id: string, oldRefs: string[], newRefs: string[]): void {
  const el = this.#surface.widgets.get(id)!                  // guaranteed present — this id is a resend of a mounted node
  const oldSet = new Set(oldRefs)
  const newSet = new Set(newRefs)
  for (const removedId of oldRefs) if (!newSet.has(removedId)) this.#disposeSubtree(removedId)   // SPEC-R1 AC2, SPEC-N1
  // Insertion pass: walk the NEW order; a survivor is left in place (SPEC-R5 — no reorder), a new id mounts
  // and inserts immediately before the next EXISTING (survivor or already-inserted) sibling in the new order.
  let anchor: Node | null = null   // insertBefore(x, null) === appendChild; walk newRefs in REVERSE so `anchor`
  for (let i = newRefs.length - 1; i >= 0; i--) {             // always names the correct "insert before" target
    const childId = newRefs[i]!
    if (oldSet.has(childId)) { anchor = this.#surface.widgets.get(childId) ?? anchor; continue }  // survivor: SPEC-R5, untouched
    const node = this.#mountNode(childId)                     // fresh mount — SPEC-R1 AC1, ordinary #mountNode path
    el.insertBefore(node, anchor)                              // safe: `node` was never previously connected
    anchor = node
  }
}
```

Walking `newRefs` in reverse and tracking `anchor` as "the next already-positioned sibling" gives correct
insertion order in one pass without a DOM query per insert. A survivor's element is looked up once (to serve as
a future anchor) and never moved, appended, or re-created — satisfying SPEC-R5 by construction (the loop
literally never calls `insertBefore`/`appendChild` on a survivor's node).

**Non-goal, explicit: a resent container whose `children` is a dynamic-list TEMPLATE (`{path, componentId}`,
runtime LLD-C6), not a static array.** `childRefs()` returns `[]` for a template (it only reads the static
`string[]`/`child` shape), so `sameOrder([], [])` is trivially true for a template-to-template resend even if
the TEMPLATE ITSELF changed (a different `componentId`/`path`). This reconcile does not cover that case —
consistent with the SPEC's non-goal fencing list-item internals, but distinct enough to name explicitly here
since it is the CONTAINER's own record, not a descendant's. Flagged, not solved, by this LLD.

## 6. Recursive subtree disposal (RSR-C7)

```ts
#disposeSubtree(id: string): void {
  const node = this.#surface.components.get(id)
  const el = this.#surface.widgets.get(id)
  if (node !== undefined) {
    for (const childId of childRefs(node)) {
      if (this.#surface.widgets.has(childId)) { this.#disposeSubtree(childId); continue }  // a mounted descendant: recurse
      // childId never arrived — this subtree may be holding one of its pendingParents anchors.
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
  pair?.scope.dispose()          // kills this node's bound-prop effects AND, if a dynamic list (runtime LLD-C6)
  pair?.ac.abort()               // is rooted here, its teardown-carrier effect — cascades the list's own items
  this.#nodeScopes.delete(id)
  el?.remove()
  this.#surface.widgets.delete(id)
  this.#surface.components.delete(id)   // a later re-add of this SAME id is indistinguishable from a first arrival
}
```

**Why the `#pendingParents` purge is load-bearing (a real, pre-existing leak this LLD must not inherit).**
`#patchPending(id)` calls `this.#mountNode(id)` UNCONDITIONALLY for every anchor still on record for `id` —
including an anchor that lived inside a subtree ALREADY REMOVED, if nothing ever purged it. `#mountNode` mints
a real widget (and, after RSR-C1, a node scope) and registers it in `surface.widgets`/`#nodeScopes` regardless
of whether `anchor.parentNode` turns out to be `null` (detached) at the `replaceChild` step — so an unpurged
anchor produces a genuinely orphaned widget + node scope that nothing will ever dispose (unreachable from any
live ancestor, so never revisited by a later `#disposeSubtree` either). Filtering `#pendingParents`'s array by
`el.contains(a)` at removal time closes this before RSR-C1's node scopes make the leak's cost (an abandoned
scope, not just an abandoned `HTMLElement`) worse than it already implicitly was.

Depth-first, children-before-parent, matches `list.ts`'s own teardown-carrier discipline (dispose owned scopes
before detaching the DOM ancestor) and satisfies SPEC-N1 AC1: a dynamic list rooted anywhere under a removed
static node has its `parentScope` (this node's own scope, per §3) disposed, which — per the list's existing
teardown-carrier `effect` cleanup — disposes every live item's `(scope, ac)` pair in turn. No new cross-module
wiring: this LLD only ensures a nested list's `parentScope` is a disposable **node** scope instead of always
being `surface.scope`, which §3 already arranges.

**Deleting `surface.components.delete(id)`** is the one small addition beyond "just the DOM": without it, a
removed-then-later-re-added id would find a stale buffered record sitting in the map from before the removal,
confusing the resend-diff in §4 (which reads `surface.components.get(id)` as "previous"). Deleting it makes a
re-add behave exactly like a first-ever arrival — no special case needed anywhere else.

## 7. Prop reconcile (RSR-C6)

```ts
#reconcileProps(id: string, previous: A2uiComponent, next: A2uiComponent): void {
  const el = this.#surface.widgets.get(id)!
  const old = this.#nodeScopes.get(id)!
  old.scope.dispose()             // kills every bound-prop effect AND the input/action/checks listeners this
  old.ac.abort()                  // node installed — same one-two as #disposeSubtree, but the ELEMENT survives

  this.#resetOmittedProps(id, previous, next, el)   // SPEC-R2 AC3 — see below; narrowed, honest scope

  const scope = createScope()
  const ac = new AbortController()
  this.#nodeScopes.set(id, { scope, ac })
  this.#deps.rewireNode(el, next, this.#surface, scope, undefined, ac)   // re-applies the FULL new record (SPEC-R2)
}
```

**Omitted-prop reset — narrowed to identity-mapped props, an honest limitation for non-identity ones (the
first draft's biggest wrong assumption, now corrected).** Disposing the old scope stops an effect from
RE-RUNNING; it does NOT undo whatever value that effect (or a one-time `applyProp`) already wrote to `el`.
`rewireNode` only visits keys present in `next` — a key dropped between `previous` and `next` is otherwise
never revisited and its stale value sticks. The catalog's `WidgetFactory` (`catalog/types.ts`) exposes only
`create()` + `applyProp(el, prop, value)` — no reader, no per-prop default registry.

**Verified against the real factories (`catalog/default/factories.ts`):** `accessorFactory` (the majority of
the catalog — every container, `Field`/`FormProvider`/`Select`, `TextField`, `Icon`, `Menu`/`Popover`/
`Tooltip`, `Slider`/`Calendar`/`ComboBox`, the chart/report/content/feed/token-surface families) has `applyProp
= setProp`, an IDENTITY property write (`el[prop] = value`, same name as the catalog prop — the factory's own
documented invariant: "a property whose `mapsTo` differs from its name needs a bespoke factory"). For an
identity-mapped prop, `@agent-ui/components`' reactive-prop accessor (`dom/props.ts:168`, `sig = signal
(config.default) // lazy init to the declared default`) means a FRESH, never-yet-written element's property
getter genuinely returns the class's declared default — so reading it off a throwaway pristine instance is
correct, not a guess:

```ts
#resetOmittedProps(id: string, previous: A2uiComponent, next: A2uiComponent, el: HTMLElement): void {
  const STRUCTURAL = new Set(['id', 'component', 'child', 'children', 'checks'])  // widget.ts's REAL RESERVED set
  const droppedKeys = Object.keys(previous).filter((k) => !STRUCTURAL.has(k) && !(k in next))
  if (droppedKeys.length === 0) return
  const componentDef = this.#deps.componentDefOf(next, this.#surface)   // registry.get(catalogId)?.catalog?.components?.[next.component]
  const pristine = this.#deps.create(next, this.#surface)               // never connected, never appended, GC'd on return
  for (const key of droppedKeys) {
    if (componentDef?.properties[key]?.mapsTo !== key) continue  // NON-identity (bespoke) mapping: narrowed scope, see below
    this.#deps.resetProp(el, next, this.#surface, key, (pristine as unknown as Record<string, unknown>)[key])
  }
}
```

**`checks` joins the structural exclusion (the first draft's set was wrong — 4 keys, not widget.ts's real 5).**
`checks` is a component-level array `wireChecks` reads directly off the node (never `applyProp`'d, per
`widget.ts`'s own `RESERVED = new Set([..., 'checks'])`) — treating it as an ordinary droppable prop would
attempt `applyProp(el, 'checks', …)`, which no factory implements meaningfully. An **action-mapped** prop
(`PropDef.mapsTo === 'action'`) is likewise never in `wireProps`' base loop (host-stripped by `renderer.ts`'s
`#actionPropsOf` before the base resolver runs) — `componentDef?.properties[key]?.mapsTo !== key` already
excludes it for a different, sufficient reason (an action-mapped key's `mapsTo` is the literal string
`'action'`, never equal to the key itself unless a prop happens to be literally named `action` AND
identity-mapped, which no shipped row does).

**The narrowed scope, honestly stated:** a DROPPED prop whose catalog mapping is non-identity (a bespoke
factory — e.g. `Button.label`, `Checkbox`/`Switch`/`Radio`'s non-identity `label`, `MenuItem`'s `data-value`
attribute) is NOT reset by this mechanism — its last-applied value lingers on the element. This is a real,
narrower gap than SPEC-R2 AC3's literal text implies for the FULL catalog, though it covers the large majority
of rows (every `accessorFactory`-based type). Closing it fully would need a new, optional `WidgetFactory`
capability (e.g. a per-factory `resetProp?: (el, prop) => void` a bespoke factory could implement), which is a
CATALOG-package API addition, not a pure renderer-internal change — out of this ticket's scope, named here as
a follow-up rather than silently left unfenced. **Recorded as a discovered-reality narrowing of SPEC-R2 AC3,
not a silent gap** — the SPEC's AC3 should be read as "for every identity-mapped prop" until that follow-up
lands (a build-time SPEC wording tightening, alongside the ADR-0128 `Repairs` note).

`el` itself is never touched by `.remove()`/`.replaceChild()` — only its prop effects and listeners are torn
down and reinstalled against the SAME element, which is what preserves DOM identity, focus, and any
component-internal state (SPEC-R2 AC1). `itemScope` is always `undefined` here: prop reconcile only ever
targets a **static-tree** node (list-item descendants are explicitly out of scope, per the SPEC's non-goals),
and the static tree carries no `itemScope`.

**Cost.** One throwaway `factory.create()` call per prop-reconcile that actually drops a key (never on the
common case of a resend that only ADDS/CHANGES props) — cheap (an unconnected custom element, never painted,
eligible for GC the instant this call returns) and bounded (never recurses, never touches children).

**Interaction with SPEC-R1.** When a node's `children` field ALSO changed in the same resend, `#reconcileNode`
(§4) runs `#reconcileChildren` first, then `#reconcileProps` — order doesn't matter for correctness (they touch
disjoint concerns: DOM child list vs. this node's OWN prop effects) but running children first means any
newly-mounted child is already in place before the parent's own props (if also changed) re-wire, avoiding a
transient inconsistent read.

## 8. Error & edge-case additions (extends runtime LLD §9)

| Case | Handling |
|---|---|
| Resend of `"root"` | No reconciliation (SPEC-R4); existing IDGRAPH guard on a literal 2nd delivery is unaffected |
| Resend with no actual delta | `samePropsDeep`/`sameOrder` both true → `#reconcileNode` is a no-op (SPEC-R3) |
| Resend removing a child that itself hosts a dynamic list | `#disposeSubtree` recurses into the list's own template-driven items via the shared `parentScope` teardown-carrier (SPEC-N1 AC1) |
| Resend removing a child that itself was waiting on a not-yet-arrived grandchild | `#disposeSubtree` purges the corresponding `#pendingParents` anchor (§6) — no orphaned mint on a later, unrelated delivery |
| Resend adding a child whose own record has not yet arrived (out-of-order, within the SAME structural-resend wave) | The normal `#mountNode` pending-anchor path handles it — `#reconcileChildren`'s "fresh mount" branch calls `#mountNode`, unchanged (SPEC-R4 of the runtime SPEC, untouched) |
| Resend of a node inside a list-item's instance subtree | Never reaches `#reconcileNode` — list-item ids are not registered in `surface.widgets`/`#nodeScopes` (unchanged design boundary, `#mountInstance`) |
| Resend of a container whose `children` is a dynamic-list TEMPLATE object, not a static array | Not reconciled (§5 non-goal) — `childRefs` returns `[]` for a template either way |
| Dropped prop with a non-identity (`mapsTo !== prop`) catalog mapping | Not reset (§7 narrowed scope) — a follow-up `WidgetFactory.resetProp?` capability is the closing mechanism, out of this ticket |
| Whole-surface teardown (`deleteSurface`/`dispose()`) | The RSR-C1 teardown carrier disposes every remaining `#nodeScopes` entry — SPEC-N3 (runtime) holds unchanged |

## 9. File & integration plan

```
packages/agent-ui/a2ui/src/renderer/
  tree.ts     — #nodeScopes + teardown carrier, apply()'s resent-map, #reconcileNode/#reconcileChildren/
                #reconcileProps/#resetOmittedProps/#disposeSubtree, samePropsDeep/deepEqualJson
  widget.ts   — makeCreateWidget split into create() + wireProps() (createWidget composes both); the
                unknown-type placeholder branch made explicit in both halves
  renderer.ts — #makeHostCreateWidget split into #create() + #wireNode() (#createWidget composes both);
                #wireNode exported to TreeDeps as rewireNode; #create exported as create; resetProp added
                (resolves the node's factory, calls its applyProp)
  types.ts    — TreeDeps gains create/rewireNode/resetProp/componentDefOf (new exported CreateOnly/RewireNode/
                ResetProp types)
```

No changes to `binding.ts`, `functions.ts`, `input.ts`, `list.ts`, `protocol.ts`, `dispatch.ts`, or
`validate.ts`.

## 10. Build sequence (dependency-ordered; each step verifiable)

1. **Create/wire split (RSR-C2/C3)** — refactor `widget.ts` + `renderer.ts` with ZERO behavior change first,
   including the explicit placeholder-branch handling (§2); gate: every existing renderer test stays green
   byte-for-byte (a pure refactor checkpoint before any new behavior lands).
2. **Per-node scope registry + teardown carrier (RSR-C1)** — thread a node scope through `#mountNode`/
   `#mountChildrenInto` for the static tree AND install the surface-teardown carrier in the SAME step (not a
   later one — a step that creates scopes without also wiring their disposal is not actually gate-passable);
   gate: existing mount/teardown tests unaffected, AND a NEW test proves `deleteSurface` disposes every static
   node's scope via `inspect()` (closing the leak the first design draft missed).
3. **Resend detection + structural diff (RSR-C4)** — the `apply()` amendment + `#reconcileNode`'s dispatch +
   `sameOrder`/`samePropsDeep`; gate: a resend with no delta is proven inert INCLUDING when the unchanged props
   are object-valued (a `{path}` binding re-delivered as a structurally-identical but reference-distinct
   object) — the case the first draft's `Object.is` gate would have failed.
4. **Children reconcile + subtree disposal (RSR-C5/C7)** — the ticket's own repro becomes the first green test
   (SPEC-R1 AC1/AC2); gate: `inspect()` proves a removed subtree's node scope(s) are gone (SPEC-N1), AND a
   removed subtree that was itself waiting on an undelivered grandchild leaves no orphaned mint on a later,
   unrelated delivery of that grandchild id (the `#pendingParents` purge, §6).
5. **Prop reconcile (RSR-C6)** — SPEC-R2's rewire-onto-existing-element path, including the narrowed
   identity-mapped omitted-prop reset (§7); gate: focus survives a sibling-only reconcile, a prop-only resend
   re-applies without touching children (SPEC-R2 AC1/AC2), and an omitted IDENTITY-mapped prop resets to its
   factory-declared default (AC3, narrowed scope stated explicitly in the test name).
6. **Consumer upgrades** (build slices, dispatched after the renderer core is green):
   - `round-trip.test.ts` (a2ui-live) — add a present-**after-turn-3**, before-turn-5 assertion (the DOM
     contains the new "status"/"READY" content once turn 3 lands, not only "gone after turn 5") — closes the
     "rendered-then-removed vs never-rendered" blind spot the ticket names and the original review flagged.
   - `a2ui-chat` LLD/tests — the turn 3/4 assertions named at `a2ui-chat.lld.md:153-157` upgrade from
     routing-only (message-kind classification) to visible-restructure (assert the DOM literally reflects the
     new content).
   - `examples/message-lifecycle.ts` (the kpi-panel-shaped corpus seed) — its fixture-validation test gains an
     assertion that replaying the seed's restructure step through a real `createRenderer` actually renders the
     added node, not only that it validates.
   - Regression floor: full `a2ui` suite + both demo pages' suites + the catalog conformance set green
     (TKT-0024 acceptance).

## 11. Test plan

- **The ticket's own repro, permanent** (`tree.test.ts`): mount `root→group→msg("hello")`; resend `group` with
  `children:["msg","status"]` + a new `status` Text("READY-MARKER") node; assert `status`'s textContent
  renders and `msg`'s element reference is unchanged (`===`) before/after.
- **Focus survival** (jsdom + a real-browser leg, Chromium+WebKit — jsdom is a known blind spot for
  focus/internals-heavy assertions per this repo's own prior findings): focus a surviving sibling's interactive
  control, resend the parent adding an unrelated new sibling, assert `document.activeElement` is unchanged.
- **Order**: a resend inserting a new id in the MIDDLE of an existing children array lands at the correct DOM
  position relative to untouched survivors (not merely appended).
- **Leak-free removal** (SPEC-N1 AC1): remove a container hosting a live dynamic list with N items; `inspect()`
  shows zero residual subscribers for the list's own item scopes and the container's own scope; a removed
  subtree that held a pending anchor for an undelivered grandchild leaves `#pendingParents` clean for it (a
  later delivery of that id mints nothing).
- **Whole-surface teardown, no per-node leak** (RSR-C1's carrier): after several structural resends (so
  multiple static nodes carry their own scopes), `deleteSurface`/`dispose()` leaves `inspect()` at zero for
  every node, not only the surface's own top-level scope.
- **Deep, not reference, no-op detection** (SPEC-R3, RSR-C4): a resend that re-delivers the SAME `{path}`
  binding as a structurally-identical but reference-distinct object disposes nothing (the prior naive
  `Object.is` design would have failed this exact case).
- **Prop-only resend, no child change**: a static IDENTITY-mapped literal prop change and a `{path}`
  rebind-target change both land on the SAME element (SPEC-R2 AC1/AC2); an omitted identity-mapped prop resets
  to the factory's pristine default (AC3, narrowed scope); an omitted NON-identity-mapped (bespoke-factory)
  prop is asserted to KEEP LINGERING (the documented, narrower limitation, proven rather than assumed).
- **No-op resend** (SPEC-R3): a byte-identical resend of an already-mounted id disposes nothing (assert the
  node scope's `Scope` object reference is unchanged — no dispose/recreate cycle fired).
- **Root carve-out** (SPEC-R4): resending `"root"` still emits `IDGRAPH` and reconciliation never runs against
  it (existing test extended, not replaced).
- **Cross-engine**: the focus-survival leg specifically runs under `test:browser` (Chromium + WebKit), per this
  repo's standing "test the whole shape" discipline for anything focus/identity-sensitive.
