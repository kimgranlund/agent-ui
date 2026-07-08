// segment.ts — UISegmentElement, the child leaf of ui-segmented-control (ADR-0095 clause 3).
//
// Extends UIRadioElement DIRECTLY — adds NO new props, NO new behavior. Everything a segment needs (the
// boolean form value + checked-state machine, pressActivation toggle, the `grouped()` click-guard +
// tabindex-correction hook that finds ITS ancestor via the well-known `[data-radio-group]` marker any
// `UIRadioGroupElement` subclass sets, `static role = 'radio'`) is inherited unchanged; `ui-segmented-
// control`'s parent class (`UIRadioGroupElement`) finds its children via `instanceof UIRadioElement`
// (radio-group.ts's `#radios()`), which this subclass satisfies by construction.
//
// The ENTIRE point of this class existing (T3's naming win) is the TAG, not new behavior: `<ui-segment>`
// inside `<ui-segmented-control>` reads as a segmented control's own vocabulary, never leaking "radio" into
// consumer markup. `radio.css`'s `@scope (ui-radio)` rules do not match `ui-segment` — a feature, not a
// gap: the dot glyph radio.css suppresses in the old segmented variant simply never renders here (there is
// no dot rule to suppress), so `ui-segment` authors its OWN small `segment.css` in THIS folder: a centered
// full-cell flex layout + its own ADR-0009 `:focus-visible` fleet ring. `role='radio'` semantics are
// inherited from the class. (This lives in its own `controls/segment/` folder, not inside
// `controls/segmented-control/` — the family-coherence naming trip-wire's `name === folder ||
// name.startsWith(folder + '-')` rule accepts `radio-group` inside `radio/` but has no prefix relationship
// for `segment` inside `segmented-control/`; see segmented-control.ts's own note.)
//
// Layer: controls/ — imports controls/radio (inward-only ✓).

import { UIRadioElement } from '../radio/radio.ts'

export class UISegmentElement extends UIRadioElement {}

if (!customElements.get('ui-segment')) customElements.define('ui-segment', UISegmentElement)
