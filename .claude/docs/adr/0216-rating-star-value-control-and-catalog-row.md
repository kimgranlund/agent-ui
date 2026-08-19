# ADR-0216 — `ui-rating` + the `Rating` catalog row: an owned star mark, float display / stepped input on one type

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-19 |
> | **Proposed by** | planning-leader (design seat — GH #1372, the classic-widget decision lane #1372/#1373/#1375; ADR number host-assigned) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-19, via the [`ratify ADR-0216` utterance](https://github.com/kimgranlund/agent-ui/issues/1372#issuecomment-5343986310) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | none — new component/catalog intake, no existing doc corrected. On ratification the build wave applies: `a2ui-catalog.spec.md` §5.2 (the drafted row below) · NEW `controls/rating/rating.{ts,css,md}` · `catalog/default/{catalog.json,factories.ts}` · corpus/tier/seed riders per `a2ui-catalog-rendering-review` `catalog-pipeline.md` §5(iii) |
> | **Supersedes / Superseded by** | (none) — composes ADR-0042 (`UIFormElement`)/the `UIRangeElement` base (`controls/_base/range-element.ts`) · relates ADR-0047/0048 (the canonical-value codec law) · relates ADR-0065/0066 (the icons seam this ADR deliberately does NOT consume for the mark) · relates ADR-0019 (the `value:{prop,event}` seam) |

## Context

Rating is ubiquitous on commerce/hospitality surfaces and has zero expression in the catalog:
`Stat` shows a number, not the scale gestalt ("4.3 out of 5 stars" as a filled row), and no input
affordance exists for "rate this" (GH #1372). Four forks were named at intake: display-only vs
two-way input · the value codec (0–5 float? halves?) · the icon dependency (the ADR-0065/0066
pack seam) · the readonly default.

The tree constrains each fork:

- **The value seam.** `Slider` already ships the exact input shape a rating needs: a numeric
  `value` with `min`/`max`/`step`, a `value: { prop: 'value', event: 'change' }` catalog mark
  (`catalog/default/catalog.json`, `Slider` row), and a base class — `UIRangeElement`
  (`controls/_base/range-element.ts`, extends `UIFormElement`) — that owns the numeric value
  model, clamp/snap, `internals.role = 'slider'`, and keyboard stepping.
- **The codec law.** ADR-0047/0048 pin the pattern: the canonical value is the TYPED form (the
  typed number for `percent`, ISO for dates); display formatting is derived, never the canonical.
- **The icons seam.** `star`/`star-half` are in the curated `IconName` vocabulary
  (`icons/src/types.ts`) and `components → @agent-ui/icons` is a sanctioned edge (ADR-0065). But
  `resolveIcon` degrades to an EMPTY `<svg data-icon-missing>` when no pack is registered
  (`icons/src/resolve.ts`) — non-throwing, invisible. Every current consumer uses the seam for
  *affordance* glyphs (a clear button, a caret) where invisibility degrades chrome; a rating's
  mark IS its entire information content.
- **The mark craft.** The chart family (ADR-0107, chart-family.spec.md SPEC-R2/R10) establishes
  the owned-mark discipline for data-encoding visuals: component-built inline SVG, `currentColor`
  ink, a low-alpha fill arm, and an explicit `forced-colors` contract.
- **Event-vs-commit.** PR #1363's Fork T1 proved (by jsdom probe, not assumption) that a control
  whose commit event fires BEFORE its prop commits must NOT carry a value mark — Toggle's
  `toggle` fires pre-commit and shipped without one. Any value mark declared here inherits that
  probe obligation.

## Decision

**We will admit ONE catalog type `Rating` backed by ONE new control `ui-rating`, serving display
and input on the same row: a float `value` rendered fraction-accurately by an OWNED inline-SVG
star mark (no icons-pack dependency), input committed on the `UIRangeElement` clamp/snap model,
with a `value: { prop: 'value', event: 'change' }` mark declared SUBJECT to the build wave's
Fork-T1/D1 event-vs-commit probe, and `readonly` defaulting to `false`.**

1. **One type, both modes.** `Rating` is a form-associated input (the `Slider` posture) whose
   display use is the same row with `readonly: true` and a bound/literal `value`. No separate
   display type: the mark, geometry, and codec are identical in both modes — two rows would
   duplicate a whole contract to encode one boolean.
2. **Value codec (ADR-0047's law).** Canonical = the typed number, a float in `[0, max]`;
   `max` (number, default `5`) and `step` (number, default `1`; `0.5` opts into halves) are
   config. **Display renders fraction-accurately regardless of `step`** — `value: 4.3` paints a
   4.3-star fill (an aggregate score is a float; rounding it to the input granularity would lie).
   **Input commits clamp/snapped to `step`** (the `UIRangeElement` clamp/snap law): pointer and
   keyboard interaction produce `step` multiples in `[0, max]`. The two uses share one codec; only
   the WRITE path quantizes.
3. **The mark is owned SVG, not an icons-pack glyph.** `ui-rating` hand-rolls one star path and
   renders two stacked rows of `max` stars: a base row at the low-alpha `currentColor` fill (the
   sparkline `area` alpha precedent) and a full-ink overlay row clipped to `value/max` of the row
   width (`clip-path: inset(...)`) — fraction-accurate fill with ONE glyph, no `star-half` needed,
   crisp at any size, and it renders on a consumer that never registered an icon pack. A
   `forced-colors` arm is a build requirement (the chart-family SPEC-R10 class): outline in system
   ink, fill distinguishable. A pack-glyph override (`icon` prop through the ADR-0065 seam) is a
   FORESEEN LATER intake, not v1.
4. **Input semantics ride `UIRangeElement`.** `ui-rating` extends the existing base: numeric
   model, clamp/snap, `role = 'slider'` via `ElementInternals`, ArrowUp/Down = `± step`,
   plus pointer pick (click star *k* → `k·step`-snapped). `readonly` is a NEW leaf prop — the
   base declares none (`readonly` is per-leaf today: `text-field.ts:143`, `textarea.ts:51`) — and
   it must INERT the write path (keyboard stepping AND the drag/pointer controller), not only
   announce `aria-readonly`; an announced-but-still-writable readonly would be the lie the
   attribute exists to prevent. The exact readonly ARIA shape is the LLD's.
   Form parity props: `name`/`disabled`/`required`/`label` (the `Slider` row's set).
5. **`readonly` defaults `false`** — input-parity with every shipped form row (`Slider`,
   `Checkbox` default interactive); the corpus/seed wave teaches `readonly: true` as the
   display-case idiom. A value-marked row whose default swallowed input would be the only such
   row in the catalog.
6. **Catalog row + the probe obligation.** The row declares
   `value: { prop: 'value', event: 'change' }` (the `Slider` precedent — `change` is in the
   ruled event vocabulary). **The build wave MUST run the Fork-T1/D1 probe before the row lands**
   (PR #1363's discipline): a jsdom probe proving `change` fires AFTER `value` commits on the
   built control. `UIRangeElement`'s shipped `Slider` mark is strong prior that it passes;
   the probe is still the gate, never the prior. If the probe fails, the row ships display-only
   (bindable `value`, no mark) and this ADR's clause 6 is amended with the probe evidence.

### Drafted SPEC §5.2 delta (UNAPPLIED — lands with the build wave, on ratification)

New row for `a2ui-catalog.spec.md` §5.2:

> | `Rating` | `ui-rating` | **(build wave)** (ADR-0216). Bindable `value` (number — a float in
> `[0,max]`; display renders fraction-accurate fill, input commits clamp/snapped to `step`);
> `max` (number, default 5); `step` (number, default 1 — `0.5` opts into halves); `readonly`
> (boolean, default false — the display-case idiom is `readonly: true` + a bound/literal
> `value`); bindable `label` (string, the accessible name); `name`/`disabled`/`required` (the
> `Slider` form-parity set). `value: { prop: "value", event: "change" }` — declared on the
> Fork-T1/D1 probe evidence (PR #1363's discipline). The mark is an owned inline-SVG star row
> (ADR-0216 cl.3): `currentColor`, low-alpha base + clipped full-ink overlay, no icons-pack
> dependency. **Usage:** a bounded score on a fixed scale — display an aggregate
> (`readonly: true, value: 4.3`) or collect one (`step: 1`, bound value); NOT a general numeric
> input (`Slider`) and NOT a bare metric readout (`Stat`).

## Consequences

- A new control folder + catalog row carries the full §5(iii) rider set (factory, conformance,
  tiers, seeds, prompt-baseline recapture) — priced into the build wave, not this ADR.
- The owned mark means the icons package stays un-consumed here; a product wanting brand glyphs
  (hearts, chilis) waits for the LATER `icon`-prop intake. Accepted: glyph swap is theming, the
  scale gestalt is the contract.
- Fraction-accurate display + stepped input on one prop means a bound display value (4.3) that
  the user then edits commits a SNAPPED value (4.5 or 4.0) — the write path quantizes by design;
  seeds must not present an aggregate score as user-editable (that is `readonly: true`'s job).
- **`change` rides the base's blur-commit law** (`range-element.ts:197-207`, `slider.ts:126`:
  `input` on pointer/drag and keyboard, `change` only on blur when the value moved since focus)
  unless the LLD rules pointer-pick = commit (emit `change` on pointerup). Left on the base law,
  a tap-a-star rating writes the data model only when focus LEAVES the control — a real latency
  consequence for a one-gesture input. The Fork-T1 probe (clause 6) runs against whichever
  commit point the LLD picks; the row's `event: 'change'` mark is unchanged either way.
- `readonly: false` default means an agent that binds `value` for display but forgets `readonly`
  gets user-writable stars mutating the data model — the same exposure `Slider` already has;
  the usage note + corpus seeds carry the mitigation. Rejected mitigation: a `true` default
  (below).
- **Stale → re-verify on land:** `a2ui-catalog.spec.md` §5.2 (apply the drafted row) ·
  `catalog/default/{catalog.json,factories.ts}` + conformance/coverage gates · the
  descriptor↔props trip-wire on `rating.md` · the Fork-T1/D1 probe committed as test evidence.

## Alternatives considered

- **Icons-pack star mark (ADR-0065 seam)** — rejected for the v1 mark: `resolveIcon`'s
  missing-pack degradation is an EMPTY svg, so a pack-less consumer renders a rating with no
  information at all; every existing seam consumer risks only chrome, this one would lose the
  datum. The seam also quantizes fill at the glyph level (`star`/`star-half` = halves only) where
  the clipped-overlay owned mark is fraction-accurate with one path. The seam returns as the
  LATER `icon`-prop override.
- **Two catalog types (display `Rating` + input `RatingInput`)** — rejected: identical mark,
  geometry, and codec; the split doubles rows, corpus seeds, and prompt bytes to encode one
  boolean (`readonly`). The catalog's own precedent for mode-on-one-row is `Slider`'s `disabled`.
- **Halves-only / enum codec (`0 | 0.5 | … | 5`)** — rejected: aggregate scores are floats
  (4.3); an enum canonical forces pre-rounding into the data model, violating ADR-0047's law that
  the canonical is the typed value and DISPLAY derives. Quantization belongs to the write path
  (`step`), not the type.
- **Compose from shipped controls (Stat + Icon row, or Text stars)** — rejected: the issue's own
  gap statement — a composed number or a glyph string has no scale gestalt, no fraction fill, no
  input affordance, and no single bindable value to round-trip (the `mint-vs-compose` bar:
  one keyed value read from and written to the data model → mint).
- **`readonly` default `true`** — rejected: it would make `Rating` the catalog's only value-marked
  row that ignores input by default, and the failure it prevents (accidental writability) is
  already the fleet-wide posture on `Slider`/`Checkbox`; consistency for the producing LLM wins,
  seeds teach the display idiom explicitly.
- **`role='radiogroup'` of star radios (the native-web pattern)** — rejected at the architecture
  altitude: it forfeits the shipped `UIRangeElement` model (clamp/snap, keyboard, slider ARIA)
  and makes halves/fractions unrepresentable as selection state; `role='slider'` announces value
  + range exactly and is what the base already provides. (No native form elements — CLAUDE.md —
  either way.)
