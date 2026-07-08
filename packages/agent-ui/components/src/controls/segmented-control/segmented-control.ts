// segmented-control.ts — UISegmentedControlElement, the standalone joined-button single-select control
// (ADR-0095, authored from ADR-0092 §Alternatives-1; supersedes ADR-0086's
// `ui-radio-group[variant='segmented']` — a hard cutover, no alias).
//
// Extends UIRadioGroupElement DIRECTLY (~30 lines, per the ADR's own estimate): 100% of the single-select
// BEHAVIOR — exclusivity, roving focus, selection-follows-focus, the group form value + required→
// valueMissing validity, reset-coherence — lives once in the parent (radio-group.ts). This subclass buys
// only the tag IDENTITY (the T3 ruling's entire point) plus the two things ADR-0095 names as genuinely
// class-derived, both riding PROTECTED hooks the parent exposes for exactly this reuse:
//
//   · `defaultOrientation()` (ADR-0095 clause 1) — this control defaults to a HORIZONTAL row (the parent
//     base class defaults to 'vertical'). Resolved once at connect by the PARENT's `connected()`: an
//     author-set `orientation` attribute still wins.
//   · `selectionChanged(radios, index)` (ADR-0095 clause 2) — the moving-indicator state seam, renamed
//     from ADR-0086's retired `--ui-radio-group-index`/`-count` to `--ui-segmented-control-index`/`-count`
//     (the naming law: `--ui-{name}-*` is owned by the tag it's keyed to). Fired by the PARENT from all
//     three sites its own doc comment names — connect (seed), every selection-apply (`#commit` AND the
//     public `value` setter), and `formReset()` — so the seam tracks commit AND reset (the ADR-0086
//     amendment this class inherits by construction: the call sites did not move).
//
// `#radios()` on the parent walks `instanceof UIRadioElement`, which `UISegmentElement` (below) satisfies
// by construction — no override needed for the group to find its own children. `role='radiogroup'` /
// `role='radio'`, roving-tabindex, `data-radio-group` group-detection: all INHERITED unchanged.
//
// `ui-segment extends UIRadioElement` (ADR-0095 clause 3, `controls/segment/segment.ts`): the naming win T3
// is about — a `ui-radio` child inside `<ui-segmented-control>` would leak "radio" into every consumer's
// markup. `radio.css`'s `@scope (ui-radio)` rules simply don't match the new tag (a feature — `ui-segment`
// needs no dot to suppress); it authors its own small CSS. `ui-segment` lives in its OWN sibling folder,
// NOT this one — the family-coherence naming trip-wire (`name === folder || name.startsWith(folder + '-')`,
// family-coherence.test.ts A4) accepts `radio-group` inside `radio/` (a real prefix match) but rejects
// `segment` inside `segmented-control/` (no prefix relationship: "segment" is not a prefix of "segmented-
// control", nor is "segmented-control-" a prefix of "segment") — a real constraint the radio/radio-group
// precedent's two-descriptors-one-folder shape cannot generalize to. `segmented-control.ts` imports
// `segment.ts` as a side effect below (the `ui-card`/`ui-tabs` compound precedent: a parent that REQUIRES
// its own sub-tag self-defines it too), so importing this ONE public entry self-defines both tags.
//
// Layer: controls/ — imports dom + controls/radio + controls/segment (inward-only ✓).

import { UIRadioGroupElement } from '../radio/radio-group.ts'
import { UIRadioElement } from '../radio/radio.ts'
import type { RovingOrientation } from '../../traits/roving-focus.ts'
import '../segment/segment.ts' // self-defines ui-segment — a segmented control is meaningless without it

export class UISegmentedControlElement extends UIRadioGroupElement {
  /**
   * ADR-0095 clause 1 — the class-derived default: a segmented control defaults to a HORIZONTAL row (the
   * ADR-0086 "variant=segmented ⇒ horizontal" default, now class-derived instead of variant-derived). An
   * author-set `orientation` attribute still wins (resolved by the PARENT's `connected()`).
   */
  protected override defaultOrientation(): RovingOrientation {
    return 'horizontal'
  }

  /**
   * ADR-0095 clause 2 — the moving-indicator state seam. Writes the selected index + segment count as host
   * CUSTOM PROPERTIES (the `--value-pct` precedent, range-element.ts:111 / slider-multi.ts:196–197 —
   * reactive STATE, never a stylesheet injection), read by `segmented-control.css`'s `::before` to size +
   * translate the shared moving fill. `index < 0` (nothing selected) writes `0` — the indicator itself is
   * hidden by CSS whenever no segment is `[checked]`, so the fallback position is irrelevant while hidden.
   */
  protected override selectionChanged(radios: UIRadioElement[], index: number): void {
    this.style.setProperty('--ui-segmented-control-index', String(Math.max(0, index)))
    this.style.setProperty('--ui-segmented-control-count', String(radios.length))
  }
}

if (!customElements.get('ui-segmented-control')) {
  customElements.define('ui-segmented-control', UISegmentedControlElement)
}
