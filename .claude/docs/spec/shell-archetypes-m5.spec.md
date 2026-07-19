# SPEC — Shell archetypes M5: `ui-super-shell` (the two-level recursive shell grammar)

> Status: proposed · v0.1 · 2026-07-19 · Layer: app chrome (`@agent-ui/app`)
> Refines: ADR-0151 — `adr/0151-named-shell-archetypes-m5.md`, in-flight on PR #45 (ratified in
> substance 2026-07-18; the merge click is Kim's — the relative link lands when the ADR file does) ·
> the agent-app-surfaces PRD's M5 (PRD-G9).
> Composes on: [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md) /
> [ADR-0083](../adr/0083-app-shell-region-role-decouple.md) /
> [ADR-0084](../adr/0084-app-shell-narrow-reflow-collapse.md) (the frame contract) ·
> [ADR-0130](../adr/0130-nav-rail-family-unification.md) (the global-nav ring's family).
> Grounding (normative): Kim's Figma frames (Claude Code Gateway) — wireframe `34-1486` +
> all-collapsed extreme `34-1506`, both recorded on GH #44 (2026-07-19). Work items: GH #82 (this
> SPEC) · #83 (build) · #84 (site adoption) · #85 (chat/workspace extraction).

## 1 · The grammar (SPEC-R1 — the three frame laws)

A **shell** is `[ header? | side-L? | content | side-R? | footer? ]` where:

- **R1a — symmetry.** A *side* is `rail? + pane?` on the left, mirrored `pane? + rail?` on the
  right. One side definition, instantiated twice; no left-only concepts.
- **R1b — ring-dropping recursion.** `content` MAY host another shell. Each nesting level drops the
  rail ring: the outer (app) level owns rails (`global-nav`, `global-options`); the inner (canvas)
  level has panes only (`selections-pane`, `modifiers-pane`). Grammar is depth-agnostic; **depth 2
  is the normative test ceiling** (F3 below).
- **R1c — the 18px module.** Bars (header/footer) and rails are 3 modules (54px); panes are 14
  modules (252px); gaps/radius/padding are 1 module (18px). Realized as `--ui-super-shell-*` tokens
  chained onto the fleet's dimensional roles — never literals in consumer CSS.

Slot vocabulary (the frame's own names): outer `header · global-nav · nav-pane · content ·
options-pane · global-options · footer`; inner `header · selections-pane · canvas ·
modifiers-pane · footer`. An unfilled slot is ABSENT (contributes no box), not empty chrome.

## 2 · The collapse contract (SPEC-R2)

- **R2a** — collapse is **per-side, per-level**: four independent toggles at depth 2.
- **R2b** — toggles are **header-hosted**: a leading toggle collapses/restores that level's left
  side, a trailing toggle its right side (frame `34-1506`'s hamburger pair on BOTH headers).
- **R2c** — header and footer are **permanent chrome**: never collapsed by the side toggles; the
  all-collapsed state is exactly `header / full-bleed content / footer` at each level.
- **R2d** — collapse state is observable (reflected attributes per side/level) and settable as
  props, so a consumer can persist and restore it.
- **R2e** — AC: every pane/rail keeps a real box (visibility via the shell's own state, dimension
  from the token ladder) — a collapsed side computes to zero inline-size WITHOUT overflowing the
  canvas (the no-horizontal-overflow law).

## 3 · The archetype vehicle (SPEC-R3, from ADR-0151)

`ui-super-shell` is a **behavior-only composition** in `@agent-ui/app`: it owns geometry, collapse
behavior, and slot placement — never data, transport, or navigation. Consumers author light-DOM
children into named slots (the `data-region` idiom of ADR-0083). It composes existing machinery
(the app-shell frame mechanics, the nav-rail family for rails) rather than re-implementing.

## 4 · Responsive (SPEC-R4)

Below the fleet's collapse threshold (640px, the app-shell/master-detail precedent) the shell
AUTO-collapses all sides (entering the R2c all-collapsed state); a toggle-restore at narrow opens
that side as an OVERLAY above the canvas (the ADR-0084 reflow precedent), never by squeezing the
canvas below its floor. Auto-collapse never clobbers the consumer's persisted wide-state choice.

## 5 · Forks — proposed defaults (F1–F4, Kim may re-rule; the build follows these until then)

| # | Fork | Proposed default |
|---|---|---|
| F1 | Paired vs progressive restore | **Paired**: one toggle restores the side's rail+pane together (the frames show a two-state story) |
| F2 | Collapse × breakpoint | **R4 as written** — narrow = auto-collapse + overlay reopen |
| F3 | Recursion depth | **Grammar depth-agnostic; depth 2 normative** (the ADR's grammar-ceiling ruling) |
| F4 | Footer semantics | **Permanent chrome but optional slots** — unfilled ⇒ absent (R1's absence law) |

## 6 · Acceptance ladder

AC1 grammar renders (both frames reproduced structurally) · AC2 four-toggle collapse round-trip,
state reflected · AC3 all-collapsed = full-bleed canvas, headers/footers intact · AC4 narrow
auto-collapse + overlay restore · AC5 depth-2 nesting with the rail ring dropped · AC6 the docs
site adopts the shell with a collapsible nav pane (GH #84) with zero page-content regressions.
