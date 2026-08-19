// choice-card.ts — UIChoiceCardElement, the rich option unit of the `choice` family (ADR-0220,
// GH #1368). The WHOLE card is the hit target AND the a11y unit — `role=option` + `aria-selected`
// carried through `ElementInternals` (never a host attribute, the fleet ARIA law; the `ui-tab`
// precedent, tab.ts). A card owns NO selection commit of its own (the `Radio`/`RadioGroup`
// precedent): it is a light-DOM content shell an owning `ui-choice-group` (choice-group.ts) roves
// and commits via the `rovingFocus`/`selectionCommit` traits, resolved through ADR-0220 clause 1's
// two additive seams (`itemFromTarget`/`reflectSelected`) — `setSelected()` below is exactly the
// paint hook `reflectSelected` calls, the `ui-tab.setSelected()` shape (tab.ts) ported to `option`.
//
// Content model (ADR-0220 clause 4): children are agent-composed DISPLAY content (Text/Image/Badge/
// Stat/Icon/layout) — `render()` stays the inherited no-op, host-as-content. Interactive descendants
// are non-conforming (ARIA `option` permits none); v1 enforcement is teaching + review tier, named in
// the ADR's own falsifier — this component does not (and structurally cannot) block it.
//
// `disabled` (clause 8, per-card): reflects as a REAL host attribute (not an ARIA concern — the fleet
// convention every reflected boolean form-ish prop already follows, `UIFormElement.formProps`), so
// BOTH `rovingFocus` and `selectionCommit`'s own `isDisabled()` backstops (which read `[disabled]`/
// `aria-disabled` on the item) catch it with zero trait changes — the ADR's own Consequences note.
// The owning group additionally cascades its OWN effective-disabled state onto non-individually-
// disabled cards (choice-group.ts's `#groupDisabledCards`), the `multi-select.ts` precedent.
//
// Layer: controls/ — imports dom only (inward-only ✓). erasableSyntaxOnly ✓. verbatimModuleSyntax ✓.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  // `value` — the option's committed identity key (string). Reflects so `keyOf()` (choice-group.ts)
  // reads it as a plain attribute — the `ui-radio`/`[role=option]` `value` precedent.
  value: { ...prop.string(''), reflect: true },
  // `disabled` — per-card disabled (ADR-0220 clause 8). Reflects for the reasons in the file header.
  disabled: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UIChoiceCardElement extends ReactiveProps<typeof props> {}
export class UIChoiceCardElement extends UIElement {
  static props = props

  protected connected(): void {
    // ARIA via internals — never a host role/aria-* attribute (FACE, the fleet law).
    this.internals.role = 'option'
    // Starts OUT of the tab order (the `ui-tab` precedent, tab.ts): the owning `ui-choice-group`'s
    // `rovingFocus` trait promotes exactly one card to tabindex=0. An ungrouped/standalone card (no
    // owning group ever wires it) simply stays non-interactive — the same "meaningless without a
    // coordinator" posture `ui-tab` documents.
    if (!this.hasAttribute('tabindex')) this.tabIndex = -1
  }

  /**
   * Reflect this card's committed-selected state. Called by the owning `ui-choice-group` BOTH as the
   * `selectionCommit` `reflectSelected` seam (ADR-0220 clause 1, commit-time) AND from the group's own
   * value-keyed re-sync effect (GH #908/#905 — the trait's own reflect is commit-time only; a
   * declarative/programmatic `value`/`values` write needs the SAME paint). Drives `aria-selected` via
   * internals + the `:state(selected)` CSS hook the frame/check-indicator paint keys off.
   */
  setSelected(selected: boolean): void {
    this.internals.ariaSelected = selected ? 'true' : 'false'
    // Optional-chained: jsdom has no CustomStateSet (the real paint is choice-card.browser.test.ts).
    if (selected) this.internals.states?.add('selected')
    else this.internals.states?.delete('selected')
  }
}

if (!customElements.get('ui-choice-card')) customElements.define('ui-choice-card', UIChoiceCardElement)
