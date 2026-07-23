# SPEC — Shell archetypes M5: `ui-super-shell` (the two-level recursive shell grammar)

> Status: proposed · v0.5 · 2026-07-22 · Layer: app chrome (`@agent-ui/app`)
> Refines: [ADR-0151](../adr/0151-named-shell-archetypes-m5.md) (accepted — ratified by Kim
> 2026-07-19) · the agent-app-surfaces PRD's M5 (PRD-G9).
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

## 9 · Amendment (v0.4, SPEC-R8 + SPEC-R9 + SPEC-R10) — the responsive band ladder, the toggle affordance law, and the scrollbar seam

Grounding: GH #170 (Kim's verdict on the composed docs-site chrome at narrow: *"this still looks
like absolute garbage"* — screenshots on the issue) + the two-plane decompose recorded at
[`../decompositions/shell-responsive-system.decomp.json`](../decompositions/shell-responsive-system.decomp.json)
(fourteen actions crossed against the shipped structure; six found unhosted). Decision record:
[ADR-0155](../adr/0155-shell-responsive-band-ladder-toggle-law-scrollbar-seam.md) (proposed).
Build plan: [`../lld/shell-responsive.lld.md`](../lld/shell-responsive.lld.md). Kim's own visual
sign-off at narrow remains the final acceptance gate (GH #170 clause 3) — nothing in this
amendment substitutes for it.

### SPEC-R8 — the band ladder (amends R4's single 40rem story)

- **R8a — two named lines, not one and not N.** The shell family's band vocabulary is exactly
  `wide · compact · narrow`, cut by two container-relative lines: the existing **narrow line,
  40rem** (`SHELL_NARROW_BREAKPOINT_REM`) and a new **compact line, 52.5rem**
  (`SHELL_COMPACT_BREAKPOINT_REM`, new in `shell-breakpoint.ts`, same consistency gate). 52.5rem
  is deliberately [ADR-0150](../adr/0150-compact-window-body-typescale-breakpoint.md)'s number —
  the M3 compact-window boundary the fleet already owns (below it, body type itself compacts;
  a 252px pane beside a compact reading column is the cramp Kim's doc-page screenshot shows) —
  and the shell's own module math lands within one 18px module of it (dual full sides + canvas
  floor: 2·(54+252) + 162 + 4·18 ≈ 846px ≈ 52.9rem). One number, two mechanisms (viewport media
  there, container query here), both citing the same named line.
- **R8b — `collapse-band`, per shell.** A new reflected enum prop
  `collapse-band ∈ 'narrow' (default) | 'compact'` names which line auto-collapses the shell's
  **collapse-mode sides** (R4 semantics otherwise unchanged: query-only hiding, overlay
  toggle-restore, the no-clobber law). The default keeps every shipped shell byte-compatible.
  `stack` and `tabs` sides are NOT governed by `collapse-band` — their reflow semantics answer
  "the row is too cramped for side-by-side," which stays the 40rem narrow line regardless.
- **R8c — the outer-in cascade (GH #44) is a parameterization, not new machinery.** A depth-2
  composition sets `collapse-band="compact"` on the OUTER (app-ring) shell and leaves the inner
  canvas shell on the default: the outer sides collapse at 52.5rem while the inner — by then
  nearly full-width — holds its panes until its own container passes 40rem. App rails first,
  canvas panes next, exactly the sketch, from two lines and one prop.
- **R8d — per-band anatomy (normative table).** For each side, by its narrow arm:

  | Band | `collapse` side | `stack` side | `tabs` side | header/footer bars |
  |---|---|---|---|---|
  | wide (≥ band line) | persisted `collapsed-*` state; toggle = menu glyph | same as collapse | same as collapse | permanent chrome (R2c) |
  | compact (40–52.5rem, `collapse-band="compact"` shells only) | hidden by query; toggle restores as OVERLAY, glyph = X while open | unaffected (wide behavior) | unaffected (wide behavior) | unchanged |
  | narrow (< 40rem) | hidden by query; toggle restores as OVERLAY, glyph = X while open | in flow, full width, middle row goes column; toggle HIDDEN | panes join the narrow-tabs strip (R7b); toggle HIDDEN | unchanged; bars never scroll |

  Bars are non-scroll regions at every band; header-content compaction below the line is the
  consumer's own job (the docs-site header proves out at 360px as part of AC17).

### SPEC-R9 — the toggle affordance law (amends R2b's bare "header-hosted" clause)

- **R9a — presence.** A side toggle composes ONLY when its side has authored content (no more
  dead end-toggle on a one-sided shell), and hides below the 40rem narrow line for `stack`/`tabs` sides
  (R8d — their narrow anatomy is owned by the stack content / the narrow-tabs strip; today's
  no-op-or-conflicting click arms become unreachable).
- **R9b — menu⇄X.** The toggle carries BOTH glyphs (`list` + `x`, both already in the icon pack);
  CSS swaps their visibility off the host's `data-narrow-open` INSIDE the band container query —
  the X is band-correct by construction (a stale attribute can never paint an X at wide, with or
  without JS). While its side's overlay is open, the toggle reads as Close.
- **R9c — state truth.** `aria-expanded` is truthful at every band: `!collapsed-*` at wide (the
  shipped effect), `data-narrow-open === side` below the line. One shell-owned, VISIBILITY-ONLY
  `ResizeObserver` (attributes only — the R7c survival law extends to it verbatim) clears a stale
  `data-narrow-open` on leaving the overlay band and re-syncs `aria-expanded`. Every JS band read
  derives from `shell-breakpoint.ts`'s constants × the live root font-size — the raw `< 640` px
  literal in `super-shell.ts` retires (px ≠ rem under a non-16px root font).
- **R9d — overlay dismissal.** An overlay-open side dismisses by toggle re-tap, by tapping a
  shell-owned `[data-part='scrim']` (composed once; shown only at narrow while a side is open),
  or by Escape. Focus moves to the opened pane container (`tabindex="-1"`) on open and returns to
  the toggle on close. The overlay is non-modal (no focus trap). Its inline-size caps at
  `min(pane-size, calc(100cqi − bar-size))` so a canvas edge stays visible on the smallest
  screens. One side at a time (the existing `data-narrow-open` single-value law).

### SPEC-R10 — the scrollbar seam (the fleet convention, applied to the shell's own scroll regions)

- **R10a — hidden scroller, live scroll.** `--ui-super-shell-scrollbar-width: none` joins the R1c
  token block (consumer-overridable — the repoint pattern; the `command-modal.css` documentation
  comment and the GH #166 `ui-menu` realization are the canonical shape), consumed as
  `scrollbar-width: var(…)` by every shell-owned scroll region: pane boxes (`overflow-y: auto`),
  active segments, the narrow-tabs strip (`overflow-x: auto`), and — by inheritance of the pane
  rule — an overlay-restored side.
- **R10b — the fade is the affordance.** Each scrollable pane box / segment wires the fleet's
  `scrollFade` trait (`{ viewport }`, the `menu.ts` precedent): once the bar hides, the edge fade
  is the scroll signal. This requires exporting `scrollFade` from `@agent-ui/components`' root
  barrel — a named public-API widening riding ADR-0155 (the `paneResize`/ADR-0023 precedent),
  never a silent deep-import.
- **R10c — family disposition.** `ui-workspace-shell`/`ui-chat-shell` inherit R10 by composition
  (zero own rules). `ui-app-shell` owns NO scroll region (verified — its regions' scroll is
  consumer content), so the seam is vacuous there; that, and its `app-surfaces-m4.lld.md` LLD-C11 `collapse="toggle"`
  Show/Hide disclosure NOT adopting menu⇄X (a region-local affordance, not a header side toggle —
  different altitude), are recorded in `app-shell.md` as named dispositions, not omissions.

AC13 (extends §6): a `collapse-band="compact"` shell hides its collapse side below 52.5rem while a
default shell at the same width keeps it; persisted `collapsed-*` attributes survive every band
crossing unrewritten · AC14 depth-2 outer-in: outer sides collapse at the compact line, inner
panes only below 40rem, cross-engine · AC15 the toggle: absent for an unauthored side, hidden at
narrow for `stack`/`tabs` sides, menu⇄X truthfully per R9b/R9c with no stale X or stale
`aria-expanded` after an open-overlay→wide resize · AC16 scrim tap and Escape each dismiss with
focus returned to the toggle; the overlay never spans the full container at 320px · AC17 the
docs-site chrome on the amended grammar: nav hidden below the compact line behind the menu toggle,
overlay + X + dismissal live, full vertical rail inside the pane/overlay (the `collapse="menu"`
dropdown retires from the site nav), persisted wide collapse intact, header row clean at 360px, no
horizontal overflow at 360/640/840/1200px, both engines · AC18 every shell scroll region computes
`scrollbar-width: none` with scroll live and the fade edge present (the GH #166 probe shape),
both engines; a consumer token repoint restores the bar.

## 10 · Amendment (v0.5, SPEC-R11 + SPEC-R12 + SPEC-R13) — the shell-system laws (the two-system spacing ladder · scope-proximity display overrides · live floors)

Grounding: three completed evidence audits of the SHIPPED shell system (the 2026-07-22
codification campaign): the **spacing census** (every raw length across the shell family's sheets,
classified onto its owning ladder), the **seam audit** (every consumer-override collision with a
component's own `@scope` rules), and the **min-sizes census** (every declared floor traced to its
actual consumers). These laws codify structure the audits found already realized in the tree —
they mint no new machinery. Each law names its realized precedent; the one found VIOLATION
(R13's passive-crush window) is under repair by a parallel build whose own record names the
mechanism — R13 states the requirement that build must clear, not its mechanism.

### SPEC-R11 — the two-system spacing ladder (codifies R1c's boundary with the fleet space tokens)

- **R11a — two systems, one junction.** Shell-FRAME geometry — bars, rails, panes, gaps, overlay
  insets — derives from `--ui-super-shell-module` (1.125rem = 18px, the head of
  `super-shell.css`'s token block) via its shipped multiples (×3 bars/rails, ×9 floors, ×14 panes)
  and fractions (`/3`, `×2/3`); the corner radius is the ONE frame dimension chained the other way
  — `var(--md-sys-shape-corner-lg, var(--ui-super-shell-module))`, fleet shape role first, module
  only as FALLBACK. CONTENT-tier spacing — inside panes and segments, chrome rows, page content —
  uses the fleet's `--md-sys-space-*` ladder (4/8/12/16/24/32px, density-multiplied;
  `dimensions.css`, ADR-0015 cl.4). The two ladders meet at exactly ONE value: `--md-sys-space-md` (12px = 0.75rem)
  = module × 2/3 — a deliberately NESTED pair, not drift. That 0.75rem rung is the sanctioned
  junction: a box sitting on it takes the spelling of the system it belongs to (frame boxes spell
  it off the module, content boxes off the space token) — the spelling is a declaration of
  ownership, so a mixed spelling on one box is a classification error even when the pixels agree.
- **R11b — cross-family aliases are minted on the boundary element.** A consumer family needing a
  shell-derived length mints ONE named alias in its own namespace, declared ON the composed shell
  element itself — the `--ui-agent-admin-shell-gutter` pattern (agent-admin.css's
  `ui-super-shell { … }` alias rule, PR #191):
  the alias chains from `--ui-super-shell-module` on the very element that token is declared on.
  Never in the consumer's ancestor-scoped token block: custom properties resolve at their
  DECLARING element, so a `var()` chained onto a descendant's token computes guaranteed-invalid
  when minted on the ancestor (agent-admin.css's inheritance-direction rationale — proven there by
  a real cross-engine 0px regression when tried).
- **R11c — the literal law + the named exceptions.** A raw length literal in shell-family CSS that
  exactly equals a ladder value IS drift, never coincidence — it silently forks that box off every
  future token retune (density, module). Enforcement precedent: the census found 32 such
  declarations (e.g. `_page.css:275`'s `gap: 0.25rem 1rem` — exact `--md-sys-space-xs`/`-lg`
  values spelled raw) and the mop-up wave converting them rides this same campaign; AC19 is the
  standing gate that holds the count at zero thereafter. Distinct from drift, the census's five
  documented OUTLIERS — real literals with NO ladder rung, sanctioned as-is because there is
  nothing lawful to convert them to (a closed list; growing it is a reviewed act, never a
  drive-by): `_page.css:240` (`margin: 0 0 1.25rem`, `.page-lead` — 20px, between space-lg and
  space-xl) · `_page.css:250` (`padding: 0.45rem 0.9rem`, `.page-cta`) · `_page.css:283`
  (`padding: 0.35rem 0.1rem`, the tab-strip anchors) · `_page.css:284` (`margin-block-end: -1px`
  — the deliberate border-straddle, per its own inline comment) · `_page.css:387`
  (`padding: 0.1em 0.35em`, inline code — font-coupled by design, not rem-ladder-eligible). One
  further named exception sits OUTSIDE the census's padding/margin/gap scope but inside AC19's
  deliberately wider one: the pane-resizer's `0.25rem` hit-target thickness (`super-shell.css`'s
  `[data-part='pane-resizer']` rule, `inline-size: 0.25rem`) — a control dimension that coincides
  with `--md-sys-space-xs` numerically, not semantically; it is AC19's one allowlist entry at
  landing.

### SPEC-R12 — the scope-proximity display-override law (consumer overrides × dual-role ownership)

- **R12a — a consumer override of a component's scoped `display` must tag-qualify.** A component's
  own `@scope ({tag}) { :scope { display: … } }` rule beats any UNSCOPED selector it ties with on
  specificity, regardless of source order — scoping proximity is the cascade's tiebreaker BEFORE
  source order, and an unscoped selector carries the worst proximity. So a bare-class page
  override (`.canvas-tabs { display: flex }`) of a shipped component's scoped display SILENTLY
  loses, however late its sheet loads. The same footgun was independently re-derived twice with no
  fleet-wide statement — `ui-tabs.canvas-tabs` (a2ui-live.css's rationale comment above that rule,
  which also logs the identical hit on `adr-index.css`'s `.adr-search`, and Kim's independent fix
  `e99f090`) and `ui-theme-provider.app-shell` (_page.css's outer-shell-grid comment, the TKT-0001
  trap) — which is exactly why it
  is now law: a consumer override of a component's `@scope`d `display` MUST be element-qualified
  (`{tag}.{class}`) and its comment must cite this clause (SPEC-R12a), because the qualification
  looks redundant and gets "simplified" away otherwise.
- **R12b — dual-role nodes: the shell owns MECHANICS, the consumer owns the CONTENT-BOX.** On a
  node that is both a shell participant and a consumer's content box (a pane segment), shell rules
  govern participation — visibility, flex participation in the shell's axis — and must NOT contest
  properties the consumer legitimately owns there: display mode, padding, gap. Realized precedent:
  GH #197 — super-shell's segment-visibility rule is scoped
  `[data-segmented] > [data-segment]:not([data-active]) { display: none }` precisely so an ACTIVE
  segment is touched by NO shell `display` declaration at all, and the consumer's own
  `display: flex; gap: …` applies uncontested with zero coupling to the shell's attribute
  vocabulary (the GH #197 rationale comment above that rule in `super-shell.css`). A shell part needing an
  active-state box model takes non-contested properties (`flex`, `min-block-size`) — never
  `display`.

### SPEC-R13 — floors are live, not drag-only (hardens R6c and R2e)

- **R13a — every floor token is honored by LIVE layout.** A size-floor token
  (`--ui-super-shell-pane-min-size`, `--ui-super-shell-canvas-min-size`) must bind the layout at
  EVERY width — via CSS (a real `min-inline-size` on the floored box) or an observer-driven
  collapse — never only inside an interactive clamp. The audited gap: both floors are consumed
  solely by the drag clamp (`super-shell.ts`'s `#clampPaneSize`) while the canvas box carries
  `min-inline-size: 0` and no floor (`super-shell.css`'s `[data-part='canvas']` rule), so a
  PASSIVE width change
  (window resize, container reflow) bypasses the floors entirely. A floor a drag respects but a
  resize ignores is half a contract.
- **R13b — band thresholds cover their worst-case arithmetic, and the arithmetic is stated here.**
  Every band line that gates a configuration must sit at or above that configuration's worst-case
  natural-fit arithmetic. Normatively: dual full sides + the canvas floor =
  2·(54+252) + 162 + 4·18 = **846px** (R8a's own number). A dual-collapse-side shell is reachable
  from shipped API alone (`ui-chat-shell` forwards both sides' attributes — `chat-shell.ts`'s
  `FORWARD_ATTRS`), and on the DEFAULT `collapse-band="narrow"` its sides stay in flow down to
  640px — so the
  640–846px window is exactly where R13a's passive crush lives (the min-sizes census's finding).
  Requirement: within any band where a floored box stays visible, no width in that band may
  compute the box below its floor — by whatever mechanism the repairing build ratifies (a computed
  threshold, a live CSS floor, an auto-collapse); the mechanism belongs to that build's record,
  this clause is the bar it must clear.

AC19 (extends §6) — **the spacing-drift gate.** A deterministic, browser-free test (running under
plain `npm test`) over the named shell-family sheet set fails on ANY raw length literal in a
spacing- or box-dimension declaration whose value equals a ladder value, unless allowlisted:
(a) **sheet set** — a named `SHELL_FAMILY_SHEETS` list in the test: every `{name}.css` under
`@agent-ui/app`'s `controls/`, plus every site sheet whose selectors lay out a shell element, its
parts, or a component composing one (today all seven: `_page.css`, `a2ui-live.css`, `a2ui-chat.css`,
`super-shell.css`, `chat-shell.css`, `agent-admin-app.css`, `app-shell.css`); extending the set is a
one-line reviewed append (the `FOCUS_TIMING_FILES` precedent, GH #56) · (b) **predicate** — within
declarations of the `padding*`/`margin*` families, `gap`/`row-gap`/`column-gap`, the `inset*`
family + `top`/`right`/`bottom`/`left`, and the logical/physical box-size properties incl.
`min-*`/`max-*`, **and within any `--ui-*` custom-property declaration whose value is split into
top-level arms (parens-aware — a `calc(...)`'s or `var(...)`'s own internal spaces never split) and
EVERY arm is dimension-shaped: a bare literal, a bare `0`, a `var(...)` reference (with or without a
fallback), or a `calc(...)` expression** (GH #213 — closes the token-minting laundering hole: a raw
rung minted INTO a token then consumed would otherwise pass both this gate and the consumption-side
styling gates. A single bare literal or `calc()` is simply the one-arm case of this same rule — a
genuine multi-value mint, e.g. `var(--md-sys-space-sm) var(--md-sys-space-md)`, is equally in scope
and scanned arm-by-arm, which is what catches a raw two-value mint like `0.5rem 0.75rem` that no
single-arm check would see. A `var(...)` arm — including any literal fallback it carries — is never
scanned: a fallback belongs to THAT token's own declaration, not this one's, held consistent whether
it is the whole value or one arm among several. A declaration with any NON-dimension-shaped arm (a
`box-shadow` token's `rgb(...)` arm) stays out of scope by construction, not a carve-out — it is
doing something other than compositing dimensions), a `px` or `rem` literal — including a literal
arm inside a `calc()` expression, in scope by intent — that at the 16px root equals any SHIPPED R11a
module multiple
(18px × {1/3, 2/3, 1, 3, 9, 14}; ×2 is deliberately absent — no shipped rung, so a raw 36px has
no lawful token spelling to convert to and is a design question, not drift) or any
`--md-sys-space-*` value at density 1 (4/8/12/16/24/32px); `0`, `em` literals (font-relative by
construction), and
percentage/viewport/container units are out of scope — so every R11c `_page.css` outlier is
exempt by construction (no ladder rung, negative, or em), and only a numerically colliding
exception needs an entry — so `calc(var(--ui-super-shell-module) / 3)` passes (no literal arm)
while `calc(0.375rem * 2)`, a bare `--ui-x: 0.75rem`, or a raw multi-value `--ui-x: 0.5rem 0.75rem`
fails exactly as a spacing property's own drift would · (c) **allowlist** — an explicit in-test list of
`(file, declaration, reason)` entries: at landing exactly ONE, R11c's resizer thickness (the
`[data-part='pane-resizer']` `inline-size` declaration); every later append states its reason in
the entry (GH #213 appends a second: `--ui-super-shell-module`'s own root definition, R11a's origin
literal — the head of the token block has no var() to chain to) · (d) **baseline** — born ZERO: the
gate lands with (or after) the mop-up wave's conversions, never with a red or grandfathered count ·
(e) the test's header cites SPEC-R11c/AC19, so a future red reads as law, not lint noise.

AC20 (extends §6) — **floors hold under passive resize, cross-engine.** With both sides authored
full (the `FORWARD_ATTRS` configuration, R13b) on the default `collapse-band`, a container swept
across 640→846px never computes the canvas box below `--ui-super-shell-canvas-min-size`, and no
pane computes below `--ui-super-shell-pane-min-size` while visible in its band. R2e's
no-horizontal-overflow law holds at every step AT OR ABOVE the configuration's natural-fit width
(846px, R13b's arithmetic). BELOW natural fit the two legs cannot coexist under R13a's pure
CSS-floor arm (fixed sides + a floored canvas exceed the container by construction), so the
pinned INTERIM outcome there is floors-hold WITH the row overflowing its container (ambient
presentation, managed by the nearest scroll-managing ancestor) — interim pending GH #205, the
auto-collapse/band-arithmetic follow-up that restores the unconditional no-overflow leg and flips
the test's overflow assertion by design. This AC pins only the measured outcome — the mechanism
is the repairing build's own record (R13b, unchanged by this qualification).
