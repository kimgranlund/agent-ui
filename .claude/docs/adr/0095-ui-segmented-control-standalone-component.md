# ADR-0095 — `ui-segmented-control` becomes a standalone first-class component (supersedes the ADR-0086 variant architecture)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07 *(authored — from Kim's T3 ruling on the ADR-0092 fork; built from ADR-0092 §Alternatives-1 as that record instructs for exactly this outcome)*
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 |
> | **Proposed by** | planner (the design seat) — authoring the supersession ADR-0092's Decision clause 3 pre-booked: "*If a reopen trigger fires, the supersession ADR starts from that design*". The fired trigger is **T3** (ADR-0092 clause 4): Kim ruled the tag itself IS the requirement (2026-07-07). Per 0092's Acceptance standing rule, a supersession must cite its fired trigger — this ADR does. |
> | **Ratified by** | Kim (host) · 2026-07-08 — Status flipped by Kim's own edit in the pre-merge ratification rounds (landed `96a0778`); the ADR-0086 → `superseded` flip was honored. Cell was stale-pending until the 2026-07-08 housekeeping pass |
> | **Repairs** | **This pass (docs only, no source):** ADR-0092's disposition (Status → `superseded`, forward link) · ADR-0086's reciprocal `Superseded by ADR-0095 (pending ratification)` back-link (Status untouched until ratification — the 0016←0087 in-flight precedent) · the `README.md` index rows for 0086/0092/0095 · decomp [`segmented-control-supersession.decomp.json`](../decompositions/segmented-control-supersession.decomp.json). **On ratification+build (the ~1.5–2 day wave; the builders land these with the code):** NEW `controls/segmented-control/*` (class + segment + CSS + descriptors) · `controls/radio/{radio-group.ts,radio-group.css,radio-group.md,radio-group.test.ts}` (variant retirement + the protected post-selection hook; `orientation` and the per-orientation keyboard table STAND; `radio-group.test.ts`'s ADR-0086 variant/orientation `describe` block retired/migrated) · `catalog.json` (`RadioGroup.variant` retired, `catalog.json:233`; NEW `SegmentedControl` type) + `factories.ts` + catalog/conformance/prompt-drift tests · `site/lib/component-preview.ts` knob builder · the two segmented browser suites (re-keyed) · components `package.json` exports + the ADR-0080 marginal pin · `dimensions.css:76` doctrine comment re-point · ADR-0086's Status flip + this log's rows. |
> | **Supersedes / Superseded by** | **Supersedes ADR-0086** — its Decision ("a presentation variant on the existing group, **not a new component**") reverses; its *visual, interaction, geometry, motion, and a11y design* (clauses 3–8) is **carried over normatively**, re-keyed onto the new tag — the supersession changes the control's *identity*, not its *design*. **Supersedes ADR-0092** (proposed, never accepted — overtaken unratified per its own §Consequences T3 branch: "*this ADR is discarded unratified*"; marked `superseded`, forward-linked; its §Alternatives-1 is this ADR's substrate). Relates **ADR-0074/0078** (the hard-cutover no-alias precedent this follows) · **ADR-0080** (per-control exports + leave-one-out marginal) · **ADR-0081** (family-coherence + `attributes[]`↔props trip-wires) · **ADR-0077/0079** (the gallery derives members 1:1 from descriptor tags — the mechanism that makes this promotion self-documenting) · **ADR-0087** (whole-fleet catalog scope; its Fork B RadioGroup/Radio adjacency answer shapes the `SegmentedControl` child model) · **ADR-0009** (focus ring, re-declared for `ui-segment`) · **ADR-0048/0058** (`--md-sys-color-primary-selected` fill) · **ADR-0057** (fill-presence non-color signifier) · **ADR-0036/0038** (control line-height / `[scale]` re-tabling) — all inherited via the moved CSS. |

## Context

ADR-0092 answered Kim's "ui-segmented-control: should be its own component" intake with a recommendation
(pattern-name positioning, architecture unchanged) **and** a recorded fork it explicitly could not pre-empt:
**T3 — "Kim rules the tag itself is the requirement — an API-surface taste ruling … it stays live at
ratification."** On 2026-07-07 Kim ruled exactly that: `ui-segmented-control` is to be a genuine standalone
component, not a variant spelling. T3 has fired — the one condition under which 0092's own Consequences
direct: "*the correct record is a supersession ADR built from §Alternatives 1 … and this ADR is discarded
unratified.*" This ADR is that record, and this is its fired-trigger citation (0092's Acceptance made an
uncited supersession out of order).

The constraint the ratified design cannot satisfy is now precise: **the control's public identity must be a
tag.** ADR-0086's behavioral-identity claim still holds — 0092 re-verified it against the shipped code one
day after ratification (exclusivity, roving, commit, group value/validity, reset-coherence all live once in
`radio-group.ts`), and nothing here disputes it. What the variant architecture cannot deliver, by
construction, is a *findable first-class name*: the gallery derives its members 1:1 from descriptor `tag:`
scalars (`component-gallery.ts:44–60`), the a2ui catalog speaks in per-control types, and the fleet's owner
himself read the shipped surface as a control the fleet doesn't name. 0092 offered docs-positioning as the
cheap mitigation; Kim's ruling rejects mitigation in favor of the real thing. The ruling is an API-surface
judgment only the fleet's owner can make — this ADR does not re-litigate it; it executes it well.

§Alternatives-1 of ADR-0092 is the fully-costed promotion design this ADR builds from. Its `file:line`
mechanics were **re-verified against the working tree today (2026-07-07)**: the state seam `#writeIndexCount`
is a private method at `radio-group.ts:202`, invoked from `connected()` (`:94`), the selection-apply path
(`:229`), and `formReset()` (`:304`); the segmented CSS lives as the token block `[3]` + compound-selector
block `[4]` in `radio-group.css` (224 lines); `catalog.json:233` carries the `RadioGroup.variant` enum;
`#radios()`'s `instanceof UIRadioElement` walk (`radio-group.ts:181–185`) explicitly anticipates subclasses;
both segmented browser suites exist (`radio-group-segmented.browser.test.ts`,
`component-preview-radio-segmented.browser.test.ts`); `dimensions.css:76` names the radio-group indicator in
the motion doctrine. The builder re-verifies at build — the design is a head start, not a frozen spec
(0092's own aging warning, inherited).

## Decision

We will build **`ui-segmented-control` as a standalone first-class component** and **retire
`ui-radio-group[variant=segmented]`** in the same wave — a **hard cutover**: no alias, no dual-support
window, zero-survivor grep (the ADR-0074/0078 precedent; this forecloses 0092 §Alternatives-3's
two-spellings failure, the one outcome every party agreed is worst). ADR-0086's rendering and interaction
contract (its clauses 3–8: grid of equal cells, the single translated `::before` indicator, motion +
reduced-motion, Pattern-class geometry, interaction states, forced-colors inversion, per-orientation
APG-correct keyboard, the commit-AND-reset state seam) **carries over normatively, byte-equivalent** — only
the host tag, child tag, and token names change. Seven clauses:

1. **Identity & class.** NEW `UISegmentedControlElement extends UIRadioGroupElement` in
   `controls/segmented-control/` (~30 lines: the behavioral reuse §Alternatives-1 priced as "genuinely
   small"). `variant` **retires from `groupProps`** — `ui-radio-group` returns to its dot-only presentation
   surface. `orientation` **stays on the group** (0086's own Alternatives argued it is a group-level concern
   the dot variant also benefits from; its roving-axis wiring and the per-orientation keyboard-table repair
   stand). The subclass defaults `orientation` to `'horizontal'` via the same resolve-once-and-reflect-at-
   connect mechanism (0086 clause 1) — now class-derived instead of variant-derived; the base keeps
   `'vertical'`.
2. **The parent seam refactor (the recorded cost, paid deliberately).** `#writeIndexCount` serves only the
   segmented indicator, so it **moves down** — but it is private and fired from three parent-internal sites
   (`connected():94`, the selection-apply path `:229`, `formReset():304`). Mechanism: mint a **protected
   post-selection hook** on `UIRadioGroupElement` (a no-op in the base, e.g.
   `protected selectionChanged(radios, index): void {}`) called from all three sites;
   `UISegmentedControlElement` overrides it to write **`--ui-segmented-control-index` / `-count`** (the
   naming-law-correct rename §Alternatives-1 identified as "refactoring the parent class's seam, not just
   CSS"). The 0086-Amendment contract — the seam fires on **commit AND form reset** — is the hook's contract,
   preserved by construction since the call sites don't move.
3. **Children: NEW `ui-segment extends UIRadioElement`.** The naming win is the point of T3; `ui-radio`
   children inside `<ui-segmented-control>` would leak "radio" into every consumer's markup (rejected below).
   `#radios()`'s `instanceof` walk matches the subclass by construction (`radio-group.ts:181–185` says so in
   its own docstring). `radio.css` is **not re-keyed**: its `@scope (ui-radio)` rules simply don't match the
   new tag — which is a feature, not the cascade §Alternatives-1 feared: `ui-segment` needs no dot to
   suppress and authors its **own small CSS** (centered full-cell flex, its own ADR-0009 `:focus-visible`
   fleet ring, `role=radio` semantics inherited from the class).
4. **The CSS moves, re-keyed.** The segmented blocks (`radio-group.css` `[3]`/`[4]`) move to
   `controls/segmented-control/segmented-control.css`: tokens declared in `:where(ui-segmented-control)` as
   `--ui-segmented-control-*` (sole declarer — the family-coherence gate's own law), consumed on
   `ui-segmented-control` / `ui-segmented-control ui-segment` selectors. Every computed value 0086's
   Acceptance enumerated (equal 1fr cells, `100%/count` indicator sizing, `transform`-only placement,
   `--ui-motion-fast` + reduced-motion jump, Control-height ramp with `h/2` inline pad and `line-height 1`,
   hover/active washes, `Highlight`/`HighlightText` forced-colors inversion) re-targets the new selectors
   **unchanged**. `radio-group.css`'s reserve comments are restored to their pre-0086 truth.
5. **Fleet surface (the real bill, accepted).** Descriptors `segmented-control.md` + `segment.md`; barrel
   registration; `package.json` exports entries (`"./controls/segmented-control"`, `"./controls/segment"` —
   the radio/radio-group two-entry precedent) + the ADR-0080 leave-one-out marginal pin (measure first, then
   pin); the `attributes[]`↔props trip-wire and the family-coherence gate (ADR-0081) pass for both new tags;
   both-engine browser suites re-keyed from the shipped segmented suites. The gallery member arrives
   **automatically** from the descriptor (ADR-0077/0079) — the discoverability gap 0092 documented dissolves
   at the root, so 0092's clause-1 docs-positioning slice is moot and **must not also be built**.
6. **a2ui wire.** NEW `SegmentedControl` catalog type + factory + conformance + derived-prompt inventory;
   the `RadioGroup.variant` enum member **retires** (`catalog.json:233`) — one spelling on the wire too.
   The child model follows the ADR-0087 Fork B (RadioGroup/Radio adjacency) resolution when that ADR
   ratifies; until then the factory mirrors whatever shape `RadioGroup` ships today. The corpus is grepped
   for segmented exemplars at build (0092 recorded the negative; re-verify).
7. **Migration, one wave.** `site/lib/component-preview.ts`'s knob builder emits
   `<ui-segmented-control>`/`<ui-segment>`; `radio-group.md` drops its `variant` rows and segmented prose
   (keeping `orientation` + the per-orientation keyboard table); `dimensions.css:76` re-points its indicator
   example; zero-survivor greps gate the cutover (`variant="segmented"`/`variant='segmented'` outside
   `.claude/docs` history · `--ui-radio-group-index`/`-count` · the catalog enum member). The new control and
   the variant retirement land in **the same change** — no window in which two spellings are live.

Estimate: **~1.5–2 days across component-builder + a2ui-builder + site seats** (§Alternatives-1's costing,
unchanged). Build slices + gates: the Phase-B leaves of
[`segmented-control-supersession.decomp.json`](../decompositions/segmented-control-supersession.decomp.json)
(coverage-clean, plan-mode).

## Consequences

- **The wave buys the tag name; behavior is byte-identical by construction.** ~1.5–2 days of multi-seat work
  whose entire user-visible delta is identity — the honest price 0092 recorded, now accepted by ruling
  rather than argued around.
- **API churn on a one-day-old shipped surface.** `ui-radio-group` loses `variant`; the a2ui vocabulary
  churns (`RadioGroup.variant` retires, `SegmentedControl` lands) one day after shipping — exactly the churn
  0092 warned about. Accepted deliberately: better one clean cut now, while the variant has a handful of
  first-party consumers and a corpus negative, than after external consumers accrete.
- **Not all of 0086 is discarded.** Its design survives wholesale (the moved CSS + the carried-over
  acceptance), `orientation` + the roving-axis wiring + the keyboard-table drift-fix stand on the group, and
  the state-seam-on-reset amendment becomes the hook's contract. The supersession reverses one sentence of
  its Decision — "not a new component" — and keeps the rest as the new component's spec.
- **`ui-radio-group` gains a small permanent protected hook** — a real API-surface widening of a shipped
  base class in service of one subclass. The alternative (leaving the seam private and duplicating the
  three call sites in the child) forks the commit path 0086 proved must live once; the hook is the smaller
  scar.
- **`ui-segment` re-declares a little of `radio.css`** (the focus ring, the centered-cell frame) instead of
  inheriting it — a bounded duplication accepted to keep `radio.css` untouched and the segment's CSS
  self-contained.
- **Drift risk lives in the build window, not the end state.** Two spellings must never be simultaneously
  public — the single-wave cutover + zero-survivor greps are the guard; a partial landing is the one way
  this ADR reproduces the failure it forecloses.
- **0092's T1/T2 triggers are moot** (T3 fired first). T1's substance survives as a fact about the future:
  a *multi-select* segmented control is not a radio group and will be a separate component regardless of
  this promotion — this ADR does not pre-buy it.
- **The recorded design still ages.** The `file:line` facts were re-verified 2026-07-07 against the working
  tree; the builders re-verify at build (three of the cited files are mid-flight in the current working
  tree).
- **Stale → re-verify:** `controls/radio/{radio-group.ts,radio-group.css,radio-group.md}` · NEW
  `controls/segmented-control/*` · `catalog.json` + factories/conformance/prompt tests ·
  `site/lib/component-preview.ts` + both segmented browser suites · components `package.json` +
  `measure-size` pins · `dimensions.css:76` · ADR-0086/0092/README rows.

## Acceptance

- **This pass (docs only):** `adr_check.py` exit 0 on this file; ADR-0092's Status cell reads the bare
  `superseded` with the forward link to this ADR (substance untouched); ADR-0086 carries the reciprocal
  `Superseded by ADR-0095 (pending ratification)` note in its *Supersedes / Superseded by* row while its
  Status cell stays `accepted` (the flip is the ratifier's act); the README index rows for 0086/0092/0095
  are updated; `coverage_check.py segmented-control-supersession.decomp.json` exit 0; **no file outside
  `.claude/docs/` is touched** (`git diff --name-only`).
- **On ratification+build (the wave's exit gates; per-slice gates in the decomp):** `ui-segmented-control` +
  `ui-segment` registered, descriptor-derived gallery member present; the re-keyed both-engine browser
  acceptance — ADR-0086's Acceptance list re-targeted verbatim onto the new tags/tokens — green; the
  zero-survivor greps of clause 7 empty; exports entries + pinned marginals (ADR-0080) in budget;
  family-coherence + `attributes[]` trip-wires green for both new tags; catalog/factory/conformance/
  prompt-drift gates green with `RadioGroup.variant` gone; `npm run check && npm test` green; ADR-0086
  flipped to `superseded` by the ratifier.

## Alternatives considered

- **Keep the variant + docs positioning (ADR-0092's recommended path)** — overruled, not refuted: the
  evidence 0092 assembled (behavioral identity, the ~half-day docs fix, zero migration) stands in its record
  and was weighed. T3 was always the recorded exception — "an API-surface taste ruling this ADR cannot
  pre-empt" — and the fleet's owner made it. Executing the ruling half-heartedly (docs now, tag later) would
  just pay both bills.
- **`ui-radio` children inside `ui-segmented-control`** — rejected: preserves `radio.css` reuse but leaks
  "radio" into every consumer's markup, halving the naming win the ruling is *about*, and drags the variant's
  compound-override CSS (dot suppression, display re-points) into the new control. The bounded cost of
  `ui-segment`'s own small CSS is the better trade.
- **Tag alias / dual-support (ship the tag AND keep the variant)** — rejected outright, unchanged from 0092
  §Alternatives-3: two public spellings of one control is the permanent sync/drift failure plus a doubled
  a2ui vocabulary. Worse than either clean branch; hard cutover per ADR-0074/0078.
- **A fresh no-subclass implementation** — rejected: duplicates the exact machinery two ADRs have now proven
  shared (exclusivity, roving, selection-follows-focus, value model, `required→valueMissing`, reset
  coherence) and invites the drift 0086 chose the variant to avoid. The subclass keeps one behavioral home
  with a tag-level identity.
- **`_base/` extraction (the ADR-0042/0093 leaf-over-base pattern)** — not chosen up front: extraction earns
  its cost when the *value shape forks under a flag* (calendar-range) or the parent can't remain a valid
  public leaf; here the value model is identical and `ui-radio-group` stays shipped as-is. Named as the
  **escalation path**: if the protected-hook seam or the import-layering trip-wire fights the direct
  subclass at build, the builder escalates to extracting a `_base/` single-select-group rather than forcing
  it — a build-time re-verify point, not a fork for Kim.
