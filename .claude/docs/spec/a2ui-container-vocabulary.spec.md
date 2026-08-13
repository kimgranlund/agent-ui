# SPEC — A2UI container vocabulary (catalog + taught-idiom arm)

> Status: proposed · v0.3 · 2026-08-13 · Layer: SPEC (execution contract)
> Refines: GH #808 (owner ruling, intake round 2026-08-12 — the four-arm scope: header anatomy
> contract · label/value row idiom · container type vocabulary · taught prompt idioms) on
> [ADR-0186](../adr/0186-ui-card-header-structured-format.md) (accepted — the shared header-anatomy
> ruling for the #807/#808 pair; the anatomy question is NOT reopened here) and the intake record
> [`card-structured-container.intake.md`](./card-structured-container.intake.md) (§4a/§4b — what
> #808 consumes). Composes on [ADR-0102](../adr/0102-css-less-consumer-contract-law.md) (the
> CSS-less-consumer law + three-lane chooser — every mechanism below names its lane) and
> [`a2ui-catalog.spec.md`](./a2ui-catalog.spec.md) (the catalog/factory contract this SPEC's rows
> extend).
>
> **No owning PRD — a deliberate, acknowledged deviation** (the `form-popover.spec.md` precedent
> shape): the why/what live in GH #808's issue body + the Figma `dialog-bubble` direction ruling;
> a PRD would restate them.
> **No LLD — a deliberate, acknowledged deviation**: the build is catalog `PropDef` rows, one
> fan-out-table row, one validator clause + fixtures, one prompt file, and one corpus record — each
> landing inside a file whose owning pattern is already established and cited per requirement below;
> an LLD would restate this SPEC's own requirement list. The build plan (§6) carries the slice
> decomposition instead.
> Altitude: owns **what the catalog declares, what the validator rejects, and what the producer
> layer teaches** for containers. Component-side realization (the `format` prop/CSS build) is
> GH #807's, per ADR-0186's Repairs cell. Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1 · Purpose

Formalize the container vocabulary the dialog-bubble direction needs, on the catalog + producer
side: make the ADR-0186 header anatomy *reachable from a catalog payload* (a consumer with no CSS
verb and no slot-attribute verb today), name the container types and their nesting rules, cover
them with conformance, and teach the compositions in the producer prompt layer — all without
minting a new catalog component.

## 2 · Definitions

- **Structured container** — `Card` › `CardHeader` (`format:'structured'`; optional leading icon ·
  title · optional trailing status) › `CardContent` of label/value rows (optional `CardFooter` of
  actions). The mock's "DATE SELECTION" card.
- **Plain card** — `Card` › optional default-format `CardHeader` › `CardContent`/bare children
  (ADR-0056's region-less humane default, unchanged).
- **Section** — surfaceless grouping: `Column` (ladder `gap`), optionally opened by a `Text` label
  row. No card chrome, no new component.
- **Header cells** — `ui-card-header`'s leading/label/trailing grid columns (ADR-0006 family
  anatomy), placed by the `slot` attribute on light-DOM children (`card.css`'s `:has()` host-as-grid).
- **Dialog bubble** — a chat-feed A2UI surface (a feed ask per ADR-0097, or a feed-rendered
  surface): the narrow-viewport context §R7's nesting rules govern.
- **Containment** — the structural rule that a region sub-component is only meaningful as a direct
  child of its owning container.

## 3 · Requirements

### Arm 1 — header anatomy contract (catalog side)

- **SPEC-R1 — the `CardHeader.format` mark.** The default catalog's `CardHeader` row gains ONE
  property: `format`, string enum `['default','structured']`, `mapsTo: 'format'`, **bindable: true**
  — **RULED, 2026-08-13 (Kim, in-session confirm, recorded on GH #808 — "Ruling — 2026-08-13"):**
  the §7 fork row below is taken; a card may flip structured at runtime from data-model state.
  ADR-0186's literal "bindable mark" wording (Consequences: "one new *bindable* mark —
  `CardHeader.format` (one-way/static, since it is a structural mode switch, not live status
  data)") now reads exactly as written. **Superseded v0.2 reading, kept for the trail:** v0.2 read
  "bindable" there as *catalog-reachable* only, with the parenthetical "static" controlling the
  actual flag (`bindable: false`) — every occurrence a literal, fully statically checked by the
  shipped ADR-0098 enum gate (`conformance.ts`). Taking the ruling accepts the named trade-off
  instead: a `{path}`-bound `format` bypasses that static gate (`matchesType`'s `pd.bindable`
  branch accepts the binding object outright, deferring membership to render); a literal `format`
  value is unaffected — still fully statically checked, unchanged. The render-time gate
  (`widget.ts`'s `applies()`, re-checked on every resolution — the same one every OTHER bindable
  enum prop, e.g. `Badge.intent`, already rides) is what enforces membership on the bound arm. It
  rides `cardHeaderFactory`'s existing `accessorFactory`
  generically — the component-side prop is a reflecting accessor per ADR-0186's Consequences; zero
  factory code. Advertised on `CardHeader` ONLY — `ui-card-footer` accepts the attribute for
  family symmetry (ADR-0186), but the catalog does not advertise a mark with no agent use case
  (prompt-inventory economy, ADR-0071).
  *AC1:* the catalog row exists and the derived prompt inventory lists it (`prompt-drift` gate
  green). *AC2:* a payload with `"format":"structured"` validates and renders
  `ui-card-header[format='structured']`; an out-of-enum LITERAL fails validation (existing enum
  checking, no new code); a `{path}`-bound `format` value is ACCEPTED at validation (deferred
  resolution, ADR-0026 — conformance never judges a binding's eventual value) and resolved +
  enum-gated at render (`widget.ts`'s `applies()`, unchanged mechanism). *AC3 (dependency):* this
  row lands only AFTER GH #807's build ships the component prop (intake §7 leaf 1) — a mark
  mapping to a nonexistent prop is a silent no-op, the GH #397 contract-defect class.
- **SPEC-R2 — header-cell reachability: the `slot` mark.** Finding, verified against the renderer
  and `factories.ts`: the tree walk appends `CardHeader` children with NO slot attribute, so a
  catalog payload **cannot reach the leading/trailing cells at all today** — an Icon + Badge land
  stacked in the label column. ADR-0186 cl.3 assumes an agent "composes `ui-icon slot='leading'`…
  exactly as today"; this SPEC supplies the missing transport. Mechanism (Lane B): the `Icon` and
  `Badge` rows each gain `slot`, string enum `['leading','trailing']`, `mapsTo: 'slot'`,
  non-bindable. `slot` is a **native reflecting accessor on every `HTMLElement`** (`el.slot`
  reflects the `slot` attribute), so both rows ride their existing factories with zero factory
  code — the catalog's 1:1-reflecting-accessor invariant, satisfied by the platform itself.
  Scope: exactly these two rows in v1 (the mock's need — leading icon, trailing status); widening
  to other rows (e.g. a trailing header `Button`) is additive, a later intake.
  *AC1:* a `CardHeader` payload with children `[Icon(slot:'leading'), Text, Badge(slot:'trailing')]`
  renders those `slot` attributes on the light-DOM children (jsdom-assertable) and the three-column
  `auto 1fr auto` grid places them (real-engine browser probe — `:has()` is cascade-dependent, the
  TKT-0002 class). *AC2:* no-uptake failure is graceful (children without `slot` render in the
  label column, readable) — the Lane C fallback ADR-0102's chooser requires for a taught refinement.
- **SPEC-R3 — the composed header contract + status binding.** The catalog-level header anatomy is:
  optional `Icon(slot:'leading')` · title child (a `Text`, or any bindable-text child) · optional
  `Badge(slot:'trailing')` — UNCHANGED anatomy per ADR-0186 cl.3, now expressible. The trailing
  **status affordance binds through the data model**: `Badge.intent` and `Badge.label` are already
  `bindable: true`, so live status = `{"path":…}` bindings + `updateDataModel` — resolving GH #808's
  "data-model state vs static prop" open question as *both, via composition*: static status is a
  literal `intent`, live status is a bound one. NO new `CardHeader` prop carries status (rejected
  alternative: `icon`/`status`/`statusLabel` props on `CardHeader` with an owning factory — it
  would duplicate `Badge`'s contract one level up and contradict ADR-0186's "reuses `Badge.intent`"
  consequence).
  *AC:* a fixture/exemplar binds `intent` to a data-model path and an `updateDataModel` flips the
  rendered badge with no `updateComponents` resend.

### Arm 2 — label/value row idiom

- **SPEC-R4 — the row idiom is composition (Lane C) plus ONE enum widening (Lane B).** The taught
  row is `Row(justify:'between', align:'center')` › `Text(variant:'label', text bindable)` +
  `Badge(intent:'neutral', label bindable)` — the intake §4b recipe, expressible today EXCEPT the
  label register: the wire `Text.variant` enum (`h1…h5|caption|body`) fans out through
  `TEXT_VARIANT_TABLE` (the catalog's OWN mapping, ADR-0078 cl.5) and has **no `label` row**, so
  the fleet's label-metrics role is unreachable from a payload. Widen the wire enum with
  `'label'`, fan-out row `{ as: 'none', variant: 'label', size: 'md' }` — zero component change,
  one table row, one enum member. NO new catalog component (`LabelValueRow` rejected: zero new
  mechanism, would duplicate a three-node composition as a tag — the intake §4b's own no-mint
  ruling, upheld catalog-side). Stacking N rows inside `CardContent` rides its existing
  adjacent-sibling rhythm; no gap prop needed.
  *AC1:* `Text(variant:'label')` validates and renders the `label`/`md` triple.
  *AC2:* the fallback for an unwidened consumer is graceful (`caption` approximates the register) —
  named in §7's first fork row and in the R8 module's wall line, not silent. *AC3:* the amendment
  is bigger than a bare table row and is booked honestly as such: it adds a wire-enum MEMBER
  (`catalog.json`'s `Text.variant` enum) + a fan-out row, **amending ADR-0078 cl.5's
  "wire vocabulary is UNCHANGED" headline claim on ADR-0142's current table** — ADR-0142
  (accepted) owns the shifted table values in force today (its Repairs rewired
  `a2ui-catalog.spec.md` §5.2's Text row). Filed as a `## Amendment` (the GH #664 amendment mode,
  Kim ratifies) in the build slice — this SPEC does not self-amend an accepted ADR.

### Arm 3 — container type vocabulary + nesting rules

- **SPEC-R5 — container types are ROLES over existing components, not new components.**
  **Recommendation:** the vocabulary is the three named types of §2 — *section* (`Column`),
  *plain card* (`Card`), *structured container* (`Card` + `format:'structured'` header) — declared
  as taught compositions + the R1 mark, with NO new catalog component and NO `Card`-level variant
  prop. Alternatives considered, for the doc-checker to grade:
  - *New `Section`/`Panel` catalog components* — REJECTED: no `ui-section`/`ui-panel` control
    exists, and the default catalog binds every row 1:1 to a real FACE control (`a2ui-catalog`
    SPEC-R8's no-adapter stance; the sanctioned non-`ui-*` primitives — `Option`, `MenuItem` — exist
    only where no control ever will). Synonym rows for `Column`/`Card` add prompt-inventory cost
    (ADR-0071) and a feed-partition disposition (`feed-catalog.ts` gate) for zero new capability.
  - *A `Card.variant`/`Card.format` mode prop* — REJECTED: ADR-0186 ruled the structured mode onto
    the HEADER; a card-level twin of the same switch re-litigates the ruled anatomy and invites a
    conflicting-state pair (`Card` says structured, header says default).
  *AC:* the vocabulary ships as prose + exemplars (R8/R9) and this requirement's taxonomy; the
  catalog diff for arm 3 is exactly R1/R2/R4's marks — nothing else.
- **SPEC-R6 — containment conformance.** New validation failure code **`CONTAINMENT`**: a
  `CardHeader`, `CardContent`, or `CardFooter` node whose parent (in the adjacency-list id-graph)
  is not a `Card` fails validation with `{ code: 'CONTAINMENT', path }`. Scope v1: exactly the
  three Card regions (Tabs/Swiper sub-types are a future extension of the same code — non-goal
  here). The conformance pack extends accordingly: `manifest.json`'s failure-code vocabulary +
  ≥ 2 new fixtures in `fixtures.jsonl`, `suites/*.yaml` regenerated (never hand-edited — the
  drift-wire gate), and `UPSTREAM-PROPOSAL.md` gains the new code's row. **Fixture sequencing is
  part of this requirement, not a slice footnote:** the `CONTAINMENT` negative (and, optionally, a
  mark-free valid container fixture) lands with the validator clause in S2; the valid structured
  container exercising R1–R4's marks CANNOT validate before S3 ships the `format` mark (an unknown
  property fails `CATALOG`), so that fixture lands in S5.
  Alternative (taught-only, no hard failure) — REJECTED with reasoning stated: a stray region
  renders gracefully, but containment is a *vocabulary-correctness* claim the issue's acceptance
  assigns to conformance ("conformance covers it"); a rule only prose enforces is not covered.
  *AC1:* the repo validator run (`tools/conformance/run.ts`) exits 0 on the extended suite.
  *AC2 (compat sweep):* every existing conformance fixture, corpus exemplar, and examples-shelf
  seed still validates — the new code breaks no shipped payload; a hit is a finding, not a
  silent re-rule.
- **SPEC-R7 — nesting rules inside dialog bubbles (taught tier, Lane C).** Rules, taught in R8's
  prompt module (graceful no-uptake ⇒ Lane C is legal per ADR-0102's chooser; none of these are
  validator failures):
  - **B1** — in a bubble, at most ONE card-surface level: never `Card`-in-`Card`; group inside a
    card with rows/sections. (Any surface: `Card`-in-`Card` at most one level — the ADR-0018
    one-level concentric-radius reach.)
  - **B2** — a structured container's `CardContent` holds label/value rows and sections, never
    another headered card; one `CardHeader` per `Card`, first child; `CardFooter` last.
  - **B3** — page-scale containers stay out of bubbles: already enforced structurally by the
    feed partition (`FEED_SURFACE_TYPES`/`FEED_EXCLUDED`, ADR-0097 §3) — cited, not duplicated;
    this SPEC adds NO feed-partition change (R5 adds no component, so the partition gate stays
    green by construction).
  *AC:* the rules appear verbatim in the R8 module; the R9 exemplar demonstrates B1/B2 compliance.

### Arm 4 — taught prompt idioms

- **SPEC-R8 — the `structured-container` mini-skill.** One new registry module,
  `prompts/mini-skills/structured-container.md` (frontmatter `id`/`triggers`/`catalogId`, the
  ADR-0091/ADR-0135 cl.11 shape), teaching: the structured-container recipe (R3's header + R4's
  rows, worked as JSONL-ready composition), the section/plain-card/structured-container choice
  rule (R5), and B1–B3 (R7) — anatomy → catalog mapping → wall, within the per-module token
  budget. Triggers target summary/itinerary/booking/status-panel intents, disjoint from
  `card-layout`'s playing-card vocabulary (collision named: both match "card"; the body's first
  line disambiguates). `grammar.md` is deliberately UNTOUCHED — container composition is idiom,
  not wire grammar, so the mode-invariant spine keeps its byte-identity.
  **Byte-pinning:** adding the module changes `MINI_SKILLS`, and R1/R2/R4's catalog rows change
  the derived inventory in every composed prompt — both legs of `prompt-equivalence.test.ts` go
  red by design. Each build slice that touches them re-captures via the sanctioned writer
  (`recapture-baseline.test.ts`, `RECAPTURE_BASELINE=1` — its own invocation comment is the
  authority), then verifies `git diff` shows exactly the intended delta — never a hand-edited
  baseline.
  *AC1:* token-budget + selection tests green; a summary/booking-intent probe selects the module.
  *AC2:* recapture diff = the new registry entry + the inventory delta, nothing else.
- **SPEC-R9 — one corpus exemplar.** One admitted corpus record (facet `exemplar`, real
  `a2uiOutput`): a structured container in the mock's register (e.g. a date-selection/trip
  summary — structured header with leading icon + bound success badge, two label/value rows,
  footer action), few-shot-retrievable so uptake doesn't ride prose alone (the ADR-0091
  schema-fit split: R8 teaches, R9 demonstrates).
  *AC:* admission gates pass; the payload validates against the extended R6 suite (it doubles as
  the valid conformance fixture's source).

## 4 · Non-goals

No new catalog component or feed-partition change (R5) · no `CardFooter.format` advertising (R1) ·
no protocol/reserved-key change for child placement — `slot` is a
per-row prop, not a message-schema widening (R2) · no `slot` mark beyond `Icon`/`Badge` in v1
(R2) · no Tabs/Swiper containment rules (R6) · no validator enforcement of B1–B3 (R7) · no
`ask-archetypes-*.md`/`grammar.md` edits (R8) · no component-source change of any kind — the
`format` prop build is GH #807's (ADR-0186 Repairs).

## 5 · Acceptance (gates)

`npm run check && npm test` green by exit codes, foreground; the conformance runner exits 0 on the
extended suite (R6 AC1); `prompt-drift` + `prompt-equivalence` + `suites-driftwire` +
`feed-catalog` partition gates green; the R6 AC2 compat sweep recorded in the landing PR.

## 6 · Build plan (slices — each independently gateable, each green before the next)

| Slice | Contents | Depends on | Gate focus |
|---|---|---|---|
| S1 | R2 `slot` marks + R4 `Text.variant` `'label'` widening (catalog.json + `TEXT_VARIANT_TABLE` row) + baseline recapture; books the ADR-0142-aware cl.5 amendment (R4 AC3). Drive-by (checker-flagged substrate drift, fix in passing): ADR-0078's header still calls ADR-0142 "ratification pending" though it is accepted — a REV-annotated mechanical pointer repair | — | catalog/validator tests, prompt-drift, recapture diff, real-engine cell-placement probe |
| S2 | R6 `CONTAINMENT` validator clause + manifest/suites regen + the `CONTAINMENT` negative fixture (optionally a mark-free valid container fixture) + compat sweep | — | conformance runner, suites-driftwire, corpus/examples sweep |
| S3 | R1 `CardHeader.format` mark + recapture. Drive-by (checker-flagged, fix in passing): `widget.ts`'s "Nothing upstream enforces catalog enum MEMBERSHIP" comment contradicts `conformance.ts`'s shipped ADR-0098 enum check — repair the stale comment | GH #807's component build (ADR-0186 Repairs landed) | catalog tests, prompt-drift, render probe |
| S4 | R8 `structured-container` mini-skill + recapture | S1 + S3 (never teach an unemittable mark) | token-budget/selection tests, recapture diff |
| S5 | R9 corpus exemplar + R6's valid structured-container fixture exercising R1–R4's marks (sequenced here per R6 — it cannot validate before S3) | S3 | admission gates, conformance runner |

S1/S2 are dispatchable now, in parallel; S3 unblocks on the sibling arm; S4/S5 close the loop.

## 7 · Risks & open forks (named, not decided here)

- **ADR-0078 cl.5 amendment (R4)** — the widening adds a wire-enum member + fan-out row, amending
  cl.5's "wire vocabulary is UNCHANGED" claim on ADR-0142's current (accepted) table; the build
  files the Amendment for Kim's ratification (GH #664 mode). If declined, R4 falls back to
  teaching `caption` (graceful, register-approximate) — the idiom survives, fidelity drops.
- **`format` bindability (R1) — RESOLVED, 2026-08-13.** Kim ruled `CardHeader.format` ships
  PATH-BINDABLE (GH #808, "Ruling — 2026-08-13, Kim, in-session confirm"): `bindable: true`,
  accepting that a bound value bypasses the static ADR-0098 enum gate until render time (the
  render-time `applies()` gate in `widget.ts` still enforces membership on every resolution,
  unchanged mechanism). The flip landed exactly as this row's own additive prediction: one catalog
  field (`catalog.json`'s `CardHeader.format`) + baseline recapture, no factory/renderer change —
  S3. R1's own text above now carries the taken ruling as primary; this row is the historical
  trail, not a live fork.
- **Containment hard-fail (R6)** — recommended over taught-only; if the compat sweep (AC2) finds a
  shipped payload relying on a stray region, that finding routes back here before the code lands.
- **`slot` mark creep (R2)** — a future trailing-`Button` ask reopens the scope line as an
  additive intake, not a silent widening.
- **Trigger overlap (R8)** — `structured-container` vs `card-layout` both answer "card"-adjacent
  intents; if selection tests show cross-matching, sharpen triggers before ship.
