# SPEC — Shell archetypes M5: `ui-super-shell` (the two-level recursive shell grammar)

> Status: proposed · v0.3 · 2026-07-20 · Layer: app chrome (`@agent-ui/app`)
> Refines: ADR-0151 — `adr/0151-named-shell-archetypes-m5.md`, in-flight on PR #45 (ratified in
> substance 2026-07-18; the merge click is Kim's — the relative link lands when the ADR file does) ·
> the agent-app-surfaces PRD's M5 (PRD-G9).
> Follows the established PATTERNS of: [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md) /
> [ADR-0083](../adr/0083-app-shell-region-role-decouple.md) /
> [ADR-0084](../adr/0084-app-shell-narrow-reflow-collapse.md) (the frame contract) ·
> [ADR-0130](../adr/0130-nav-rail-family-unification.md) (the global-nav ring's family) — corrected
> 2026-07-20 (LLD-C2, `shell-archetypes-m5.lld.md`): `ui-super-shell` is an INDEPENDENT
> implementation that mirrors these ADRs' landmark-map + container-collapse PATTERNS, not code that
> imports or composes their actual components — the review-plan LLD's §7 open fork covers whether
> real code reuse should replace this independence later; it is not decided here.
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

## 7 · Amendment (v0.2, SPEC-R5) — N stacked panes per side, asymmetric composition

Grounding: two further Figma frames (`app-shell-layout-single-nav` node 39:1629,
`app-shell-layout-dual-sidebar` node 39:1596), reviewed 2026-07-20. Both show a side hosting more
than one stacked pane — an extra `section-nav` register beside the primary nav — and
`app-shell-layout-dual-sidebar` shows the two sides composed with DIFFERENT pane counts (left =
rail + pane + pane, right = pane + rail). Driven by LLD-C3 (`../lld/shell-archetypes-m5.lld.md`).

- **R5a — pane cardinality, amends R1a.** A side is `rail? + pane*` (zero or more stacked panes —
  was `pane?`, a single-pane ceiling). The rail stays singular per side; R1a's ceiling there is
  unchanged.
- **R5b — asymmetric sides.** The two sides compose INDEPENDENTLY — matching pane counts left/right
  is no longer required. R1a's "one side definition, instantiated twice" still holds for the RAIL
  only.
- **R5c — new slots.** `section-nav` (an additional stackable pane on the DOM-first side, nearest
  `content`) and its mirror `options-section` (DOM-second side, nearest `content`) — both subject to
  R1's absence law (unfilled ⇒ no box) independently of each other and of `nav-pane`/`options-pane`.
- **R5d — collapse stays whole-side.** The paired per-side toggle (R2a/R2b) collapses the rail and
  EVERY stacked pane on its side together — per-pane collapse is out of scope until a real frame
  needs it (YAGNI; none do as of this amendment).

AC7 (extends §6): both new frames reproduced structurally, including the dual-sidebar frame's
asymmetric left/right pane counts · AC8 a whole-side collapse hides a multi-pane stack atomically
(no stray pane left visible after its side collapses).

## 8 · Amendment (v0.3, SPEC-R6 + SPEC-R7) — resizable inner pane · pane segments · tab-based narrow collapse

Grounding: GH #52 (re-hosting `ui-agent-admin`'s chat+canvas chrome, ADR-0132) — Kim's direction
ruling 2026-07-20: EXTEND the archetype grammar rather than declare agent-admin's shape "not a
fit." Evidence source: the shipped `agent-admin.ts`/`.css` composition (a drag-resizable
`ui-split [ conversation | {Settings ⇄ Context} tabs ]` wide shape + a 3-tab Chat/Settings/Context
narrow shape, `ResizeObserver`-reparented under TKT-0085's live-surface-survival hardening) and its
two pinned regression semantics (`agent-admin.browser.test.ts`). Decision record:
[ADR-0154](../adr/0154-shell-grammar-resizable-pane-tab-collapse.md) (proposed). Build plan:
[`../lld/agent-admin-shell-rehost.lld.md`](../lld/agent-admin-shell-rehost.lld.md).

### SPEC-R6 — the user-resizable inner pane (amends R1c's fixed-pane law, per side, opt-in)

- **R6a — scope.** At most the INNERMOST pane of a side (the pane adjacent to `content`) may be
  user-resizable; rails and outer stacked panes stay token-fixed (R1c intact). Opt-in per side via
  two new reflected boolean props: `resizable-start` / `resizable-end` (default `false`). A side
  with no pane ignores its flag.
- **R6b — mechanism.** When enabled, the shell renders a separator part
  (`[data-part='pane-resizer'][data-side='start'|'end']`, `role="separator"`,
  `aria-orientation="vertical"`, `aria-valuemin/-max/-now`) between `content` and that pane.
  Pointer drag and keyboard (arrows = 1 module per step; Home/End = the bounds) mirror `ui-split`'s
  shipped separator contract (app-surfaces-m4). JS writes ONLY a namespaced custom property —
  `--ui-super-shell-pane-size-start`/`-end`, inline on the pane box — never a raw layout style
  (split.ts's geometry-seam law).
- **R6c — bounds.** The pane's inline-size stays ≥ `--ui-super-shell-pane-min-size` AND the canvas
  keeps ≥ `--ui-super-shell-canvas-min-size` (two NEW tokens on the R1c ladder, both defaulting to
  9 modules = 162px; consumers override — the agent-admin migration sets 20rem/16rem, its shipped
  `ui-split` floors). The no-horizontal-overflow law (R2e) holds at every drag position.
- **R6d — state.** The committed size is the reflected numeric prop `size-start`/`size-end` (px;
  `undefined` ⇒ the token default). Observable AND settable — the R2d persistence law, deliberately
  the collapse-state self-owned model rather than ADR-0102's controlled `sizes` mode (the shell
  already owns its collapse state the same way; a consumer persisting the value re-assigns the prop
  on restore). The shell emits `change` on a resize COMMIT (pointer release / key step) — the fleet
  event vocabulary's existing member, the `ui-split` precedent.
- **R6e — interplay.** A collapsed side hides its separator with the rest of the side (R2a
  whole-side law — the separator carries the side's `data-side`); the committed size SURVIVES a
  collapse round-trip. At narrow, the separator is hidden/inert under every `narrow-*` arm.

### SPEC-R7 — pane segments + the `tabs` narrow arm (amends R4's single narrow story)

- **R7a — pane segments (wide).** Direct authored children of a pane slot MAY carry
  `data-segment="<Label>"`. A segmented pane renders a pane-local tab strip
  (`[data-part='pane-tabs']`) at its top and shows EXACTLY ONE segment at a time
  (`data-active-segment` on the pane box, first segment default). Non-segmented panes are
  untouched. Segments are read once at compose (the build-once law) — this replaces a consumer
  hand-composing `ui-tabs` inside a pane (the agent-admin Settings ⇄ Context shape).
- **R7b — the third narrow arm.** `narrow-start`/`narrow-end` widen to
  `'collapse' | 'stack' | 'tabs'`. At narrow, a `tabs` side's panes join a shell-owned top-level
  strip (`[data-part='narrow-tabs']`, composed once, hidden outside narrow by the container query):
  the CONTENT tab always first (label = `data-tab-label` on content's first authored child, default
  "Content"), then per pane in DOM order — a segmented pane contributes ONE TAB PER SEGMENT (the
  flattening that reproduces agent-admin's Chat/Settings/Context trio), a plain pane one tab
  (`data-tab-label` on its first child, default the slot name). Selection = the host's
  `data-narrow-tab` attribute (content default); exactly one participant (canvas, or one
  pane/segment) is visible. Both sides may declare `tabs`; sides on `collapse`/`stack` keep their
  R4 behavior independently.
- **R7c — the survival law (the TKT-0085 guarantee, lifted to grammar level).** Every R6/R7 state
  change — band crossing, tab selection, segment switch, resize — is VISIBILITY-ONLY: the shell
  NEVER reparents, reconnects, or rebuilds authored content. Normative consequence: a live embedded
  surface (an open A2UI surface mid game-loop, ADR-0129) survives wide↔narrow crossings and tab
  switches un-cycled. This deliberately UPGRADES the migrated consumer's pinned narrow-crossing
  semantic — `agent-admin.browser.test.ts`'s *"a live surface open at a crossing INTO narrow shows
  Closed"* documented the reparenting mechanism's honest floor, not a product goal; its analog
  under this grammar is a SURVIVES pin in both directions. ADR-0154 records that behavior delta as
  a ratified decision, never a silent side effect.
- **R7d — ARIA (proposed default; the LLD may harden).** Strips are `tablist`/`tab` with
  `aria-controls` referencing the participant boxes; participant boxes KEEP their landmark roles
  (§the LLD-C1 map) rather than swapping to `tabpanel` at narrow (a role swap needs a JS band
  signal the pure-CSS narrow mode deliberately avoids). Named LLD fork, default as stated.

AC9 (extends §6): drag + keyboard resize move the inner pane within R6c's bounds, `size-*`
reflects, and a collapse round-trip preserves the committed size · AC10 a segmented pane shows the
pane-local strip at wide and flattens to per-segment top-level tabs at narrow (the
Chat/Settings/Context trio reproduced structurally) · AC11 the survival analogs, cross-engine:
(a) a live A2UI surface in content survives a same-band resize (the 1200→800 pin's analog — zero
DOM moves), (b) the SAME surface survives a wide→narrow crossing and a narrow tab round-trip
(content → pane tab → content) un-cycled · AC12 no horizontal overflow at any band with a
resizable pane and segments both active.
