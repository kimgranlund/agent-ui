# ADR-0024 — A2UI v1.0 dynamic lists are positional (index-based, no key); `list.ts` uses a bespoke positional reconcile, not `repeat`

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-29
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-29 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the #137 v1.0-conformance grounding |
> | **Ratified by** | the **user** chose A2UI v1.0 + vehicle B2; orchestration-lead ratifies on the build gate |
> | **Repairs** | `a2ui-renderer LLD-C6 §5` (keyed→positional — already edited) · `a2ui-renderer LLD` "kernel reuse" note (`repeat`→positional loop) · **NEW** `a2ui/protocol.ts` ChildList template union · **NEW** `a2ui/renderer/list.ts` |
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
