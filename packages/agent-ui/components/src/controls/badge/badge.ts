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
// The glyph node is CONSTANT DOM — built once in connected(), never replaced. Every per-intent visual
// difference (shape, color, visibility) is CSS keyed off the reflected `[intent]` host attribute, so an
// intent change (a bound update) is a zero-DOM-churn attribute flip, never a re-render.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

/** The closed intent set (SPEC-R11) — shared between the enum prop and the runtime hardening guard below. */
const INTENTS = ['neutral', 'info', 'success', 'warning', 'danger'] as const

const props = {
  label: { ...prop.string(''), reflect: true },
  // Bindable status data (fork F3): `prop.enum`'s codec snaps an unknown ATTRIBUTE string to 'neutral'
  // for free; the property-write path is hardened separately (see the connected() effect). REFLECTS so
  // `[intent]` CSS keys on JS-set/bound values (the ui-text `variant`/`size` precedent).
  intent: { ...prop.enum(INTENTS, 'neutral'), reflect: true },
} satisfies PropsSchema

export interface UIBadgeElement extends ReactiveProps<typeof props> {}
export class UIBadgeElement extends UIElement {
  static props = props

  // The label part — held so the build below is genuinely once-EVER (TKT-0067): light-DOM children
  // persist across a disconnect, so a reconnect reuses the SAME nodes instead of re-minting them.
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

    // One-time DOM build (LLD-C7), now genuinely once-EVER behind an idempotent guard (TKT-0067: the
    // prior code re-minted both nodes on every connect despite this comment's own "neither node is ever
    // replaced" claim — true within a connection, false across reconnect; the parts-once canon): the
    // glyph is decorative-only (aria-hidden; shape/visibility ride CSS off `[intent]`), the label
    // carries the announced text. Only the label's textContent updates; only the host's `[intent]` flips.
    if (this.#label === undefined) {
      const glyph = document.createElement('span')
      glyph.dataset.part = 'glyph'
      glyph.setAttribute('aria-hidden', 'true')
      this.#label = document.createElement('span')
      this.#label.dataset.part = 'label'
      this.replaceChildren(glyph, this.#label)
    }
    const label = this.#label

    // The one render effect: real text is the whole announcement (SPEC-R12 AC3) — no internals ARIA is
    // minted at all (no role, no aria-label); the host's accessible name is its own text content.
    this.effect(() => {
      label.textContent = this.label
    })
  }
}

if (!customElements.get('ui-badge')) customElements.define('ui-badge', UIBadgeElement)
