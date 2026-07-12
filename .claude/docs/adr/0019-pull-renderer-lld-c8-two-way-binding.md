# ADR-0019 — Pull renderer LLD-C8 (two-way input binding) into the G9 container milestone

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, ratified G9 container-family session |
> | **Ratified by** | Kim, 2026-07-12 — the repo-alignment Phase-0 checkpoint (all five June foundation ADRs ratified together; shipped law since late June) |
> | **Repairs** | `goals §G9` (NEW — LLD-C8 enters the milestone DoD) · `a2ui-renderer LLD-C8` (`input.ts` — the deferred two-way input controller) · `a2ui-catalog SPEC-R4/R7` (the `value: { prop, event }` two-way contract for the new bindable components + the back-filled text-field) · **NEW** `a2ui/src/renderer/input.ts` |
> | **Supersedes / Superseded by** | Relates: **ADR-0001/0002** (the A1 spine-ahead-of-G7 sequencing that deferred the control-dependent renderer tail) · **ADR-0017** (Modal `open`) · the G9 Tabs `selected` bind (ADR not separately needed — booked here) |

## Context

A1 built the A2UI renderer's validation spine and the control-free parser/dispatch/surface/binding tail, but
**deferred the control-dependent steps** until the `@agent-ui/components` foundation shipped (ADR-0001 — spine
ahead of G7; the A1 build-state ledger records the control-dependent renderer tail as gated on the components
foundation). **LLD-C8 — the input binding controller (`a2ui/src/renderer/input.ts`, SPEC-R7)** — is one of those
deferred steps: it listens to an input widget's `input`/`change` event and writes the new value back into
`surface.data` at the bound `valuePath` (the two-way, optimistic bind). It was unbuildable while no `ui-*` control
exposed a bindable value.

G9 changes that. Two of the new containers carry **bindable state** the agent must read back:

- **`ui-tabs` `selected`** — which tab is active (a two-way bind: the agent sets it, a user tab-switch reports it).
- **`ui-modal` `open`** — whether the modal is shown (ADR-0017 — the platform `close`/Escape must report back).

And the form family left a matching gap: the **`ui-text-field` value input bind** was deferred for the same reason
— G6 shipped the `ui-text-field` control with a bindable `value`, but **neither a `TextField` catalog entry nor a
renderer controller** existed to wire it (the catalog entry is *added* at G9 `s11`, not carried over from G6 —
finding #88). G9 is the first milestone with concrete two-way consumers, so building LLD-C8 here serves all three
at once rather than shipping a third partial renderer pass later.

## Decision

We **pull renderer LLD-C8 into the G9 milestone**. Three clauses (decomp `s10` renderer + `s11` catalog):

1. **Build the input binding controller `a2ui/src/renderer/input.ts` (LLD-C8, SPEC-R7).** For a widget whose
   catalog factory marks `valueBinding` + `valuePath`, install (via `surface.ac` — the surface AbortController) a
   listener on the control's declared commit event that writes the new value into `surface.data` at `valuePath`
   (optimistic). One generic controller, no per-component code — exactly the LLD-C8 contract; this ADR changes its
   **schedule**, not its design.
2. **The new bindable containers declare `value: { prop, event }`.** The catalog (`s11`) declares
   `Tabs → value: { prop: 'selected', event: 'select' }` and `Modal → value: { prop: 'open', event: 'toggle' }`,
   so the generic controller wires their two-way bind with no special-casing (SPEC-R4 AC1).
3. **Add the `TextField` catalog entry + back-fill the deferred `ui-text-field` value bind.** The `TextField`
   component type is **added to the default catalog at G9 (`s11`)** — it was **not** present before this milestone
   (finding #88: G6 shipped the *control*, not its catalog entry; an earlier draft of this clause wrongly called it
   "already present"). With the controller in place and the new entry declaring
   `value: { prop: 'value', event: 'change' }`, a `ui-text-field` two-way-binds its `value` through the same generic
   `input.ts` controller — closing the form-family deferral with **zero `ui-text-field` control code change** (the
   addition is the catalog entry, not the control).

## Consequences

- **Realized by** decomp `s10` (`a2ui/src/renderer/input.ts` + `input.test.ts` — file-disjoint in the renderer
  tree) and `s11` (the catalog `value:{prop,event}` declarations). The two are contract-coupled but file-disjoint:
  `s11` *declares* the bind, `s10`'s controller *reads* the declaration — parallel-safe given the LLD-fixed
  `WidgetFactory` shape.
- **One controller, three consumers.** Tabs/Modal/text-field share the generic controller; no per-component binding
  code. This is the payoff for waiting — LLD-C8 lands once, against real consumers, instead of speculatively.
- **The container controls stay renderer-agnostic.** `ui-tabs`/`ui-modal` expose a plain reflected prop +
  `select`/`toggle` event (the family event vocabulary); they do not know about A2UI. The two-way machinery is the
  renderer's, the declaration is the catalog's — clean separation preserved.
- **Discovered-reality guard.** Per the renderer LLD step-5 note, if a container's commit event/value shape cannot
  be expressed by the `value: { prop, event }` contract, that is a **catalog SPEC gap** — repair `a2ui-catalog`
  and re-derive, do not improvise in `input.ts`. The G9 controls were designed to fit the contract (a reflected
  prop + a single commit event), so no gap is expected.
- **Stale → re-verify:** `a2ui-renderer LLD-C8` moves from *deferred* to *realized*; the renderer's §11 build
  sequence step 7 (input + action) is partially satisfied (input half). `a2ui-catalog SPEC-R4` gains live
  two-way consumers.

## Alternatives considered

- **Keep LLD-C8 deferred; ship Tabs/Modal as one-way (render-only) in G9** — rejected: a modal that cannot report
  its own dismissal, or tabs that cannot report the active tab, are not usable agent surfaces — the agent would
  never learn the user closed the dialog. The bindable state is the point of these controls; the controller must
  exist to make them real.
- **A per-control binding shim (Tabs-specific, Modal-specific) instead of the generic LLD-C8 controller** —
  rejected: it duplicates what the LLD already designed as one generic controller and would diverge from the
  text-field path. The generic `value:{prop,event}` contract already covers all three; build it once.
- **Defer to a later dedicated "renderer two-way" milestone** — rejected: that milestone would have the same
  consumers G9 already introduces, so it only adds a scheduling round-trip. Building the controller alongside its
  first real consumers is the cheaper sequencing.
