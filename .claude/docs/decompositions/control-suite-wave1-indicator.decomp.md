# Decomp — Control suite Wave 1: Indicator family (ui-checkbox · ui-switch · ui-radio)

> #49 Wave 1. Composes on **Wave 0** (`UIIndicatorElement` ADR-0042 · the `--ui-compact`/`--ui-widget-inset`
> tokens ADR-0041 · the `pressActivation` + `roving-focus`/`selection-commit` traits). Each control is a
> **file-disjoint leaf slice**; ready to fan out the moment Wave 0 lands. · proposed · 2026-06-30 · planning-lead

## Shared pattern (every Indicator leaf)

`class UI{Name}Element extends UIIndicatorElement { static role = '…' }` + a single `{name}.css` (the glyph +
the `--ui-compact` box) + a `{name}.md` descriptor. The base (ADR-0042 / `indicator-element.lld.md`) owns the
boolean value, the `:state(checked)`/`ariaChecked` machine, the toggle (pressActivation), and the geometry
consumption — the leaf provides **role + glyph + (radio) grouping** only. DoD per control = the **G5/G6 control
bar** (below).

## Slices (file-disjoint by exact path; parallel)

### S1 — `ui-checkbox`  (`controls/checkbox/`)
- **Files:** `checkbox.ts` · `checkbox.css` · `checkbox.md` · `checkbox.test.ts` · `checkbox.browser.test.ts`.
- **Leaf scope:** `role='checkbox'`; a **checkmark** mask glyph + an **indeterminate dash** (the `:state(indeterminate)`
  paint); `value` defaults `"on"`; `indeterminate` property (tri-state). No group. The box rides `--ui-compact`
  (square); a leading/label slot is the anatomy (ADR-0006/0012), optional.
- **Probes (jsdom):** `checked`/`indeterminate` round-trip + `formValue()` (checked→`value`, unchecked→null) +
  `:state(checked)`/`:state(indeterminate)` + `ariaChecked` (`true`/`false`/`mixed`) + click/Space toggle (Enter
  does NOT toggle) + disabled-inert + reflected-attr.
- **Browser smoke:** the box = `--ui-compact-{size}` per `[size]×[scale]`; the checkmark renders; checked paint
  + forced-colors (CanvasText ink, the check survives). C10 connect→disconnect zero-residue.

### S2 — `ui-switch`  (`controls/switch/`)
- **Files:** `switch.ts` · `switch.css` · `switch.md` · `switch.test.ts` · `switch.browser.test.ts`.
- **Leaf scope:** `role='switch'`; a **pill track** (`radius = box/2`) + a **thumb** inset `--ui-widget-inset`
  (2px) → `thumb = box − 4px`, sliding on `checked`; boolean only (no indeterminate). The track width is the
  control's inline extent (a pill ~1.8× the box); density-invariant.
- **Probes (jsdom):** `checked` + `formValue()` + `:state(checked)` + `ariaChecked` (`true`/`false`) + toggle +
  disabled-inert.
- **Browser smoke:** the track box = `--ui-compact`; the **thumb = box − 4px (the 2px inset)** measured both
  states; the thumb slide; forced-colors; C10 zero-residue. **⭐ This rendered-px proof RATIFIES ADR-0041**
  (the widget ramp + the `--ui-widget-inset` 2px law) — the switch slice's green gate is the ADR-0041 →
  accepted gate; flag it on the slice.

### S3 — `ui-radio` + `ui-radio-group`  (`controls/radio/`)
- **Files:** `radio.ts` · `radio-group.ts` · `radio.css` · `radio.md` · `radio-group.md` · `radio.test.ts` ·
  `radio-group.test.ts` · `radio.browser.test.ts`.
- **Leaf scope:** `ui-radio` = `role='radio'`, a **dot** glyph in a circular `--ui-compact` box, boolean
  `checked`; `ui-radio-group` = the container owning **single-selection** (`selection-commit` mode=single) +
  **roving-focus** over its `ui-radio` children (Arrow moves selection+focus, exclusive `checked`), the form
  value (the selected radio's `value`), `required`→`valueMissing`. ARIA `radiogroup`/`radio` via internals.
- **Probes (jsdom):** group exclusivity (selecting one clears siblings) + roving (Arrow/Home/End move selection
  + focus) + the group `formValue()` + `valueMissing` (required, none selected) + Space/click commit.
- **Browser smoke:** the dot box = `--ui-compact`; real focus roves the group; checked paint; forced-colors;
  C10 zero-residue.

## Per-control DoD (the G5/G6 control bar — goals.md "~12-element bar")

For each slice: ✓ jsdom probes (above) · ✓ `tsc` clean · ✓ the `{name}.md` frontmatter descriptor +
the **contract↔props trip-wire** (the descriptor's attributes/events/states match `static props`) · ✓ the
**cross-engine browser smoke** (Chromium + WebKit — the box/inset/glyph/checked + `[size]×[scale]×[density]`
+ forced-colors) · ✓ contrast re-validated · ✓ **component-reviewer ≥ 4 on BOTH axes** (COMPOSE · REALIZE) ·
✓ the **gz marginal** recorded in `{name}.md` (`# marginal:` line, `npm run size` delta) within the per-control
tier budget.

## Dependencies + fan-out

- **Blocks on Wave 0:** `UIIndicatorElement` (ADR-0042) + the `--ui-compact`/`--ui-widget-inset` tokens
  (ADR-0041, committed) + `pressActivation` (shipped) + (radio) `roving-focus`/`selection-commit` (Wave 0).
- **File-disjoint:** S1/S2/S3 touch only their own `controls/{name}/` dirs — fully parallel. The barrels
  (`controls/index.ts`, the component-styles barrel) are the integration slice (deferred to the wave boundary,
  the proven method). Each self-gates `npm run check | grep controls/{name}` empty + its own tests; the host
  runs the authoritative whole-tree `check && test` + negative-controls at the boundary, then commits.
- **Maps to:** goals.md **§G6** (checkbox/switch) + extends it (radio). The reviewer DoD per element is the G6
  exit gate.

## Decisions (RULED by the team-lead 2026-06-30)

- **`ui-radio` grouping = a `ui-radio-group` CONTAINER** (ruled). The container is the FACE owner — it owns the
  group form value, the roving, single-selection exclusivity, and `required → valueMissing`; matches ARIA
  `radiogroup`. Standalone name-coordinated radios are rejected (no value owner). S3 builds the container.
- **Optional label slot for checkbox/switch/radio** (ruled). The leading/label/trailing anatomy
  (ADR-0006/0012): `<ui-checkbox>Accept terms</ui-checkbox>` is the ergonomic pattern (label associated via the
  control); a bare box stays possible (the label is optional). Each leaf's `.css`/`.md` carries the optional slot.
