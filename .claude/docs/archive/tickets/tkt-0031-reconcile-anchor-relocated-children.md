---
doc-type: ticket
id: tkt-0031
status: done
date: 2026-07-13
owner:
kind: bug
---
# TKT-0031 — reconcileChildren's insertion anchor breaks against child-relocating containers

## Summary
Found by TKT-0026's review (reproduced against the real renderer, and PROVEN LATENT — it
reproduces identically pre-TKT-0026): `tree.ts#reconcileChildren` (:316-338) resolves a
survivor's insertion anchor as the bare widget node, never checking `anchor.parentNode === el`.
For a container that RELOCATES its light children at connect (the ADR-0017 child-move pattern:
select, combo-box, menu, popover, tooltip, modal, command-modal, disclosure), survivors live
inside the control's internal panel — so a structural resend inserting a NEW child MID-POSITION
(between two survivors) calls `el.insertBefore(newNode, anchor)` with an anchor that is not
`el`'s child and throws an uncaught `NotFoundError` out of `ingest()`.

Tail-appends work (the anchor stays null) — which is why TKT-0026's tests passed and why the
teaching everywhere is scoped APPEND-ONLY until this lands.

## Acceptance
- A mid-position structural resend against a child-relocating container inserts without throwing,
  for the whole ADR-0017 family — the reviewer's exact repro (Select [a,b] → [a,c,b] through the
  real createRenderer + default catalog) becomes the permanent regression, plus one non-select
  family member (e.g. menu items) to prove the fix isn't select-shaped.
- The mechanism decided at fix (the review named both arms): anchor resolution walks to a node
  still genuinely `el`'s child (skip relocated survivors — accepting order divergence inside the
  relocating control, which owns its internal order) OR relocating containers expose a stable
  anchor seam the reconciler consults. Argue from the child-move pattern's ownership semantics:
  once a control adopts children, the light-DOM order is no longer the rendered order — the
  reconciler must not crash pretending otherwise.
- No regression to the TKT-0024 suite (the id-keyed diff's tested behaviors) or the TKT-0026
  adoption legs; the append-only caveats in the ship-together teaching relax to full generality
  ONLY if the fix genuinely delivers position fidelity (else they stay, restated).
- The pipeline: renderer-core — the tkt-0024 precedent (design intake IF the anchor semantics
  need an LLD-grade decision; the fix may be small enough for a ticket-direct build — the fixer
  decides and names it).

## Repro
The reviewer's scratch shape: ship-together Select(children:[a,b]) + both Options; resend
Select(children:[a,c,b]) with c new → NotFoundError from ingest(). Reproduces pre- and
post-TKT-0026.

## Expected vs actual
- **Expected:** the reconciler inserts new children without assuming survivors remained light-DOM
  children of the container.
- **Actual:** a bare-node anchor + insertBefore against the host → uncaught NotFoundError.

## Classification
Axis: **functional (renderer reconciliation × the child-move pattern)** — plane
`packages/agent-ui/a2ui/src/renderer/tree.ts` (:316-338) interacting with EVERY ADR-0017
child-relocating control. Blast radius: any composer following the (now append-only-scoped)
late-structure teaching with a mid-position insert.

## Severity
**major** — an uncaught synchronous throw out of ingest() on a natural producer shape; masked
today only by the append-only teaching caveat.

## Links
- `packages/agent-ui/a2ui/src/renderer/tree.ts:316-338` · ADR-0017 (the child-move pattern's
  family) · ADR-0128 + `spec/renderer-structural-resend.spec.md` (the reconcile this extends) ·
  `.claude/docs/tickets/tkt-0026-select-late-option.md` (the discovering review; its append-only
  caveats relax when this lands).

## Findings

Fixed via the ticket's Arm 1 (skip-relocated-survivor anchor walk) — the sounder arm: it needs no new
component-side seam (Arm 2's "stable anchor" would have widened the `WidgetFactory`/control public
surface for every ADR-0017 family member) and it matches the ownership semantics select.ts already
documents (`#syncOptions`: a relocating control owns its own adoption order once it moves a child).

`tree.ts#reconcileChildren` (:316-338) now only adopts a survivor as the `insertBefore` anchor when
`survivor.parentNode === el` — a relocated survivor (moved into a control's internal panel by resend
time) is skipped, so `anchor` falls through to the next still-genuine-child-of-`el` survivor, or `null`
(always a valid `insertBefore` target). This never throws for the whole ADR-0017 family.

Proven against the real renderer + default catalog for TWO family members (not select-shaped): Select
(the reviewer's exact repro, `renderer.test.ts`'s rewritten former `.toThrow` pin) and Menu (a second
family member with a DIFFERENT relocation shape — one-time move at connect, no re-adoption observer —
proving the fix isn't tied to select's own adoption mechanism).

Non-vacuity proven: the fix was temporarily reverted (the `survivor.parentNode === el` guard removed)
and both rewritten tests failed with the exact pre-fix `NotFoundError`, then the fix was restored
(diffed byte-identical to the pre-revert state).

Scope held: this fixes the THROW, not SPEC-R5 reorder (ADR-0128, deliberately deferred) — a relocating
control still owns its own realized order past adoption (select.ts's shipped tail-only adoption
ordering), so a mid-list splice is now SAFE to send but not POSITION-FAITHFUL inside the panel. The
seven append-only teaching sites (ADR-0053 amendment, `a2ui-catalog.spec.md` Option row, `factories.ts`,
`generative-form.ts`, `SKILL.md` ×2, `node-idioms.md`) are relaxed to reflect exactly this: mid-position
resend no longer crashes, ship-together remains the recommended shape only for exact panel order.
