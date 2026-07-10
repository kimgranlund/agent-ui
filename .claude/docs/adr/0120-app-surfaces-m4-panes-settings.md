# ADR-0120 — Panes + settings surface join agent-app-surfaces as M4; the split-pane PRIMITIVE lands components-tier (`ui-split`), chrome patterns app-tier

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-10
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-10 |
> | **Proposed by** | planner (design seat — the design-system-surfaces intake, [TKT-0007](../tickets/tkt-0007-design-system-surfaces.md); Kim ruled the tier at intake, fork Q3 2026-07-10: *"Extend agent-app-surfaces (M4)"*) |
> | **Ratified by** | *(fork passes COMPLETE 2026-07-10: F1–F3 answered by Kim at the ratification fork pass — F2 as recommended; **F1 and F3 DIVERGE from the recommendations** (multi-pane now; schema framework IN — see §Forks; clauses 2/4 amended pre-ratification to match, the original recommendation text preserved in the fork rows). Status flip awaits Kim's explicit word.)* |
> | **Repairs** | [`../prd/agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) → v1.1 (adds PRD-G7/PRD-G8 + milestone M4 + scope rows — the amendment is flagged for doc-review; the ratified v1.0 decisions PRD-D1–D6 are untouched) |
> | **Supersedes / Superseded by** | (none) — relates [ADR-0084](./0084-app-shell-narrow-reflow-collapse.md) (whose RESERVED `collapse: "toggle"` value M4 realizes) · [ADR-0082](./0082-app-shell-per-instance-isolation.md)/[ADR-0083](./0083-app-shell-region-role-decouple.md) (the shell contract M4 composes) · [ADR-0115](./0115-spa-router-v1-scope.md) (router stays catalog- and app-invisible — settings navigation wiring is consumer business) · [ADR-0040](./0040-foundation-barrel-budget-rebase.md)/[ADR-0049](./0049-family-budget-rebase-22kb.md) (the budget re-base discipline the `ui-split` addition will follow) |

## Context

Kim's design-system-surfaces seed asks for *"various UI patterns for panes"* and a settings shell. The
intake verified both absent: **no split-pane, splitter, or resizable-panel control exists anywhere in
the fleet** (grep at intake, 42 descriptors checked); `ui-app-shell` lays out its five named regions
on a fixed CSS grid, and its SPEC-R5 explicitly reserves `collapse: "toggle"` as *"a RESERVED future
value, not built at M1"* (ADR-0084). No settings surface exists either — the docs site's theming page
is a guide, not a shell.

At the intake fork round Kim ruled the tier directly: panes and the settings shell are **chrome**, and
they land by **extending `agent-app-surfaces` (as M4)** — not as a sibling `pane-family.prd.md` (which
the intake's Q1 shape had sketched). That created a tension worth resolving with mechanics rather than
deference, because *where the pane code lives* is a DAG question, not a documents question:

- The forcing argument that created `@agent-ui/app` (PRD-D3) was the **`components → a2ui →
  components` cycle** — the canvas host must import a2ui. **A splitter imports nothing from a2ui**;
  that argument does not apply to it.
- The apex is deliberately terminal: *nothing imports `app`*. A split/resize primitive parked there is
  unreachable by `@agent-ui/components` consumers, by `router` users, and — permanently — by the a2ui
  catalog (`a2ui → components` only). Chrome patterns never need to be imported downward; a layout
  control does.
- Drag + keyboard-resize machinery (the ARIA `separator` pattern) is exactly what the fleet's traits +
  per-control DoD (browser legs both engines, whole-shape law) exist to gate — control-fleet
  discipline, not composition-tier code.

So Kim's ruling is honored at the altitude it was made — **ownership and documents** (the chrome PRD
owns panes + settings; no sibling PRD) — while the **primitive** obeys the DAG.

## Decision

**Panes and the settings surface join `agent-app-surfaces.prd.md` as milestone M4 (goals PRD-G7 +
PRD-G8) — no sibling pane PRD — and the family splits by tier: ONE interactive split primitive
(`ui-split`) lands in `@agent-ui/components`' layout family, while the chrome that composes it
(master-detail, the realized `collapse: "toggle"`, the settings surface) lands in `@agent-ui/app`.**
Realized in six clauses; the M4 SPEC/LLD own mechanisms at build.

1. **Ownership (Kim's intake ruling, recorded):** the chrome tier's PRD owns panes + settings —
   scope, goals, and milestone live in `agent-app-surfaces.prd.md` v1.1. The intake's sketched
   `pane-family.prd.md` sibling is **not minted**; TKT-0007 records the reconciliation.
2. **The tier split:** `ui-split` — a **multi-pane (N-slot)**, user-resizable split container
   (draggable dividers + keyboard resize per the ARIA `separator`-with-`aria-valuenow` pattern, one
   separator per adjacent pair; the N-pane constraint distribution + announcement contract is SPEC
   business) — is a **components-tier layout control** *(amended at the 2026-07-10 fork pass: Kim
   ruled multi-pane NOW — the two-slot-only v1 recommendation is overruled; two panes remain the
   degenerate case)* (sibling to `ui-row`/`ui-column`/`ui-grid`), because the PRD-D3 cycle argument
   does not reach it and apex placement would strand it (Context). The app tier **composes** it; the
   family budget re-base this forces is measured at the build wave (the ADR-0040/0049 discipline).
3. **M4 chrome scope — panes:** (a) the **master-detail pattern** — a docked list/detail arrangement
   over the shell's regions + `ui-split`, with the narrow-width behavior (drill-in) defined at SPEC
   time; (b) **`collapse: "toggle"` realized** — the ADR-0084 reserved value becomes a real,
   user-collapsible region affordance (the reservation named this exact future).
4. **M4 chrome scope — settings surface:** a **nav + sections** composition (`@agent-ui/app`): a
   sections rail, per-section panels, narrow-width drill-in — **plus the schema-driven preferences
   FRAMEWORK** *(amended at the 2026-07-10 fork pass: Kim ruled the framework IN — the shell-only
   fence is rejected)*: schema-in → form-out generation composing the fleet's own
   `ui-field`/`ui-form-provider` primitives, validation wiring from the schema, and a persistence
   SEAM (a store-adapter contract — the app may still bring its own store; the exact
   schema/persistence contracts are M4-SPEC business, and the SPEC may phase shell → framework
   within the wave). **Navigation wiring stays consumer business:** `app` never
   imports `router` (ADR-0115's catalog-invisible law); the surface exposes selection
   state/events, and router binding is the consumer's three lines.
5. **Catalog disposition:** `ui-split` enters the SPEC-N2 gate's scope when its descriptor lands —
   disposition at the build wave (likely a `Split` container row; if excluded, a reasoned
   `EXCLUSION_ALLOWLIST` entry — the ADR-0117 F4 precedent). The app-tier chrome is outside the
   components gate and never catalog-bound (PRD-D2's trusted-frame law).
6. **The PRD amendment shape:** v1.0's ratified decisions (PRD-D1–D6) are untouched; v1.1 **adds**
   PRD-G7 (panes) + PRD-G8 (settings) + M4 + scope rows, header-flagged for doc-review — the
   a2a-section v0.x amendment discipline applied to an accepted PRD.

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — the primitive's shape.** *Recommend: ONE `ui-split` (two slots, horizontal/vertical axis
  prop, min/max constraints, controlled+uncontrolled ratio)* — not a multi-pane `ui-split-group` v1.
  N-pane resize (the IDE case) multiplies the keyboard/announcement contract and the constraint
  solver; two-slot nests for the honest majority of layouts, and a group is the foreseen extension
  if nesting proves insufficient.
  **ANSWERED by Kim, 2026-07-10 (ratification fork pass): MULTI-PANE NOW — the recommendation is OVERRULED.** `ui-split` ships N-pane in v1 (the IDE case in scope); two-slot is the degenerate case, not the contract. Clause 2 amended to match; the constraint solver + per-separator keyboard/announcement contract land at the M4 SPEC.

- **F2 — master-detail: shipped composition vs taught pattern.** *Recommend: shipped composition*
  (an `@agent-ui/app` surface with the drill-in behavior built and gated) — the tier's whole thesis
  is that proving a pattern possible (docs) is not the same as making it reusable (PRD §1); a
  pattern-only answer re-creates the bespoke-chrome gap for the most common agent-app layout
  (sessions list | conversation).
  **ANSWERED by Kim, 2026-07-10 (ratification fork pass): as recommended** — shipped composition, built and gated in `@agent-ui/app`.

- **F3 — the settings fence.** *Recommend: shell-only* (clause 4). The alternative — a
  schema-driven preferences framework (config in, form out) — is a real product but a different
  intake: it owns data modeling, validation, and persistence questions this tier deliberately
  excludes (PRD §Out-of-scope: "the app brings its own store").

  **ANSWERED by Kim, 2026-07-10 (ratification fork pass): SHELL + SCHEMA FRAMEWORK — the shell-only fence is REJECTED.** The schema-driven preferences framework (config-in → form-out over `ui-field`/`ui-form-provider`, validation wiring, a persistence store-adapter seam) joins this family's scope. Clause 4 + PRD-G8/§3 amended to match; contracts at the M4 SPEC.

## Consequences

- **The components family grows an interaction-heavy control** — `ui-split` carries drag mechanics,
  a keyboard resize contract, and touch targets; its per-control DoD (both engines, whole-shape,
  forced-colors) is the fleet's most safety-sensitive since the overlay family. Budget re-base
  expected and measured, not guessed.
- **`agent-app-surfaces` stops being "M3-complete = done"** — the accepted PRD gains a fourth
  milestone; its §7 sequencing note and PRD-G1's "~0 bespoke chrome" flagship metric now read against
  M3, with M4 as the extension tier (the amendment states this explicitly to keep v1.0's targets
  honest).
- **The reserved `collapse: "toggle"` debt is scheduled** — ADR-0084's reservation gains its
  realization milestone; SPEC-R5's parenthetical updates at the M4 SPEC, not before.
- **The settings scope now owns framework questions** *(F3 answered: framework IN)* — schema
  modeling, form generation, and the persistence-seam contract are M4-SPEC obligations; what still
  routes to NEW intakes: remote sync, account/identity, and policy/permissions layers (the fence
  moved, it did not vanish).
- **Stale → re-verify at the M4 build wave:** `agent-app-shell.spec.md` SPEC-R5 wording ·
  the a2ui catalog gate scope for `Split` (clause 5) · `measure-size.mjs` line items ·
  CLAUDE.md Layout rows if `ui-split` earns a mention · the site's layout-overview guide.

## Acceptance

This is an **intake** ADR — realized in stages:

- **Intake (this change):** the PRD v1.1 amendment exists (goals/scope/milestone only — no ratified
  decision edited); this record passes the ADR gates and is indexed; TKT-0007 records the
  reconciliation; doc-review dispatched on the amendment + this record. No code changes.
- **M4 (separately dispatched, after M2/M3 or as Kim sequences):** `ui-split` ships components-tier
  with full fleet DoD incl. keyboard-resize + announcement probes; master-detail + settings surfaces
  ship app-tier composing it; `collapse: "toggle"` realized with ADR-0084's wide-layout-unchanged
  invariant held; catalog disposition landed with no allowlist residue.

## Alternatives considered

- **A sibling `pane-family.prd.md` (the intake Q1 sketch).** Rejected: Kim's Q3 ruling — panes and
  settings are chrome, and the chrome tier has an owning PRD; a sibling would split one tier's story
  across two documents (the report-family PRD's sibling ruling cuts the other way here: *that* family
  was content vocabulary no PRD owned; this one has an owner).
- **The whole pane family at the apex (`@agent-ui/app`), primitive included.** Rejected: the Context
  mechanics — no cycle forces it, and the apex is import-terminal, so the primitive would be
  unreachable by components consumers and the catalog permanently. The one-way door swings shut for
  no benefit.
- **Panes as pure CSS guidance (resize: the platform's `resize` property + guides).** Rejected:
  platform `resize` has no keyboard path, no announced semantics, no divider affordance, and no
  constraint model — an a11y hole shipped as a pattern.
- **Settings as a routed page convention (docs only).** Rejected: the F2 reasoning — the tier exists
  because taught patterns rot as bespoke chrome; and the settings shell is the seed's named ask, with
  the drill-in behavior being exactly the hard part worth gating once.
