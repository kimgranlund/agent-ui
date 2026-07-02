# ADR-0024 — A2UI v1.0 dynamic lists are positional (index-based, no key); `list.ts` uses a bespoke positional reconcile, not `repeat`

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-29
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(amended 2026-06-28: (1) write-side itemScope #139, (2) subtree + nested item templates, (3) per-item listener lifetime #140 — see [Amendments](#amendment--write-side-itemscope-two-way-relative-inputs-in-list-items) below)* |
> | **Date** | 2026-06-29 *(authored)* · 2026-06-28 *(amended ×3: write-side itemScope; subtree + nested; per-item listener lifetime)* |
> | **Proposed by** | planning-lead — the design seat, on the #137 v1.0-conformance grounding |
> | **Ratified by** | the **user** chose A2UI v1.0 + vehicle B2; orchestration-lead ratifies on the build gate |
> | **Repairs** | `a2ui-renderer LLD-C6 §5` (keyed→positional — already edited) · `a2ui-renderer LLD` "kernel reuse" note (`repeat`→positional loop) · **NEW** `a2ui/protocol.ts` ChildList template union · **NEW** `a2ui/renderer/list.ts` · **(amendment 1)** `a2ui-renderer LLD-C8` write-side itemScope · `a2ui/renderer/input.ts` · `a2ui/renderer/widget.ts` (input call site) · `a2ui/renderer/binding.ts` (`scopedPointer` export) · `a2ui/renderer/types.ts` (`ItemScope` no longer read-only) · **(amendment 2)** `a2ui-renderer LLD-C6` (single-root → full item subtree + nested) · `a2ui/renderer/tree.ts` (shared `#mountChildrenInto` / `#mountInstance` recursion) · `a2ui/renderer/list.ts` (renderList subtree deps) · **(amendment 3)** per-item **listener** lifetime #140 — `a2ui-renderer LLD-C3` (per-item `(scope, ac)` pair) · `LLD-C6` (item ac dispose-on-removal) · `LLD-C8` (input listener via item ac) · `LLD-C13` (action listener via item ac) · `a2ui/renderer/types.ts` (`CreateWidget` gains `ac?`) · `a2ui/renderer/renderer.ts` (`#wireAction` per-item ac) · `a2ui/renderer/input.ts` (`installInputBinding` per-item ac) · `a2ui/renderer/widget.ts` (ac threaded to input) · `a2ui/renderer/tree.ts` (ac through `#mountChildrenInto`/`#mountInstance`) · `a2ui/renderer/list.ts` (per-item `AbortController`, aborted in `removeLast`) |
> | **Supersedes / Superseded by** | Relates **ADR-0023** (the `mount()` seam — stands as general infra, not used by `list.ts` under B2) · Relates **ADR-0022** (`repeat`/`moveBefore` — stays the *keyed*-list vehicle) |

## Context

Task #137 (the A2UI dynamic-list renderer, `list.ts`) was grounded against the **A2UI v1.0** specification the user
chose to conform to (a2ui.org/specification/v1.0-a2ui/ + /concepts/data-binding/). Two discovered-reality facts
overturned the assumptions baked into the renderer LLD-C6:

1. **ChildList has a template form.** A container's `children` is **either** a static `string[]` (ComponentId
   refs) **or** a dynamic **template object** `{ path, componentId }` — `path` a JSON-Pointer to the data array,
   `componentId` the registered template component instantiated per element. `protocol.ts:36` models only
   `string[]` today.
2. **Reconciliation is POSITIONAL / array-index — there is NO per-item key.** v1.0 defines no
   keyed-reconciliation concept; "items are identified implicitly by array index, positional matching" (both the
   spec page and the data-binding concept page). Inside a template, **relative** paths (no leading `/`) resolve to
   `{path}/{index}/…`, **absolute** paths to root; `@index` is a system function returning the 0-based iteration
   index (collection scope only).

This **corrects** renderer LLD-C6 §5's "keyed by item identity" — an over-specification; v1.0 has no identity
concept (the §5 + the "kernel reuse" LLD line are edited to match). It also overturns the planning lean toward a
stable per-item key: for **v1.0 conformance the index *is* the key** (Constraint C1 — conform, don't add
un-spec'd keying).

The consequence the correction exposes: a **positional list never reorders** (index *is* position). So `repeat`'s
reason for existing — keyed, identity-preserving **moves** via `moveBefore` (ADR-0022 / #69) — is **never
exercised** by an A2UI list. The ratified LLD-C6 "reuse the `repeat` directive" was premised on the (now-false)
keyed assumption.

## Decision

We render an A2UI v1.0 dynamic list with a **bespoke positional reconcile in `list.ts`** — a kernel `effect`, not
the `repeat` directive (**vehicle B2**, user-ratified):

- A `surface.scope` `effect` reads a **length-computed** over the bound array and **grows / shrinks** the item
  instances by index: append a new instance for each new high index, dispose the trailing instance(s) when the
  array shrinks. Boundary-only — positional add/remove (SPEC-R6 AC1).
- Each item instance is `createWidget(templateNode, surface, childScope, itemScope=index)` — a **single-root**
  `ui-*` built in a **per-index child scope** (`createScope` under `surface.scope`) whose bindings resolve
  `{path}/{index}/…` (absolute, via the LLD-C5 per-path memo). A **mid-array shift re-binds reactively** (the
  `/items/{i}` computeds re-resolve — SPEC-N2), **not** by moving DOM. Removal disposes the child scope (no leak,
  SPEC-N3).
- `@index` belongs to the **LLD-C10 function evaluator** (it reads the index from the collection scope); `list.ts`
  only makes the index available via the itemScope it already needs.

**SPEC-N5 is unchanged and honored.** SPEC-N5 (`a2ui-runtime.spec.md:103`) is the **zero-third-party-dependency**
invariant — *not* "reuse `repeat`." B2 builds entirely on the `@agent-ui/components` kernel (`effect` / `computed` /
`createScope`), so it satisfies SPEC-N5 fully. The "dynamic lists reuse the `repeat` directive" clause being
relaxed lives in the **LLD** (the "kernel reuse" note + LLD-C6 §5), not in SPEC-N5 — so this is an **LLD
amendment, not a spec amendment**: a positional v1.0 list uses a kernel positional loop; `repeat` remains the
vehicle for a **keyed** list (hand-authored, stable-key, where #69's move matters).

## Build brief — for execution-lead (`list.ts` + integration; one exec seat, multi-file)

All integration points are **identical to what B1 would need** except the reconcile core (B2 = a loop, not
`repeat`/`mount`).

1. **`a2ui/protocol.ts:36`** — model the ChildList union: `children?: string[] | { path: string; componentId: string }`
   (the v1.0 template form). Conformance.
2. **`a2ui/renderer/binding.ts:114`** — implement `resolve(binding, surface, itemScope)`: a **relative** path (no
   leading `/`) → `{itemScope.path}/{itemScope.index}/{rest}`; an **absolute** path → root (current behavior). The
   per-path memo (`:82`) needs **no** itemScope key — it already distinguishes indices because it keys on the
   **resolved absolute** pointer (`/items/0/x` ≠ `/items/1/x`). itemScope just rewrites relative→absolute *before*
   `pathSignal`.
3. **`a2ui/renderer/widget.ts:104/61`** — `createWidget(node, surface, scope = surface.scope, itemScope?)`:
   `bindProp` uses the passed `scope` (the item's child scope, so its bound-prop effects dispose with the item —
   not leaked into `surface.scope`); thread `itemScope` into `resolveBinding` (`WidgetDeps.resolveBinding` gains the
   3rd arg — `binding.ts` already accepts it). Default `scope = surface.scope` keeps every existing caller intact.
4. **`a2ui/renderer/tree.ts:155/118`** — route a children-**template** (object form) node → `list.ts`; a static
   `children: string[]` keeps the current `childRefs`/`#mountNode` path. (`child?: string` stays static.)
5. **`a2ui/renderer/list.ts`** (NEW) — the B2 positional loop: the length-`effect` + per-index child scope +
   `createWidget` + dispose-on-removal, mounted under the list container. Owns the instances array + their scopes.
6. **`a2ui/renderer/index.ts`** — export the list renderer; wire it as the `createWidget`/tree collaborator.
7. **`@index`** — scope to the **LLD-C10 function evaluator** (a follow-up if C10 isn't built yet); `list.ts`
   exposes the index in the itemScope so C10 can read it.

**Tests** (jsdom + the kernel's `inspect`):
- **positional append / remove-at-end** — length delta adds/removes the **boundary** instance only.
- **mid-array insert/remove** — the existing instances **re-bind positionally** (instance `i` shows the new
  `/items/{i}` data); assert **no DOM re-create of unaffected instances** and **NO move**.
- **per-item child-scope disposal / no-leak** — removing an item disposes its child scope (`inspect()` zero
  residual subscribers); `surface.scope` does not accumulate.
- **binding resolution** — a relative path resolves to `{path}/{index}/…`, an absolute path to root.
- **`@index`** — returns the 0-based index (+ offset) *if* the LLD-C10 evaluator is in scope.
- **EXPLICITLY no focus-across-reorder-move leg** — a positional list never moves, so the v0.9-identity
  focus-preservation case does not apply here; #69's `moveBefore` stays general `repeat` infra.

Gate: `npm run check && npm test && npm run test:browser`.

## Consequences

- **`list.ts` is small and positional-native** — a length-`effect` + per-index child scopes, no key-map, no
  `moveBefore`, no `repeat`/`mount`/`watch` indirection. The per-item reactive re-bind (SPEC-N2) does the work a
  keyed reconcile would otherwise fake.
- **`#138` (the `mount()` seam + directive trio, ADR-0023) is NOT wasted by B2.** It stands as **general
  imperative-consumer infra** (ADR-0023 framed it "useful to any imperative consumer, not just `list.ts`") — a
  future **keyed** list, or any other imperative driver of a kernel directive, uses it. B2 simply does not need it
  for a *positional* list.
- **`repeat` / ADR-0022 / #69 stay in force** as the **keyed**-list vehicle (focus-preserving move). The A2UI v1.0
  list is just not a keyed list.
- **SPEC-N5 stands unchanged** (zero-dep, honored by B2). The amendment is LLD-local (the "reuse `repeat`" note →
  "positional list = kernel loop; `repeat` for keyed").
- **Stale → re-verify:** LLD-C6 §5 + the "kernel reuse" LLD note (edited); `protocol.ts` ChildList union; the new
  `list.ts` + the binding/widget/tree integration. SPEC-R6 (`a2ui-runtime.spec.md:59`) already reads
  positional-compatibly ("one instance per array element … relative paths") — no spec change.

## Alternatives considered

- **B1 — index-keyed `repeat` via `mount`/`watch`** (`mount(watch(() => repeat(range(len), i=>i, itemDir)))`) —
  **rejected**: it drives a keyed-reorder primitive in its **degenerate boundary-only mode** (the key-map +
  `moveBefore` are dead weight; index keys are always sorted 0..n), wrapped in `watch`+`range`+`mount` indirection
  to make it reactive on length. It "reuses `repeat`" literally but is a semantic mismatch for a non-reordering
  positional list. Viable and future-proof if A2UI ever adds keying — but the user chose the smaller, native B2.
- **An identity key derived in the renderer** (hash an item field, or a synthetic id) to enable keyed reconcile —
  **rejected**: A2UI v1.0 defines positional semantics with **no** identity; inventing a key is non-conformant
  (Constraint C1) and would change reorder behavior the spec does not grant.
- **Amending SPEC-N5** (as the dispatch first framed it) — **rejected as mis-scoped**: SPEC-N5 is the
  zero-third-party-dependency invariant, which B2 honors; it never said "reuse `repeat`." The relaxed clause is in
  the LLD, so the amendment is LLD-local — SPEC-N5 stays as written.

## Amendment — write-side itemScope (two-way relative inputs in list items)

> 2026-06-28 · #139 · append-only (the Decision above stands and is *completed*, not changed). Flagged by
> `exec-a2ui-list` during #137 as "out of ADR-0024's read-only scope."

**The gap.** The Decision states a list item's bindings "resolve `{path}/{index}/…`" — generically, both
directions. The #137 build delivered only the **read** half: `binding.ts:129 resolve(binding, surface,
itemScope)` rewrites a relative path to its absolute pointer via `scopedPointer` (`binding.ts:115`) before the
per-path memo, and `widget.ts:64 createWidget(node, surface, scope, itemScope)` threads `itemScope` into
`resolveBinding` (`widget.ts:113`). The **write** half — the two-way input controller (`input.ts:53
installInputBinding`, LLD-C8/ADR-0019) — was **left unscoped**: it computes the writeback pointer from the **raw**
`node[value.prop].path` (`input.ts:65`, `valuePath = bound.path`) and hands it to `setPointer` (`input.ts:72`).
So a **relative** two-way binding inside a list item **reads** from `/items/{i}/x` but **writes** to the raw
`x` — and because `setPointer` (`binding.ts:67`) assumes a leading-slash pointer and slices the first token off
(`pointer.slice(1)`), a relative `label` writes to the garbage key `abel`. Silent data-model corruption, the
moment a list item carries an interactive (two-way) input. Absolute-path two-way bindings already work (both
directions use the same absolute pointer); `widget.ts:89` already has `itemScope` in lexical scope but does not
pass it to `installInputBinding`.

**The completion (no new design choice).** Extend the **same** `itemScope` to the write direction by reusing the
**same** read-side rewrite — the write must resolve relative→absolute identically, or it is a bug; there is no
alternative to weigh, no new principle, no rejected option (this is why it is an *amendment*, not a new
`Extends`-ADR — the README's new-ADR bar is "a genuinely new decision," and this is the foreseen write-half of the
Decision's own word "bindings," not a new decision):

1. `binding.ts` — **export** the existing module-private `scopedPointer` (`binding.ts:115`). One keyword; the
   function already returns absolute paths unchanged, relative paths as `{path}/{index}/{rest}`, and — with no
   `itemScope` — the raw path (the byte-for-byte current write behavior). It becomes the single relative→absolute
   rewrite **both** directions key on (the read memo and the writeback), so read and write resolve to the **same**
   absolute pointer by construction.
2. `input.ts` — `installInputBinding` gains a trailing `itemScope?: ItemScope`; the writeback pointer is
   `scopedPointer(bound.path, itemScope)` (`input.ts:65`) instead of the raw `bound.path`. Computed once at
   install (it is a constant per instance — see below), closed over by the listener exactly as today.
3. `widget.ts:89` — pass the `itemScope` already in scope: `installInputBinding(el, factory, node, surface,
   itemScope)`. The default (omitted ⇒ `undefined` ⇒ `scopedPointer` returns the raw path) keeps **every existing
   non-list two-way input byte-for-byte unchanged**.
4. `types.ts:18` — the `ItemScope` doc no longer reads "the read-direction scope only"; it now scopes **both**
   directions. (Code-comment artifact of the gap; retired by this amendment.)

**Why the threading is trivial and correct.** `itemScope` is captured **once** at `appendInstance`
(`list.ts:75`, `{ path, index }`) and is **immutable** for the instance's lifetime — positional reconcile only
adds/removes at the **boundary**, so a surviving instance keeps its index *and* its DOM slot across any mid-array
shift (ADR-0024's core invariant: `index === position`). The writeback pointer is therefore a per-instance
constant, valid forever; no re-wiring on a shift. After a mid-array insert that re-binds the instance at position
`i` to the new `/items/{i}` datum (read side, already proven by `list.test.ts:135`), a commit on that **same**
node writes to `/items/{i}` — which now holds the shifted datum. The write follows the **slot**, exactly as the
display does. Per-path waking (SPEC-N2) is preserved unchanged: the scoped write still goes through the
structural-sharing `setPointer`, so only `/items/{i}/…` wakes and siblings stay `Object.is`-asleep.

**Out of scope / unchanged.** The host's server-driven `updateDataModel` write (`renderer.ts:254`) uses an
absolute protocol path — untouched. List-item **action** context (`collectContext`, LLD-C9) resolving relative
paths through `itemScope` is a **separate** concern, tracked under **#140** (per-item action scope), not this
amendment. A **relative** two-way binding with **no** `itemScope` (a malformed input outside any list) still
writes to a garbage key exactly as today — a **pre-existing**, strictly-out-of-scope asymmetry (the read side
returns `undefined`/placeholder for the same input; whether `setPointer`/the write path should guard a non-`/`
pointer the way `resolvePointer` does is a separate question, deliberately **not** opened here).

**Stale → re-verify on the build gate:** `input.ts` (scoped writeback) · `widget.ts:89` (itemScope passed) ·
`binding.ts` (`scopedPointer` exported) · `types.ts:18` (`ItemScope` both-direction) · LLD-C8 (the write-side
itemScope clause) · the new round-trip test (`list.test.ts` / `input.test.ts`).

## Amendment — subtree + nested templates (full item subtrees in list items)

> 2026-06-28 · the subtree/container-template completion · append-only (the Decision above stands and is
> *completed*, not changed). Flagged by `exec-a2ui-list` during #137; designed + ratified 2026-06-28.

**The gap.** The Decision's "Out of scope" para and `list.ts:30-32` scoped the #137 build to **single-root** item
templates: each instance is `createWidget(templateNode, surface, childScope, itemScope)` (`list.ts:76`), which builds
the template component's ONE root and does **not** recurse into its own `child`/`children`. Real A2UI v1.0 lists
routinely use **container** templates (a Card or Row per element, with its own descendants), so a single-root item
renders only its root — a conformance gap. A **nested** template (an item subtree that itself contains another
`{ path, componentId }` list) was the same follow-up. Both were named as planned follow-ups in the original Decision,
so this is the **subtree-half of the same decision** — there is no new design principle to weigh (hence an
*amendment*, like the #139 write-side completion, not an `Extends`-ADR).

**The completion (no new design choice).** A list item renders its template's **full subtree by reusing the static
tree's own recursion**, threaded with the item's `childScope` + `itemScope` — descendants inherit the **same**
positional mechanism (per-index child scope, `scopedPointer` relative→absolute resolution) the root already uses, so
a relative binding on **any** descendant resolves to `{path}/{index}/…` and an absolute one to root. No parallel
renderer:

1. `tree.ts` — extract the static `#mountNode` child-walk (`tree.ts:137-141`) into a shared
   `#mountChildrenInto(el, node, scope, itemScope, instance)`, and add `#mountInstance(id, scope, itemScope)` for a
   list-item **descendant** (a missing id → an **inert** comment anchor, **no** `#pendingParents` patch-in; **no**
   `surface.widgets` registration — an item-template id aliases across the N instances, and nothing reads a descendant
   by id: only `widgets.get('root')` is read, `renderer.ts:344`). `#mountNode` keeps its lookup / out-of-order-anchor
   / widgets-memo head and delegates its tail to `#mountChildrenInto(el, node, surface.scope, undefined, false)` —
   **byte-for-byte** for the static tree.
2. `list.ts` — `renderList` keeps `createWidget` (the item **root**, a guaranteed `HTMLElement` since the loop guards
   template presence, `list.ts:93/97`) and gains **three optional, defaulted** deps: `mountChildren?` (recurse the
   root's subtree; **default no-op = leaf**, so the shipped leaf list and every existing `list.test.ts` harness +
   `index.ts` consumer are byte-for-byte unchanged), `parentScope?` (default `surface.scope`), `parentItemScope?`
   (default `undefined`). `appendInstance` builds the root via `createWidget`, then
   `mountChildren?.(el, templateNode, childScope, itemScope)`. The loop / teardown-carrier / length-computed move from
   `surface.scope.run` to `parentScope.run`, and the array path becomes `scopedPointer(template.path, parentItemScope)`
   (used for both the length-resolve and `itemScope.path`). For a **top-level** list all three defaults reproduce the
   shipped behavior exactly (`scopedPointer('/items', undefined) === '/items'`, `parentScope === surface.scope`).

The chosen vehicle is **Option 2** (renderList keeps `createWidget` for the root + `mountChildren` for descendants) over
Option 1 (a single `mountItem(): HTMLElement` seam replacing `createWidget`) — Option 2 preserves the `renderList`
public API + every existing test byte-for-byte, at the cost of a two-line root-build that the descendant recursion
also has.

**Why nested lists fall out for free — the Collection-Scope chain is the pointer.** A template subtree containing
another `{ path, componentId }` is reached by `#mountChildrenInto` in **instance** mode → `renderList` with
`parentScope = the outer item's childScope`, `parentItemScope = the outer item's itemScope`. The inner item's
`itemScope.path = scopedPointer(innerTemplate.path, outerItemScope)` is the **fully-resolved absolute pointer**
(`scopedPointer('sublist', { path:'/items', index:i }) === '/items/i/sublist'`), so an inner relative `name` resolves
to `/items/i/sublist/{j}/name` — the entire collection-scope chain is **baked into the absolute pointer**, with no
explicit chain object. Teardown composes by construction: removing the outer item (`list.ts:81 removeLast` →
`childScope_i.dispose()`) disposes the inner reconcile effect **and** teardown carrier (both now owned by
`childScope_i` via `parentScope.run`), whose cleanup disposes every inner item scope; the outer `el.remove()` drops the
inner DOM with it. This is the **same** cross-effect-scope re-rooting the shipped leaf list already relies on
(`childScope.run(effect)` owns its effects independent of the surrounding reconcile effect), so it is proven, not new.
**Cycle safety needs no new guard:** `hasCycle` (`tree.ts:190`) walks **all** buffered ids at `apply`, so a cycle in a
template's `child`/`children` subtree poisons the surface **before** the list ever instantiates.

**Single-frame itemScope, NOT a scope-chain (deliberate).** For binding resolution — read and write — the single-frame
`{ path, index }` (`types.ts:20`) **composes** because the inner frame's `path` already encodes every outer index. An
explicit scope-**chain** would be needed only if the LLD-C10 `@index` function ever had to address an **outer** loop's
index; standard A2UI v1.0 `@index` is the **innermost** iteration index (`= itemScope.index`), so single-frame is the
v1.0-faithful choice (YAGNI). **Documented consequence:** nesting bakes the outer indices into the inner item's `path`,
so they are not separately addressable from a single frame — if C10 ever needs outer-index addressing, promoting
`ItemScope` to a frame **chain** is a **C10-era decision**, not this slice's.

**Out of scope / deferred (unchanged by this amendment).**
- **Out-of-order template / descendant arrival.** `surface.components` is a plain `Map` (not reactive), so a template —
  or, now, a subtree **descendant** — arriving *after* its container mounts renders nothing until a length change
  (`list.ts:95-96`). Subtree only **widens** the surface (more ids per item), which is why a list-item descendant uses
  an **inert** anchor with no patch-in (the id-keyed `#pendingParents` cannot disambiguate one id across N instances).
  The fix is a separate **reactive-component-buffer** follow-up (re-poking a mounted list on new deliveries naturally
  re-mounts items, picking up late descendants); priority unchanged.
- **Per-item listener lifetime (HIGH-priority follow-up, deferred under #140).** `#wireAction` (`renderer.ts:309`)
  **and** `installInputBinding` (`input.ts:79`) both register their DOM listeners on `surface.ac`, removed only at
  **surface** teardown — so a **positionally-removed** item's action/input listener leaks (detached, won't fire, but
  retained → unbounded over churn). A pre-existing item-granular **SPEC-N3** gap that subtree promotes from edge-case to
  common (every Card-with-button / interactive row). The fix gives each item the **(scope, ac) pair** the surface has —
  a per-item `AbortController` aborted in `removeLast()`, mirroring `disposeSurface` (`surface.ts:61`) exactly — and is
  **deliberately not bundled** here (it touches the host + input controller, outside this slice's tree/list recursion).
  Tracked under **#140** (per-item action scope), extended to cover the input listener.

**Stale → re-verify on the build gate:** `tree.ts` (`#mountChildrenInto` / `#mountInstance`; `#mountNode` delegates its
tail) · `list.ts` (`renderList` subtree deps; `parentScope`-owned loop; `scopedPointer(template.path, parentItemScope)`)
· LLD-C6 (single-root → full item subtree + nested) · the new subtree + nested tests (`tree.test.ts` "children-template
routes…" describe, on the real `SurfaceTree` + widget path) · the static-children DFS tests (`tree.test.ts:43/62`,
out-of-order `:149-208`) stay green = the byte-for-byte guard.

## Amendment — per-item listener lifetime (the `(scope, ac)` pair, #140)

> 2026-06-28 · #140 · append-only (the Decision above stands and is *completed*, not changed). The exact
> mechanism below was **already named** by the subtree amendment's *Out of scope* para ("*the fix gives each
> item the **(scope, ac) pair** the surface has — a per-item `AbortController` aborted in `removeLast()`,
> mirroring `disposeSurface` exactly*"); this amendment is that booked follow-through landing — no new design
> choice (hence an amendment, not an `Extends`-ADR).

**The gap (an item-granular SPEC-N3 leak — listeners, not effects).** The per-item ownership this ADR built gives
each instance a per-index **`childScope`** (`list.ts:94`) that owns its bound-prop **effects** and is disposed on
positional removal (`removeLast` → `childScope.dispose()`, `list.ts:107`). That covers the *reactive* half of SPEC-N3
at item granularity — but **not the DOM-listener half**. Exactly two listener registrations are reachable per item,
and **both** register on the **surface-level** `surface.ac`, removed only at *surface* teardown (`disposeSurface` =
`scope.dispose()` + `ac.abort()`, `surface.ts:61-64`):

- the per-item **action** listener — the host's `createWidget` closure (`renderer.ts:287-292`) calls `#wireAction`
  (`renderer.ts:307-314`), which does `el.addEventListener('click', …, { signal: surface.ac.signal })`. Reached for
  *every* widget, including a list-item Card-with-button.
- the per-item **input** listener — `installInputBinding` (`input.ts:65-89`), called from `makeCreateWidget`
  (`widget.ts:90`), does `el.addEventListener(value.event, …, { signal: surface.ac.signal })`. Reached for *every*
  input widget, including an editable list-item field.

So a positionally-removed item (`removeLast`) disposes its child scope (effects gone) and detaches its element, but
its action/input listener registration is **retained on `surface.ac`** — the detached node won't fire, but the
registration accumulates **unbounded over add/remove churn**. A memory **leak**, not corruption. Latent since the
leaf list (#137/#139); the subtree amendment promotes it from edge-case to **common** (every Card-with-button /
interactive row is now an item subtree).

**The completion (no new design choice).** Give each item the **`(scope, ac)` pair** the surface already has, so the
two halves of an item's lifetime release together — mirroring `disposeSurface`'s `scope.dispose() + ac.abort()`
byte-for-byte, at item granularity. The ac threads **exactly parallel to the `scope`/`itemScope`** the read-side
amendments already thread — through the *same one* `createWidget` call the list drives per item, and the *same*
`tree.ts` recursion. There is no alternative to weigh: the listener half *must* die with the item or it is the leak
above.

1. **`types.ts`** — `CreateWidget` gains a trailing optional **`ac?: AbortController`** (sibling to `scope?`). Every
   implementation defaults it to `surface.ac`, so the non-list/static caller (`tree.ts:133` `#mountNode →
   createWidget(node, surface)`) omits it ⇒ `surface.ac` ⇒ **byte-for-byte** unchanged.
2. **`renderer.ts`** — the host `createWidget` closure (`:287`) gains `ac = surface.ac`, forwards it to `base(…, ac)`
   and to `#wireAction(el, node, surface, spec, ac)`; `#wireAction` (`:307`) registers on **`ac.signal`** instead of
   `surface.ac.signal`.
3. **`widget.ts`** — `makeCreateWidget`'s returned fn (`:64`) gains `ac = surface.ac`, passes it as the trailing arg
   to `installInputBinding(el, factory, node, surface, itemScope, ac)` (`:90`). `bindProp` is **untouched** (its
   effects are already `scope`-owned — that half was never the leak).
4. **`input.ts`** — `installInputBinding` (`:65`) gains a trailing **`ac: AbortController = surface.ac`**; the listener
   registers on **`ac.signal`** (`:87`). Direct test callers (`input.test.ts`) omit it ⇒ `surface.ac` ⇒ unchanged.
5. **`tree.ts`** — the ac rides the **same recursion** the `itemScope` does: `#mountChildrenInto` and `#mountInstance`
   gain an `ac` param; `#mountInstance` passes it to `createWidget(node, surface, scope, itemScope, ac)` and recurses
   with it; the static `#mountNode` tail passes the surface default
   (`#mountChildrenInto(el, node, surface.scope, undefined, false, surface.ac)`); the `renderList` `mountChildren`
   callback gains the trailing `ac` (`(childEl, childNode, childScope, childItemScope, childAc) =>
   #mountChildrenInto(childEl, childNode, childScope, childItemScope, true, childAc)`).
6. **`list.ts`** — `ListItem` gains `ac: AbortController`; `appendInstance` (`:93`) mints `const childAc = new
   AbortController()` **alongside** `childScope`, passes it to `createWidget(…, childScope, itemScope, childAc)` **and**
   to `mountChildren?.(el, templateNode, childScope, itemScope, childAc)`, and pushes `{ el, scope: childScope, ac:
   childAc }`; `removeLast` (`:104`) calls **`item.ac.abort()`** alongside `item.scope.dispose()`; the teardown carrier
   (`:134-139`) **aborts** every still-live item ac alongside disposing its scope. The `mountChildren` dep signature
   gains the trailing `ac` param.

**The crux confirmed — `#wireAction` takes a per-item ac cleanly (no fork).** The flagged risk was that the action
path might wire *separately* from `createWidget` and so be unable to reach a per-item ac. It does **not**: `#wireAction`
is called **inside** the host's `createWidget` closure (`renderer.ts:290`), in the same lexical scope that already
receives `scope` and `itemScope` — the ac threads to it identically. There is **no** separate host-side action-wiring
pass. Both listener registrations (action via the host closure, input via `makeCreateWidget`) are reached through the
**single** `createWidget` call the list already drives per item — the ac is one 5th param on that one signature.

**Why correct + paired (and nested-safe).** `childAc` is minted once per `appendInstance`, paired **1:1** with the
`childScope`, and aborted at exactly the two points the scope is disposed — `removeLast` (positional removal) **and**
the teardown carrier (surface- or parent-scope teardown). **Nested lists compose for free** by the same chain the
scopes already use: an inner list's per-item acs are minted by the inner `renderList`, whose teardown carrier is owned
by the **outer** item's `childScope` (`parentScope.run`) — so removing the outer item disposes the inner carrier →
aborts every inner item ac, while the outer item's own `childAc.abort()` removes the outer root's listeners. No new
cross-scope machinery: the ac rides the exact recursion the `itemScope`/`childScope` already ride (the same
re-rooting the shipped leaf list relies on).

**Out of scope / unchanged.**
- **Static tree + server-driven writes stay on `surface.ac`** (the default) — every existing `#wireAction` /
  `installInputBinding` caller is byte-for-byte unchanged; the host's `updateDataModel` (`renderer.ts:254`) is untouched.
- **Action *context* relative-path resolution is a SEPARATE #140 concern, not this amendment.** `collectContext`
  (LLD-C9 — resolving a list-item action's *bound context paths* through `itemScope`) is "out of this slice"
  (`action.ts:13`) and **not yet wired** — `#wireAction` passes the *static* `context` off the action prop
  (`renderer.ts:308`, via `readActionSpec`), so there is no relative-context resolution in play to leak or mis-resolve.
  That is a binding-**correctness** gap (separate from this listener-**lifetime** gap) and is left for the context slice.

**Stale → re-verify on the build gate:** `types.ts` (`CreateWidget` `ac?`) · `renderer.ts` (`#wireAction` on item ac)
· `input.ts` (`installInputBinding` on item ac) · `widget.ts:90` (ac threaded) · `tree.ts`
(`#mountChildrenInto`/`#mountInstance` ac; `#mountNode` tail passes `surface.ac`) · `list.ts` (per-item
`AbortController`, aborted in `removeLast` + teardown carrier) · LLD-C3/C6/C8/C13 (the per-item `(scope, ac)` pair) ·
the **new no-leak tests** (a detached removed item's action/input listener no longer fires — `renderer.test.ts` for the
action path, `list.test.ts` for the input path) · the existing `list.test.ts` child-scope/no-accumulation suites
(`:190-247`) + every static-tree/byte-for-byte guard stay green.
