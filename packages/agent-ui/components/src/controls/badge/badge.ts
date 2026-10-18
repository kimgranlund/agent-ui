// badge.ts — UIBadgeElement, the compact-realm's first shipped non-interactive status/label token
// (report-family.lld.md LLD-C7; SPEC-R11…R13; ADR-0111 cl.1/2/3/4/5, fork F3; ADR-0057). Light-DOM
// display leaf — extends UIElement directly (no form participation, no focus, no keyboard contract, no
// events; SPEC-R11): a badge announces via its own real text, nothing else.
//
// Two props: `label` (plain string text) and `intent` (bindable STATUS DATA, unlike Sparkline's
// structural `variant` — ADR-0111 cl.2) — the enum snaps an unknown ATTRIBUTE string back to 'neutral'
// for free (`prop.enum`'s codec, the attribute↔value crossing in dom/props.ts). That codec guard fires
// only on the attribute-string path, though: a raw PROPERTY write (`el.intent = 'bogus'`, the shape a
// `{path}` DATA-MODEL bind actually takes at runtime — ADR-0098's validator sees literals at parse time,
// never a bound value) goes straight through `finalize()`'s generic accessor with no codec involved at
// all. SPEC-R11 AC2 requires the STORED value itself to read back 'neutral' after such a write (not just
// what a render effect happens to clean on the way out) — so the render-boundary hardening idiom
// (sparkline's `cleanSeries`, table's `cleanColumns`/`cleanRows`) is not enough on its own here; this file
// adds one self-correcting `effect` (below) that re-validates `intent` on every change and writes the
// snapped value BACK through the normal reactive setter (which also re-reflects the `[intent]` attribute
// — AC2's second half). It converges in at most one extra microtask (bad → 'neutral' → no further write)
// and uses only the public `this.effect`/`this.intent` surface — no reach into the props.ts internals.
//
// The glyph is a `<ui-glyph>` whose `symbol` follows the intent (INTENT_MARK, intent-mark.ts; T-0351, ADR-0245 cl.5,
// the library marks rather than clip-path polygons). It exists only for a non-neutral intent: built on the
// first one, then kept, so an intent change flips the symbol on the same node and a neutral intent detaches
// it. Colour stays CSS keyed off the reflected `[intent]` host attribute.

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
// Generated from badge.md's `attributes[]` (ADR-0173) — `node scripts/generate-props.mjs badge` to
// regenerate; never hand-edit badge.props.gen.ts. `INTENTS` is the ADR-0173 cl.2 shared-tuple `const:`
// specimen — the SAME exported tuple backs both the `intent` prop's enum codec AND this file's own
// runtime hardening guard below (the closed intent set is now single-sourced in the generated file).
import { INTENTS, props } from './badge.props.gen.ts'
import { createGlyph, type UIGlyphElement } from '../glyph/glyph.ts' // the intent marks are library marks, not pack art (ADR-0245 cl.5)
import { intentMark } from './intent-mark.ts'

export { INTENT_MARK, intentMark } from './intent-mark.ts'

export interface UIBadgeElement extends ReactiveProps<typeof props> {}
export class UIBadgeElement extends UIElement {
  static props = props

  // The glyph part (a ui-glyph, built on the first non-neutral intent) and the label part; held so each is
  // built once EVER (TKT-0067): light-DOM children persist across a disconnect, so a reconnect reuses the
  // SAME nodes instead of re-minting them.
  #glyph: UIGlyphElement | undefined
  #label: HTMLSpanElement | undefined

  protected override connected(): void {
    // Component-side hardening (SPEC-R11 AC2, ADR-0111 cl.2): a bound-garbage `intent` value snaps back
    // to 'neutral' — re-checked on every change, written back through the normal reactive setter so BOTH
    // `el.intent` and the reflected `[intent]` attribute read the sanitized value. Self-converging: the
    // corrective write changes the signal from the bad value to 'neutral', which re-runs this same effect
    // once more, finds 'neutral' valid, and stops (never a tight loop — `intent`'s own change is what
    // re-triggers it, and the second pass is a no-op).
    this.effect(() => {
      if (!(INTENTS as readonly string[]).includes(this.intent)) this.intent = 'neutral'
    })

    // One-time DOM build (LLD-C7), once-EVER behind an idempotent guard (TKT-0067, the parts-once canon): the
    // label carries the announced text and is the one node always present.
    if (this.#label === undefined) {
      this.#label = document.createElement('span')
      this.#label.dataset.part = 'label'
      this.replaceChildren(this.#label)
    }
    const label = this.#label

    // The mark follows the (already hardened) intent. A non-neutral intent places the glyph before the label,
    // building it on first need with its symbol already set (so it draws on connect); a neutral one detaches
    // it, so a plain tag carries no mark node at all. The glyph is decorative: ui-glyph hides itself through
    // ElementInternals, the label alone is announced.
    this.effect(() => {
      const mark = intentMark(this.intent)
      if (mark === undefined) {
        this.#glyph?.remove()
        return
      }
      if (this.#glyph === undefined) {
        this.#glyph = createGlyph(mark)
        this.#glyph.dataset.part = 'glyph'
      } else if (this.#glyph.getAttribute('symbol') !== mark) this.#glyph.setAttribute('symbol', mark)
      if (this.#glyph.parentNode !== this) this.prepend(this.#glyph)
    })

    // The one render effect: real text is the whole announcement (SPEC-R12 AC3) — no internals ARIA is
    // minted at all (no role, no aria-label); the host's accessible name is its own text content.
    this.effect(() => {
      label.textContent = this.label
    })
  }
}

if (!customElements.get('ui-badge')) customElements.define('ui-badge', UIBadgeElement)
