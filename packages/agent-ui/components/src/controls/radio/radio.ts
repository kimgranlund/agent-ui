// radio.ts — UIRadioElement, the radio-button leaf of the Indicator family (Wave 1, S3).
//
// Extends UIIndicatorElement for the boolean form value, the checked-state machine + ARIA (ariaChecked,
// :state(checked)), the toggle via pressActivation + click, and the widget-box geometry seam (LLD-C1..C4).
// The leaf provides: `static role = 'radio'`; the dot glyph in a circular --ui-compact box (radio.css);
// an optional label slot (the default slot); and group coordination via the `grouped()` hook (LLD-C5).
//
// When inside a `ui-radio-group`, the radio:
//   · Prevents clicking an already-checked radio from unchecking it (radio-button semantics: only selecting
//     another radio deselects the current one; the group manages exclusivity).
//   · Emits `change` from the base toggle (unchecked → checked) so the group's delegated listener commits
//     the selection, clears siblings, and updates the group's form value.
// Without a group parent, the radio behaves like a standalone boolean indicator (useful for single-item
// "accept" patterns, though lacking a group value owner; the decomp rules the group as canonical).
//
// Layer: controls/ — imports controls/_base + dom + traits (inward-only ✓).

import { UIIndicatorElement } from '../_base/indicator-element.ts'

export class UIRadioElement extends UIIndicatorElement {
  /**
   * LLD-C2: ARIA role for this leaf — `internals.role` is set by the UIIndicatorElement base
   * from this declaration in `connected()`.
   */
  static role = 'radio'

  /**
   * LLD-C5: group wiring hook — called from `connected()` after all base wiring is in place.
   * When this radio is nested inside a `ui-radio-group`, registers a capture-phase click guard:
   * if the radio is already checked, the click is stopped (via stopImmediatePropagation) before it
   * reaches the base's bubble-phase toggle handler. This enforces the radio-button invariant that a
   * selected radio cannot be deselected by clicking — only by selecting another radio in the group.
   *
   * Without a group parent, this is a no-op and the base toggle runs normally (full checkbox semantics:
   * click toggles unchecked ↔ checked).
   */
  protected override grouped(): void {
    // Detect any UIRadioGroupElement (or subclass) in the ancestor chain via the well-known
    // data attribute marker that UIRadioGroupElement.connected() sets on itself. Using a CSS
    // attribute selector avoids a circular import (radio-group.ts ← radio.ts circular dep) and
    // works with any subclass of UIRadioGroupElement, including probe subclasses in tests.
    const group = this.closest('[data-radio-group]')
    if (!group) return

    // Capture-phase listener: runs BEFORE the base's bubble-phase click → toggle. If the radio is
    // already checked, stopImmediatePropagation cancels all subsequent listeners for this click event
    // (base toggle, group delegation) — the radio stays checked. For unchecked radios, this is a no-op:
    // the base toggle runs normally (sets checked=true, emits input + change), then the change event
    // bubbles to the group for exclusivity + form-value commit.
    this.listen(
      this,
      'click',
      (event) => {
        if (this.effectiveDisabled()) return
        if (this.checked) event.stopImmediatePropagation()
      },
      { capture: true },
    )

    // Tabindex correction: the `tabbable` trait (called earlier in connected()) set tabIndex=0 on
    // this radio. In a group, however, rovingFocus on the group already ran applyTabindexes before
    // each radio's connected() fires (the group connects first, then its children). The tabbable
    // trait overrides rovingFocus's -1 assignments. We correct non-roving radios back to -1 here,
    // AFTER tabbable has run (grouped() is called at the END of connected() — after tabbable).
    //
    // Which radio deserves tabIndex=0? The checked one (matches rovingFocus initialIndex), or the
    // first sibling when nothing is checked. `this === firstOrChecked` → leave at 0; else → -1.
    const siblings = [...group.children].filter(
      // Use the concrete class reference (UIRadioElement is in scope; this is a method body, not a
      // class decorator — no circular-reference issue at call time).
      (el): el is UIRadioElement => el instanceof UIRadioElement,
    )
    const checkedSibling = siblings.find((r) => r.checked)
    const roving = checkedSibling ?? siblings[0]
    if (roving && this !== roving) {
      this.tabIndex = -1
    }
  }
}

if (!customElements.get('ui-radio')) customElements.define('ui-radio', UIRadioElement)
