# Design intake — `ui-drill` contained pane presentation: stack slide-over default + `chrome=crumbs` / `layout=columns` variant modes (GH #1510)

> Status: proposed · v0.1 · 2026-08-19 · Layer: intake record (fork sheet, `component-design`
> procedure — a WIDENING intake on a shipped control, not a mint; the mint intake is
> [`drill.intake.md`](./drill.intake.md))
> Refines: GH #1510 (Kim-ruled spec from the two-round make-variants exploration — the design
> evidence is the exploration artifact
> <https://claude.ai/code/artifact/61911208-7efc-41ea-bf48-4e1dda4a2554>, feedback blocks on record
> 2026-08-20: stack slide-over ruled DEFAULT; crumbs + columns ruled opt-in variant modes; zoom
> paradigm DROPPED).
> Refined by: the ADR-0195 Amendment (2026-08-19, proposed) appended to
> [`../adr/0195-ui-drill-drill-down-panel-container.md`](../adr/0195-ui-drill-drill-down-panel-container.md)
> — the contract-changing forks live there; this record is the worksheet.

## 1 · The job (one sentence)

Re-present `ui-drill`'s level changes as panes moving INSIDE a contained card surface — the child
sliding sideways over its dimmed parent by default, with an opt-in breadcrumb chrome and an opt-in
Miller-columns layout — while the N-level `path` array API survives every mode byte-unchanged.

## 2 · Two-plane decomposition (coverage-checked before the sheet)

**Outside-in (parts):** contained geometry (clipping viewport + card chrome) · painted-set render
mapping (which panels paint per mode) · stack motion + parent dim · chrome anatomy axis
(backbar | crumbs) · layout axis (stack | columns) · commit generalization (truncate-then-append) ·
a11y per mode (inert ancestors / crumb trail / column labelling / focus law) · tokens + motion +
reduced-motion · VT-seam interplay (pairing law under multiple painted panes) · catalog posture of
the new attributes · site surfaces + gates · build slices.

**Inside-out (actions the ruled spec demands):**

| # | Action (round-2 verdict) | Covered by part |
|---|---|---|
| a | Child pane slides sideways OVER the parent, parent visible dimmed underneath | stack motion + painted-set mapping + parent dim |
| b | The whole thing reads as ONE contained card, panes clipped at its edge | contained geometry (grid-cell stacking + `overflow: clip` + card chrome) |
| c | Backbar chrome (Back + centered heading) inside the container — today's header anatomy | chrome axis default (`backbar` = the shipped ADR-0195 cl.1 part, unchanged) |
| d | `chrome=crumbs`: clickable trail, jump to any ancestor | chrome axis + commit generalization (`path.slice(0, i+1)`) |
| e | `layout=columns`: ancestor lists stay visible, child opens beside, active row highlighted | layout axis + painted-set mapping + column a11y |
| f | Sideways/slide transitions (round-1 signal, carried) | stack motion + tokens + reduced-motion |
| g | `path` API unchanged in all modes — "zero new mechanism" stays the law | commit generalization (every mode is a render mapping over the SAME resolved path) |
| h | Zoom paradigm dropped | (non-goal — recorded, nothing to cover) |

Coverage holds — every action maps to a part; every part serves an action. The sheet proceeds.

## 3 · Precedent sweep (SOURCE read, nothing redesigned)

| Mechanism needed | Reused precedent (SOURCE read) | Owner |
|---|---|---|
| The shipped contract being widened: path resolution, `#drillTo` append, `#commit`, controlled/uncontrolled duality, heading-focus law, VT exclusivity | `controls/drill/drill.ts` + `drill-panel.ts` + `drill.css`, read end-to-end | ADR-0195 |
| Sideways slide entry/exit, `@starting-style` + `allow-discrete`, reduced-motion guard | `drill.css` §motion (the ADR-0188 cl.5 drawer shape, already in-family) | ADR-0188 / ADR-0195 cl.6 |
| Container = its own z-depth scope (stacked panes never leak z-index past the host) | the container z-scoping row (`component-patterns` table) | ADR-0052 |
| A soft dim wash over still-visible content | `--md-sys-color-neutral-scrim` (the role `ui-modal` started from before its BLOCKING backdrop moved to `dialog-backdrop`, `modal.css:37` — a non-blocking dim is exactly what neutral-scrim is for) | tokens.css |
| Painted-but-non-interactive content (focus/AT excluded) | `inert` + `aria-hidden` on swiper's loop clones (ADR-0124 F2) — same need: visible pixels, no interaction surface | ADR-0124 |
| Named-morph pairing law: ONE element carries the shared `view-transition-name` per snapshot | `view-transition.ts:42` pairing law; ADR-0195 cl.6 set the name on EVERY panel (legal only while exactly one was ever painted) — the contained presentation breaks that premise, see fork V | GH #958 / ADR-0183 |
| A width-responsive lever is an ADR-level decision; breakpoints are unTOKENizable literals | ADR-0150 (cl.2 + Consequences (d): "any future width-responsive token MUST route through its own ADR") — bears on fork W (columns at narrow widths) | ADR-0150 |
| Sizing posture: `ui-drill` is already block-fill + host `min-inline-size: 0` (CONF row); `inline` is the ONE opt-out and is fleet-shared, not per-control | ADR-0223 (Appendix §A drill row; cl.2) — the contained card changes NO inline-axis posture; block-size is not governed by the fill contract | ADR-0223 |
| Custom timing props must be honored by the chosen mechanism (the swiper lesson) | ADR-0124 Consequences ("duration/easing shape programmatic advances only") — here the mechanism stays CSS transitions consuming `--ui-drill-motion-*`, so every token is honored by construction | ADR-0124 |
| Attribute naming: reserved words, one-concept-one-name, per-control closed enums | `references/naming.md` §3 + §10 rubric; `layout` already exists as a part-placement axis (`_base/range-element.ts:43`, `standard·inline·block`; ADR-0223 Context confronted it as a DISTINCT axis from sizing `inline`) | naming.md |
| Catalog wire row: `path` forward-only bindable, structural props stay uncatalogued (curated subset) | ADR-0211 cl.1 (`elevation`/`brightness`/`viewTransitions` uncatalogued; "a later widening is one PropDef each") | ADR-0211 |

## 4 · Fork sheet

Rows that change the ADR-0195 contract are marked **[fork → Amendment]** and carry a firm
recommendation there; the rest are decided here.

| Row | Decision | Justification (one line) |
|---|---|---|
| **Tag** | unchanged — `ui-drill` / `ui-drill-panel`; no new tag | the variants are render mappings over the same two elements; a `ui-drill-crumbs` sub-tag would repeat swiper F3's rejected chrome-tag shape for chrome the host itself owns |
| **Anatomy** | Header part stays host-owned; `chrome=crumbs` swaps its INTERIOR: the Back button hides and a `[data-part="crumbs"]` trail renders — one real `<button data-part="crumb">` per ANCESTOR path entry plus the leaf rendered as the SAME `<h2 data-part="heading" tabindex="-1">` element (now last in the trail). Panels stay author siblings, never moved (ADR-0195 cl.1 survives) **[fork C → Amendment cl.A3]** | leaf-crumb-as-heading preserves the focus target, the panel `aria-labelledby` reflection, and the heading semantics with ZERO mechanism change |
| **Props (host)** | `+ layout: prop.enum(['stack','columns'], 'stack')` reflected · `+ chrome: prop.enum(['backbar','crumbs'], 'backbar')` reflected; `path`/`viewTransitions` byte-unchanged **[forks N1/N2 → Amendment cl.A2]** | two orthogonal axes (a crumbs trail is legal in both layouts); `layout` extends the recorded part-placement-axis concept (range-base `layout`, ADR-0223's "distinct axis" reading); `chrome` is a NEW fleet prop name — the amendment's call |
| **Props (panel)** | unchanged — `key`/`parent`/`heading` | the flat parent-chain grain already expresses everything the modes need |
| **Events** | unchanged — `change` only, `detail: string[]`, ⊂ the closed seven; crumb clicks and ancestor-column clicks COMMIT through the same `#commit` | "zero new mechanism" is the ADR's law; a `select`-per-crumb would fork the vocabulary for no new semantics |
| **Path mapping per mode** | ONE resolved `path` (never-empty, root-inclusive, defined repair — all ADR-0195 cl.2 verbatim); modes differ ONLY in the render mapping: **stack** paints the panels whose keys ∈ path, z-ordered by path order, active = `path.at(-1)`, ancestors dimmed + `inert`, off-path panels `hidden`; **crumbs** renders the resolved path's headings as the trail (crumb *i* commits `path.slice(0, i+1)`, direction `back`); **columns** paints path panels side-by-side in path order, all interactive (a trigger inside the panel at path index *i* commits `path.slice(0, i+1).concat(key)`). Generalization: `#drillTo(key, fromPanel)` truncates the resolved path AT the trigger's hosting panel, then appends — in stack mode the hosting panel is always the leaf, so it degenerates to today's append exactly **[fork P → Amendment cl.A1]** | every mode is a pure function of the SAME state; the truncate-then-append shape is the crumb-jump and the ancestor-column-click expressed as one primitive |
| **Geometry** | tier `pattern` unchanged (header = control-height row; viewport = space scale). Contained realization: host becomes a 2-row grid (header auto row; ALL panels placed in the same second-row grid cell — the classic same-cell stacking, no DOM move, no wrapper part), `overflow: clip` on the host, card chrome (1px `--ui-drill-outline` border + `--ui-drill-radius` consuming `--md-sys-shape-corner-base`). Block-size = content of the tallest PAINTED pane by default; a consumer pins `block-size` for the fixed-height case — no new sizing token, no new geometry row. Columns swaps the second row to side-by-side tracks (`--ui-drill-column-size` min, own horizontal scroll region) **[fork G → Amendment cl.A4]** | same-cell grid stacking keeps panels as siblings (cl.1) AND gives a positioning context + intrinsic height for free; ADR-0223 governs the inline axis only — no posture change |
| **Tokens** | `+ --ui-drill-radius` (consumes `--md-sys-shape-corner-base`) · `+ --ui-drill-scrim` (consumes `--md-sys-color-neutral-scrim`) · `+ --ui-drill-column-size` (columns track floor) · `--ui-drill-slide-distance` DEFAULT flips `12px → 100%` (pane-relative travel — a transform percentage resolves against the pane itself) **[fork T → Amendment cl.A5]**; duration/easing tokens unchanged and still honored by construction (CSS transitions consume them — the ADR-0124 mechanism-honors-attributes check passes) | zero new system roles; the one default flip is the visible cost of "slides in sideways" replacing the 12px nudge |
| **A11y** | **Stack:** heading-focus law unchanged (ADR-0195 cl.5 verbatim); painted ancestors get `inert` (the swiper clone shape) so the dimmed parent is pixels, not surface; Escape/Back unchanged. **Crumbs:** trail lives in a real `<nav data-part="crumbs" aria-label="Breadcrumb">` list part; ancestor crumbs are real `<button>`s; the leaf carries `aria-current` (recommended value `location` — a drill level is a position in a UI, not a page; `page` is the alternative) **[fork A → Amendment cl.A6]**. **Columns:** every painted column keeps `role=region`; the ACTIVE column keeps the `aria-labelledby` heading reflection, painted ancestors take `internals.ariaLabel = heading` (no host attributes — the fleet law); the active row highlight = the host toggling `data-drill-active` on the trigger whose key is the next path entry (a styling/AT-neutral hook; stamping ARIA onto author content is declined). Focus law SCOPED: columns does NOT move focus on drill-forward (the trigger keeps focus; the child opens beside — moving focus sideways on every row click would fight list traversal) **[fork F → Amendment cl.A6]** | crumbs = the WAI breadcrumb pattern realized in host-owned parts; the focus-law scoping is the one deliberate narrowing of cl.5 and is named in the amendment, not slipped |
| **Interaction states** | no deviation — crumb buttons follow the fleet four-state standard; the dim is a mode state, not an interaction state | no row-level fork |
| **Form participation** | unchanged — not form-associated | nothing new carries a value |
| **Motion / VT interplay** | CSS base stays the ONE base mechanism; exclusivity keying (`willUseVT`, `data-vt-active`) unchanged. ONE correction forced by the contained presentation: with ancestors painted, the pairing law's "only one element painted per snapshot" premise breaks — the shared `view-transition-name` moves to the ACTIVE pane only (set per render on the resolved-active panel, cleared elsewhere), which keeps exactly one named element per snapshot and lets the name MOVE across a swap (the morph). `prefers-reduced-motion`: existing guard extends over the new transitions; the dim itself stays (static, never motion) **[fork V → Amendment cl.A7]** | the pairing law is honored by narrowing WHERE the name sits, not by dropping the VT opt-in |
| **Responsive (columns at narrow widths)** | v1 ships NO auto-degrade; columns at compact widths is the author's call (they opted in). A future container-query degrade (the nav-rail `@container` threshold shape) is a NAMED extension requiring its own ruling — ADR-0150's "any future width-responsive lever routes through its own ADR" applies **[fork W → Amendment cl.A8, recommendation recorded]** | opt-in modes don't get speculative machinery; the extension door is named, not built |
| **Site surfaces** | doc + demo pages gain the three presentations; gallery/preview specimen re-cut on the contained default; descriptor `drill.md` re-teaches anatomy/props; standing descriptor/site gates ride along (slice S4) | the testing map owns the bar |
| **Catalog posture** | `chrome`/`layout` stay UNCATALOGUED this pass — the ADR-0211 cl.1 curated-subset precedent verbatim ("a later widening is one PropDef each"); `path`'s forward-only bindable row is untouched (no readback accessor is added by this design, so ADR-0211 cl.2's probe holds). The Drill eval-catalog card re-verifies in S4 because the DEFAULT RENDER changes under it | presentation attributes are the same class as `elevation`/`brightness`; the wire contract does not move |
| **Back-compat** | The shipped unbounded in-place swap presentation is REPLACED, not kept behind a flag — no legacy attribute **[fork L → Amendment cl.A9]** | Kim ruled the direction; a legacy axis doubles the state matrix for a presentation nobody defended (the ADR-0223 no-`hug` reasoning) |

## 5 · Classification (unchanged)

Base class, tiers, and catalog posture all stand as ADR-0195/ADR-0211 set them — this intake
classifies nothing new; it re-maps the render of an existing classification.

## 6 · Novelty leg

No new geometry row, base class, event, or interaction family. The two genuinely new pieces are
(1) the painted-SET render mapping (stack/columns paint the whole path, not one panel) — a
generalization of show-one-hide-rest that updates the existing `component-patterns` ADR-0195 row's
description on S4, and (2) the `chrome` prop name — a fleet-first attribute name, carried as a fork
in the amendment. Everything else is recombination of swept rows (§3).

## 7 · Build slices (one writer per file; each slice lands gate-green)

- **S1 — contained + stack default** (the breaking slice): `drill.css` re-plumb (2-row grid +
  same-cell stacking, `overflow: clip`, card chrome, scrim, 100% travel, reduced-motion extension) ·
  `drill.ts` render mapping (painted set = path; `inert` ancestors; VT name-on-active-only;
  `#drillTo(key, fromPanel)` generalization) · jsdom + browser tests updated to the painted-set
  contract · descriptor `drill.md` anatomy/geometry re-teach.
- **S2 — `chrome=crumbs`**: crumbs part (`nav`/list/buttons, leaf-crumb-as-heading), crumb-jump
  commits, `aria-current`, tests (trail contents track resolvedPath; jump = `slice(0, i+1)` commit;
  focus target identity preserved).
- **S3 — `layout=columns`**: columns tracks + scroll region, per-column labelling, ancestor-column
  truncate-append, `data-drill-active` row highlight, scoped focus law, tests.
- **S4 — site/demo + goldens + record repairs**: doc/demo/gallery pages for all three
  presentations · eval-catalog Drill card recapture (default render changed) · `component-patterns`
  ADR-0195 row description updated (show-PATH-hide-rest) · no visual-harness goldens exist for
  drill today (checked: no `controls/drill/__baselines__`, no drill entry in
  `site/pages/__baselines__`) — S4 states this rather than regenerating nothing.

Slice order is dependency-true: S2/S3 are independent of each other, both depend on S1; S4 last.
Every leaf's accept-criteria cites the `component-testing` bar; no built-output leg beyond the
ordinary `@scope` production-minify check `drill.css` already carries (the lightningcss `:scope >`
constraint is already in-file).

## 8 · Independent doc review

Gated per `component-design` step 8 — a fresh-context doc-checker pass runs on this intake + the
ADR-0195 amendment before any build dispatches; findings route back here.
