// suggestions.ts — UISuggestionsElement, the one-shot follow-up/next-prompt chip set (ADR-0213, GH #1393).
// A leaf (no ChildList — ADR-0213 cl.1): `suggestions` is DATA, never children, so the component builds
// its own chip DOM from the array, the `ui-stat`/`ui-description-list` whole-swap shape (ADR-0201's own
// precedent, reused verbatim: cleanSuggestions hardens on the way IN, at both the attribute codec AND
// again inside the render effect — the description-list.ts "case-3 property-write guard").
//
// Extends UIElement, NOT UIFormElement (ADR-0213 cl.2's `value:{prop:'selected',event:'select'}` two-way
// slot needs only `{prop,event}` — the table.md precedent for the identical shape: "no name/value pair,
// no validity/reset semantics apply; ADR-0161's two-way seam needs only {prop,event}", table.md:148).
// `selected` is the taken suggestion's `value` string; `''` means live/untaken.
//
// One-shot law (ADR-0213 cl.3), built into the type: non-empty `selected` renders the set SPENT — every
// chip (the taken one included) goes `disabled` (a REAL native `<button disabled>`, ADR-0163's own
// "internal native-part" precedent — `select.ts`'s `<button data-part="trigger">` / `table.ts`'s
// `<button data-part="sort-button">` — a plain activation part, not the sanctioned checkbox/radio
// exception table.md:43-47 reserves for VALUE-carrying inputs), so real pointers AND keyboard both go
// inert for free (the platform's own disabled-button semantics: no click ever dispatches, no tab stop).
// The taken chip stays visible (`[data-taken]` + `aria-pressed="true"`) — the history record must show
// what was offered AND taken (ADR-0213's "Alternatives considered" — chips never vanish on selection).
// `disabled` is a GETTER only — fully DERIVED from `selected`, never an independent author lever (the
// one-shot law owns this state completely) — and also reflects as a real host attribute so the renderer's
// GH #1164 disabled-guard (`el.disabled === true`, read as a plain JS property) sees it, and so
// `suggestions.css` can key off `[disabled]` like every other fleet control.
//
// Keyboard: every chip is a REAL native `<button type="button">` in the NORMAL tab order — Enter/Space
// activation is the platform's own native button activation (table.md's keyboard note, applied per-chip
// here); no `pressActivation`/`tabbable` trait is needed, and none is used.
//
// Commit: a real chip click (delegated at the host, since the whole-swap effect recreates every chip on
// every `suggestions`/`selected` change — attaching one listener per rebuild would leak) writes `selected`
// then emits `select` — NEVER fired by a programmatic `selected` write (the table.ts `#commitSelected`
// fleet commit law, reused verbatim).
//
// Layer: controls/ → dom only (inward-only ✓). erasableSyntaxOnly ✓ (no enum/decorator). verbatimModuleSyntax ✓.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { cleanSuggestions, suggestionsProp, type SuggestionItem } from './suggestions-model.ts'

const props = {
  // {label:string, value?:string}[] — bindable (a2ui `mapsTo:'suggestions'`, catalog-layer concern, out
  // of this control's scope); hardened both paths, never throws, never renders a label-less chip
  // (ADR-0213 cl.2, the ADR-0201 idiom).
  suggestions: suggestionsProp,

  // The value mark (ADR-0213 cl.2) — the taken suggestion's `value` string; `''` = live/untaken.
  // Reflected so `<ui-suggestions selected="…">` works declaratively AND a two-way data bind
  // (`value:{prop:'selected',event:'select'}`) can read it back off the attribute (the `select.ts`
  // `value` prop precedent).
  selected: { ...prop.string(''), reflect: true },
} satisfies PropsSchema

export interface UISuggestionsElement extends ReactiveProps<typeof props> {}
export class UISuggestionsElement extends UIElement {
  static props = props

  /**
   * ADR-0213 cl.3 — fully DERIVED from `selected`: non-empty ⇒ the set is spent. Read-only by design
   * (getter, no setter) — there is no independent author lever; the one-shot law owns this completely.
   * The renderer's GH #1164 disabled-guard reads this as a plain JS property (`el.disabled === true`),
   * so the getter — not merely the reflected attribute — is the load-bearing half.
   */
  get disabled(): boolean {
    return this.selected !== ''
  }

  protected override connected(): void {
    // Delegated at the host — the render effect below REPLACES every chip on each `suggestions`/
    // `selected` change, so a per-chip listener would leak; one listener survives every rebuild.
    this.listen(this, 'click', (event) => this.#onClick(event))

    this.effect(() => {
      const items = cleanSuggestions(this.suggestions) // re-harden on the way in (property-write guard)
      const selected = this.selected
      const spent = selected !== ''

      // The host-level half of the one-shot law: reflect `disabled` so CSS (`[disabled]`) and the
      // renderer's plain-property guard both see it. `ariaDisabled` mirrors it for AT users landing on
      // the host itself (individual chips carry their OWN native disabled state below).
      this.toggleAttribute('disabled', spent)
      this.internals.ariaDisabled = spent ? 'true' : null

      this.replaceChildren(...items.map((item) => this.#chip(item, selected, spent)))
    })

    // Motion gate (interaction-states standard) — flip `ready` ONE FRAME PAST first paint (the
    // button.ts precedent), so the upgrade/first-paint styling snaps in and only later hover/active
    // changes animate. Optional-chained: jsdom has no CustomStateSet.
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  /** One `<button type="button" data-part="chip">` per surviving suggestion — a plain internal
   *  activation part (NOT the table.md checkbox/radio "sanctioned exception"; the select.ts trigger /
   *  table.ts sort-button precedent for a non-value-carrying native part). Native `disabled` gives
   *  pointer + keyboard inertness for free once the set is spent. */
  #chip(item: SuggestionItem, selected: string, spent: boolean): HTMLButtonElement {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.setAttribute('data-part', 'chip')
    chip.dataset.value = item.value
    chip.textContent = item.label
    const taken = item.value === selected
    chip.setAttribute('aria-pressed', taken ? 'true' : 'false')
    if (taken) chip.setAttribute('data-taken', '')
    chip.disabled = spent
    return chip
  }

  /** The ONE commit path (table.ts `#commitSelected` fleet commit law): a real chip click only — never a
   *  programmatic `selected` write. Defensive re-guard against `this.selected` (the native `disabled`
   *  attribute already blocks this in every real engine; jsdom does not enforce it on a plain `<button>`
   *  the same way, so the guard is load-bearing there too). */
  #onClick(event: Event): void {
    if (this.selected !== '') return // spent — the one-shot law
    const target = event.target
    if (!(target instanceof Element)) return
    const chip = target.closest<HTMLButtonElement>('[data-part="chip"]')
    if (!chip || !this.contains(chip) || chip.disabled) return
    const value = chip.dataset.value
    if (!value) return
    this.selected = value
    this.emit('select', value)
  }
}

if (!customElements.get('ui-suggestions')) customElements.define('ui-suggestions', UISuggestionsElement)
