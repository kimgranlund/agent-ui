# ADR-0023 — A public `mount()` directive-host seam + the directive-authoring trio (imperative consumers can drive kernel directives; `render`/`html` stay private)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the LLD-C6 (#137) discovered-reality escalation |
> | **Ratified by** | the **user** chose Option A (the narrow seam); orchestration-lead ratifies on the build gate |
> | **Repairs** | **NEW** `dom/template.ts` `mount()` · `dom/index.ts` public exports (`mount` + the directive-authoring trio) · the dom public-surface pin · `a2ui-renderer LLD-C6` (unblocks "reuse `repeat`") · `plan §6` (directive-authoring becomes a public API) |
> | **Supersedes / Superseded by** | Relates **ADR-0022** (the `repeat` reorder seam this lets a2ui consume) · Relates **ADR-0019** (the kernel directives) |

## Context

A2UI's dynamic-list renderer (LLD-C6, decomp `r-c6`/`list.ts`) must "render via the kernel `repeat` directive"
(SPEC-N5 kernel-reuse / DRY). Grounding #137 against the real renderer found that **`repeat`, though exported, is
not publicly *invocable* from a separate package**:

- The a2ui renderer is **fully imperative** — `tree.ts` builds each `ui-*` via catalog factories + `appendChild`;
  it has never used the template machinery.
- `repeat(...)` returns a **`DirectiveResult`** that can only run when **committed to a `ChildPart`**, and a
  `ChildPart` is only created through the template entry (`render`/`html`). But `dom/index.ts` re-exports **only**
  `repeat` + `watch` among directives, and its header is explicit that the seam they ride — `render`, `html`,
  `ChildPart`, and the directive-authoring trio `Directive` / `directive` / `NO_COMMIT` / `RenderContext` — is
  "internal cross-module plumbing, not consumer surface." `UIElement` reaches `render` via a **same-layer
  internal** import (`element.ts:21`). The package `exports` map has no dom/template path.

So a separate package can hold a `repeat()` result but has nothing to commit it into. Worse, the item template
**must** be a *custom* directive (the per-item child scope's `dispose()` is the only no-leak removal hook `repeat`
offers, and an imperative `ui-*` item cannot be a static `html\`\`` template — tag names are not interpolable), so
the **authoring trio must be public too**, not just an invocation entry.

The user weighed three options and **ratified Option A** — the minimal seam — over **B** (export `render`+`html`+the
trio: a larger forever surface) and **C** (re-implement the keyed reconcile inside a2ui: duplicate the `repeat`
algorithm, re-litigating SPEC-N5 and re-doing ADR-0022's focus-preserving move).

## Decision

We add a **public `mount(directiveResult, container, ctx?) → cleanup`** to `@agent-ui/components` (dom layer) and
**export the directive-authoring trio** (`Directive` / `directive` / `NO_COMMIT` / `RenderContext`, plus the
`DirectiveResult` type for typing `mount`'s argument). **`render()` and `html\`\`` stay private.** This is the
minimal seam that lets an imperative consumer **invoke** a kernel directive (`repeat`) and **author** its own,
honoring "reuse `repeat`" + SPEC-N5 without exposing the broader template entry.

`mount()` **reuses the existing `ChildPart` engine** `render()` already uses internally — no parallel commit path:
it creates an anchor comment in `container`, constructs a `ChildPart` on it, calls `part.commit(directiveResult,
ctx)` (which routes a `DirectiveResult` to its directive — `template.ts:390`), and returns a cleanup that calls
`part.dispose()` (disposes the directive → its sub-parts, clears the content, removes the anchor — `template.ts:404`).
`ctx` threads the connection scope so a per-hole effect (`watch`) stays scope-owned, exactly as in `render()`.

## Build brief — for execution-lead (the components seam — ships STANDALONE; a2ui `list.ts` is parked)

> The user chose to **ship the `mount()` seam now and defer `list.ts`** (Fork 2 — the external A2UI list shape + item-key — is unpinned). The seam is useful to **any** imperative consumer of a kernel directive, not just the dynamic list, so it stands alone and is proven by its own tests below — no `list.ts` dependency.

1. **`dom/template.ts`** — add, beside `render()` (it reuses the same internal `ChildPart`):
   ```ts
   /** Mount a kernel directive imperatively: commit `result` into `container` and return a teardown that
    *  disposes the directive (+ its sub-parts) and removes the mount anchor. Reuses the ChildPart engine
    *  render() rides — no parallel path. `ctx` threads the connection scope (a per-hole `watch` stays
    *  scope-owned). For imperative consumers (the a2ui renderer) that need `repeat` without the html`` entry. */
   export function mount(result: DirectiveResult, container: Node, ctx?: RenderContext): () => void {
     const anchor = document.createComment('')
     container.appendChild(anchor)              // content commits as the anchor's previous siblings → inside container
     const part = new ChildPart(anchor)
     part.commit(result, ctx)
     return () => part.dispose()
   }
   ```
2. **`dom/index.ts`** — export `mount` + the trio: `export { Directive, directive, NO_COMMIT, mount } from './template.ts'`
   and `export type { RenderContext, DirectiveResult } from './template.ts'`. **Update the header comment** — the
   "the seam they ride is internal … `repeat`/`watch` are the only PUBLIC directives" note no longer holds; record
   that directive-**authoring** (`Directive`/`directive`/`NO_COMMIT`) + the **`mount`** host are now public, while
   `render`/`html`/`ChildPart`/`prepare` stay internal (the template ENTRY is still private).
3. **The dom public-surface pin** (the test that asserts the `@agent-ui/components` dom export set — the one #93
   updated for `UIContainerElement`) — add `mount` + the trio so the pin reflects the widened surface.
4. **Layering trip-wire** stays green — `mount`/trio live in `dom/template.ts` (imports only `../reactive`); the
   a2ui consumer imports them downward (`components → a2ui`).
5. **Tests — the seam stands alone (decoupled from `list.ts`).** A new `dom/mount.test.ts` (jsdom):
   - **commit:** `mount(repeat(['a','b','c'], (k) => k, (k) => k), container)` — a real public directive whose item
     template returns text (no `html\`\`` needed) — asserts the three item nodes render inside `container`.
   - **cleanup disposes:** the returned teardown empties the directive's content + removes the mount anchor, and
     `inspect()` shows zero residual subscribers (zero-residue, the kernel discipline). **NC:** without calling
     cleanup the content stays live — so the teardown is proven load-bearing, not vacuous.
   - **the public trio is usable by an external-style consumer** (the load-bearing proof of the contract widening):
     author a trivial custom directive via `directive(class extends Directive { update() { /* drive DOM */ return
     NO_COMMIT } dispose() { /* set a teardown flag */ } })`, `mount()` it → assert `update` ran (DOM/flag), then
     cleanup → assert `dispose()` ran. This proves directive-**authoring** works publicly, not just `mount`.
   - **`ctx` threads the scope:** mount a directive that registers a scope-owned effect off the passed `ctx`; assert
     (via `inspect()` / the ctx scope) the effect is owned by `ctx` and dies on cleanup — the scope-ownership contract.
   - Gate: `npm run check && npm test` (+ the dom public-surface pin from item 3, + the layering trip-wire).

## Consequences

- **This widens the framework's forever public contract — stated honestly.** Directive-**authoring** moves from
  internal plumbing to public API: anyone can now write a custom `Directive` and `mount()` it. That is a larger
  surface to keep stable across versions. It is the **minimal** widening that unblocks LLD-C6 — strictly less than
  Option B (which would also make the whole `render`/`html` template entry public). `render`/`html`/`ChildPart`/
  `prepare` remain private: the template *entry* is not a public API, only the directive *host* + *authoring*.
- **Unblocks a2ui LLD-C6.** `list.ts` mounts `repeat` via `mount()` and renders each item through a custom
  item-directive (single-root `ui-*` in a per-item child scope, dispose-on-removal) — the design the #137 readiness
  check settled. No duplication of the reconcile (Option C avoided).
- **One engine, not two.** `mount()` rides the same `ChildPart` as `render()`, so the directive lifecycle
  (commit / `Object.is` skip / dispose) is identical whether a directive is reached through `html\`\`` or `mount()`
  — no second commit path to keep in sync.
- **Layering holds.** The seam is dom/S0 (`../reactive` only); a2ui consumes it (the allowed `components → a2ui`
  direction). No upward import.
- **Stale → re-verify:** `dom/index.ts` exports + the dom public-surface pin regenerate; `plan §6` gains the note
  that directive-authoring is public; a2ui-renderer LLD-C6 is unblocked. Net-new otherwise.

## Alternatives considered

- **Option B — export `render` + `html` + the trio** — rejected (the user chose A): it makes the entire template
  entry a public forever-API for no LLD-C6 benefit beyond A. The imperative consumer needs to *drive a directive*,
  not author `html\`\`` templates; `mount()` gives exactly that and nothing more.
- **Option C — re-implement the keyed reconcile inside a2ui** (raw DOM + `moveBefore`) — rejected: it duplicates the
  `repeat` head/tail + key-map algorithm the ratified LLD-C6 says to reuse, re-litigates SPEC-N5 (kernel-reuse /
  DRY), and would re-implement ADR-0022's focus-preserving `moveBefore` + the dispose discipline a second time. The
  one-branch `mount()` seam is far cheaper than a parallel reconcile.
- **Keep the seam internal (expose nothing new)** — rejected: then the ratified "reuse `repeat`" (LLD-C6) is
  literally unbuildable — the renderer would have no way to commit a directive. The discovered reality forces a
  public seam; the only choice is how wide, which A minimizes.
- **A bespoke list-only export (e.g. a public `mountRepeat(items, key, itemFn)` instead of the general seam)** —
  rejected: it would bake the list use-case into the framework's public API and still not let a2ui author the
  *custom item-directive* it needs for per-item scope disposal. The general `mount()` + trio is both smaller in
  intent and more honest (it exposes the existing primitive, not a use-case wrapper).
