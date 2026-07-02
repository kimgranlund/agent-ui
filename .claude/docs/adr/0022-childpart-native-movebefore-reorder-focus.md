# ADR-0022 — `ChildPart.moveBefore` over native `Node.prototype.moveBefore` (atomic reorder; focus/selection preserved, identity-only fallback)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the `exec-g3-repeat` / `exec-g3-s0` escalation |
> | **Ratified by** | orchestration-lead (on gate) |
> | **Repairs** | the **`dom/template.ts` `ChildPart.moveBefore` seam** (its move semantic) · the **`dom/repeat.ts` reorder contract** comment · `plan §6` (the `repeat` directive — the reorder-state guarantee) · the **`g3-directives` / `g3-templating` decomp** acceptance lines that over-claim "preserving … focus" (`g3-directives.decomp.json` reconcile/`repeat-move-identity`/`u-repeat`/`u-test-repeat`; `g3-templating.decomp.json:153`) — flag to route (this task edits `.claude/docs/adr/` only) |
> | **Supersedes / Superseded by** | Relates: the G3 `repeat` reconcile (decomp slice 1) — gates **before A2UI LLD-C6** reuses `repeat` for dynamic form lists |

## Context

`repeat`'s keyed reconcile relocates a surviving item's sub-`ChildPart` by **identity** via the seam primitive
`ChildPart.moveBefore(ref)`, which today is:

```ts
moveBefore(ref: ChildNode): void {
  for (const node of this.#nodes) ref.before(node)   // ChildNode.before() == parent.insertBefore(node, ref)
  ref.before(this.#anchor)
}
```

`ChildNode.before()` **detaches and re-inserts** each node. Re-inserting an element that *contains*
`document.activeElement` makes the browser **blur it** — so a `repeat` reorder **drops focus** (and the selection /
caret with it). The seam's own doc comment overclaims here — it says "*move-by-identity — preserves element
state/focus*," but `before()` preserves node **identity** only (the same node objects are relocated, never
re-created); transient element **state** does not survive the detach. The `exec-g3-repeat` browser smoke confirmed
it: the `repeat-move-identity` probe focuses an `<input>`, reorders, and can only assert the node is the *same*
object — its in-source note already records that "*focus survival itself is a native-atomic-`moveBefore`
property … node identity, asserted here, is what `repeat` guarantees at this seam*."

The same over-claim was written one level up, into the **decomp acceptance** — `g3-directives.decomp.json` (the
reconcile clause "*insertBefore by identity — preserving element state/focus/selection*", the `repeat-move-identity`
rubric "*a focused input under key c keeps focus … focus lost → RED*", and the `u-repeat` / `u-test-repeat`
acceptance) and `g3-templating.decomp.json:153` all assert "*preserving … focus*". The as-built `repeat.test.ts`
correctly *deviated* to assert identity-only (jsdom's `before()` drops focus), so the decomp rubric and the
shipped probe already diverge. This ADR's two-tier guarantee is the reconciliation: **identity always
(jsdom-proven); focus where native `moveBefore` is supported (browser-proven, post-#69).**

The platform now has the exact primitive: **`Node.prototype.moveBefore(movedNode, referenceNode)`** (called on the
parent) performs an **atomic move** — the node is relocated *without* leaving the document, so **focus, selection,
CSS transitions/animations, `<iframe>` loads, `<dialog>`/popover/fullscreen, and media playback all survive**.
It shipped in Chromium 133 and is rolling out to the other engines; it is **not yet universal** (WebKit/Firefox
lag), so a fallback is required. `jsdom` has it on no path, so the win is **provable only in a real browser**.

This is non-blocking for the `repeat` commit (the reconcile is already correct and identity-preserving), but it
must land **before A2UI LLD-C6** reuses `repeat` for **dynamic form lists** — a reordering list that blurs the
field a user is editing is a real defect there.

## Decision

We upgrade `ChildPart.moveBefore` to use **native `parent.moveBefore(node, ref)` when the parent supports it,
falling back to the existing `ref.before(node)` insert where it does not**. The `repeat` reorder contract is
restated to its true, two-tier guarantee, and the seam's overclaiming comment is corrected:

- **Node identity** is preserved on a reorder **always**, on every engine (unchanged — the same node objects move,
  never re-created). This is what the keyed reconcile guarantees.
- **Element state — focus, selection, and the rest of the atomic-move set** — is preserved **where the platform's
  native `moveBefore` is supported**; on the fallback path it is **not** (identity-only, graceful degradation —
  the reconcile is still correct, only the focus nicety is absent).

## Build brief — for execution-lead (no re-decision)

A single seam method + two contract comments + one cross-engine proof. **S0-owned** (`dom/template.ts`).

1. **`dom/template.ts` — `ChildPart.moveBefore`** (currently ~L432). Feature-detect on the parent and branch; the
   fallback is byte-for-byte the current behaviour:
   ```ts
   moveBefore(ref: ChildNode): void {
     const parent = ref.parentNode as (ParentNode & { moveBefore?: (node: Node, child: Node | null) => void }) | null
     if (parent && typeof parent.moveBefore === 'function') {
       // native atomic move: relocate WITHOUT leaving the document → focus/selection/state survive
       for (const node of this.#nodes) parent.moveBefore(node, ref)
       parent.moveBefore(this.#anchor, ref)
     } else {
       // fallback: detach+reinsert — identity preserved, focus/selection NOT (graceful degradation)
       for (const node of this.#nodes) ref.before(node)
       ref.before(this.#anchor)
     }
   }
   ```
   - **TS:** `moveBefore` is not yet in `lib.dom`; type `parent` via the local optional-method `as` cast shown (no
     `enum`/`namespace`/decorator — `erasableSyntaxOnly`-clean). `typeof parent.moveBefore === 'function'` is the
     feature-detect — support-agnostic (runtime, not engine-version-pinned) and guards a non-callable property; it
     also narrows the optional method for the calls.
   - **Invariant the seam relies on (note for the reviewer):** in `repeat`, `ref` and the moving `#nodes`/`#anchor`
     always share the **same connected parent** (the directive's container) — native `moveBefore`'s happy path. No
     `try/catch` is needed: if a *future* caller violates same-parent/connected, native `moveBefore` throws
     `HierarchyRequestError` (a loud, correct failure, not a silent mis-move).
   - **Correct the doc comment** (the "*preserves element state/focus*" line): identity always; state/focus only on
     the native path.
2. **`dom/repeat.ts`** — the header comment (the "*move-by-identity … element state / focus / selection … preserved
   across a reorder*" line) → the two-tier guarantee: identity always; focus/selection where native `moveBefore` is
   supported, else identity-only. The `SCOPE LIMIT` comment (single-template item) is unchanged.
3. **Tests:**
   - **`dom/repeat.test.ts` (jsdom)** — the existing identity probes stay green (jsdom has no `moveBefore` → the
     fallback branch → identity preserved). Add a one-line note that the jsdom run exercises the **fallback** leg.
   - **A browser proof** (a `repeat` reorder leg in the cross-engine wave — new `*.browser.test.ts` or a leg in an
     existing one): focus an `<input>` in a keyed list, reorder so it moves, then **feature-branch** on
     `typeof document.body.moveBefore === 'function'` (the same support-agnostic runtime detect as the seam):
     - supported (Chromium 133+) → assert `document.activeElement` is **still** the moved input (focus survived)
       **and** identity preserved;
     - unsupported (WebKit/Firefox until they ship) → assert identity preserved and **document** the focus drop as
       the expected fallback (the same feature-gated-leg pattern as the ui-card scroll-driven WebKit gap).
   - Gate: `npm run check && npm test && npm run test:browser`.

## Consequences

- **`repeat` becomes focus-stable on supporting engines** — the dynamic-form-list defect that would bite A2UI
  LLD-C6 is removed there, at the cost of one feature-detect branch. Where unsupported, behaviour is exactly
  today's (identity-correct, focus-dropping) — a strict improvement, no regression.
- **LLD-C6 readiness — `repeat` (with this upgrade) fully satisfies the dynamic-list consumer; it needs nothing
  else from the seam.** Verified against `a2ui-renderer.lld.md` LLD-C6 (`list.ts`) + the reconcile (`repeat.ts`):
  the consumer needs three things from `repeat`, all present — (1) **keyed-identity reorder with focus survival**
  (this ADR), (2) **delta-only append/remove** (SPEC-R6 AC1 — the head/tail fast paths do zero moves), and (3)
  **per-item teardown on removal** — the reconcile's removed-key branch calls `part.dispose()`
  (`repeat.ts:163/166` + the trailing old-cleanup), which propagates to the item's directive `dispose()`. Two
  **usage constraints** fall on the LLD-C6 builder (design notes, **not** seam gaps): **(a) single-root items** —
  each list item must render as **one** root `ui-*` element (the A2UI one-node-per-component norm); `moveBefore`
  relocates the part's `#nodes` + anchor, and a single root carries its whole subtree (incl. a nested list) with
  it. A *multi-root* item would hit the `repeat` SCOPE LIMIT (deeper sibling content in sub-anchors is not moved).
  **(b) item scope owned by the item directive** — `repeat` threads **no `ctx`** to its sub-parts (verified:
  `createChild()` + `#mount`'s `part.commit(value)` pass no `ctx`, so a sub-part's `#ctx` is `undefined`), so the
  per-item child scope cannot be `ctx`-owned; `list.ts` must render each item via a directive that `createScope()`s
  the child scope (from the surface-scope closure) and disposes it in its **own** `dispose()` — which the
  reconcile-removal `part.dispose()` → `#disposeDirective()` then fires (SPEC-R6 "*scopes dispose on removal, no
  leak*"). The *only* thing the seam could additionally offer — `repeat` itself minting a per-item scope via `ctx`
  — is **not needed** and would break `repeat`'s "owns no effect / scope-free" design; if ever wanted it is a
  **separate** seam decision, not part of #69.
- **The contract is honest.** The seam no longer claims focus preservation it cannot deliver on the fallback; the
  two-tier guarantee (identity always · state where native) is what the comment and `plan §6` now say.
- **Engine-divergent behaviour is now a documented, tested axis.** The browser proof asserts the *supported* path
  and records the *unsupported* one — so the WebKit/Firefox focus drop is a known, gated gap, not a silent
  surprise (it closes itself as those engines ship `moveBefore`, with no code change — the feature-detect just
  starts taking the native branch).
- **Stale → re-verify:** `template.ts` `moveBefore` + its comment, `repeat.ts` contract comment, and the new
  browser proof regenerate; `plan §6`'s `repeat` line gains the reorder-state guarantee. Net-new otherwise —
  nothing shipped depends on focus-across-reorder yet (`repeat`'s only consumers are tests until LLD-C6).

## Alternatives considered

- **A manual focus/selection save-restore around the `before()` reinsert** (record `document.activeElement` +
  the selection `Range` before, restore after) — rejected: it re-implements, worse, what the platform's atomic
  move gives for free. Restoring a **caret/selection** across a detach is fragile (offsets, ranges spanning the
  moved subtree), and it recovers **none** of the other atomic-move state (transitions, `<iframe>`, media). It
  also runs on **every** engine (cost) for a strictly worse result than native gives on supporting ones.
- **Status quo — keep `before()`, document the limitation** — rejected: A2UI LLD-C6's dynamic form lists reorder
  while a field is focused/being edited; dropping focus mid-edit is a real UX defect the native primitive removes
  for one branch's cost.
- **Require native `moveBefore`, no fallback** — rejected: it is not yet universal (WebKit/Firefox lag Chromium
  133); a hard requirement would break reorder on those engines. The fallback keeps the reconcile identity-correct
  everywhere; only the focus nicety degrades.
- **Polyfill `moveBefore`** — rejected as impossible by construction: the whole point is the *platform* doing an
  atomic move the JS layer **cannot** replicate (JS can only remove+insert). A "polyfill" would just be the
  `before()` fallback under another name.
