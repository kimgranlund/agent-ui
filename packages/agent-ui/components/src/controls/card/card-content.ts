// card-content.ts — UICardContentElement, the card's body region (decomp g9-containers slice s7; one folder,
// one writer with card.ts). PROP + self-define + the scroll-fade wiring; the layout + the scroll CSS + the mask
// PAINT live in card.css / the shared container-box.css (traits/scroll-fade.ts).
//
// The body region SUB-ELEMENT of `ui-card` — the default-children container (NO leading/label/trailing
// anatomy; it is plain flow content). It extends `UIContainerElement` (NOT form-associated). It carries ONE
// reflected boolean prop:
//   • `scrollable`  — a SIGNAL that puts the CARD into scroll mode (Kim, 2026-07-05: "the whole container
//     should scroll"). `<ui-card-content scrollable>` (the A2UI-mapped signal) — OR the ergonomic parent
//     `<ui-card scrollable>` — makes the CARD ITSELF the scroll viewport (card.css: `overflow-y:auto` + sticky
//     header/footer), so the whole container scrolls as one with the brackets pinned. This region does NOT
//     scroll its own overflow (that was the superseded content-viewport model, which trapped the scroll in the
//     middle region). It requires a CONSTRAINED card block-size to bite (a `max-block-size`/`height` on the
//     card, or a bounded flex/grid parent) — documented in card.md. Named `scrollable` (NOT `scroll`)
//     deliberately: a `scroll` prop would shadow the inherited native `Element.prototype.scroll()` method — a
//     `scroll: boolean` accessor collides with the method type (TS 2320/2416). `scrollable` has no native
//     collision, so it is a fully-typed reflecting prop.
//
// The EDGE-AWARE `mask-image` fade (Kim, 2026-07-04/05) is AUTOMATIC in scroll mode — no opt-in prop. It paints
// on the CARD viewport: `scrollFade(this, { viewport: card, enabled })` wires `traits/scroll-fade.ts` in
// `connected()` targeting the PARENT CARD (the scroll viewport), toggling `data-fade-top`/`data-fade-bottom`
// from the live scroll position for container-box.css's generic mask rules. Wired from HERE, not card.ts, so it
// installs AFTER this region has connected (the card already exists as our parent). The trait's presence-aware
// offsets measure the card's sticky ui-card-header/-footer, so the fade ramps PAST the brackets and never
// blanks them. The mask self-gates on ACTUAL overflow (scroll-fade.ts), so a short non-scrolling card never fades.
//
// The prop REFLECTS so the attribute selectors apply to JS-set values too. `render()` stays the inherited void.
// `controls → dom + traits` is the allowed direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'
import { scrollFade } from '../../traits/scroll-fade.ts'

const props = {
  // presence semantics: `<ui-card-content scrollable>` → a SIGNAL that puts the parent CARD into scroll mode (the
  // card becomes the viewport; this region does NOT self-scroll). See connected() + card.css's scroll-mode block.
  scrollable: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UICardContentElement extends ReactiveProps<typeof props> {}
export class UICardContentElement extends UIContainerElement {
  static props = props

  protected connected(): void {
    // The CARD is the scroll viewport (Kim, 2026-07-05: "the whole container should scroll"), so the edge-fade
    // mask + the scroll listener target the PARENT CARD, never this region. Wired from HERE (not card.ts) so it
    // installs after this region has connected: the card exists as our parent, and the trait's presence-aware
    // offsets can measure the card's sticky ui-card-header/-footer. Arm the fade whenever the card is in scroll
    // mode — this region's own `[scrollable]` (the A2UI-mapped signal, reactive via `this.scrollable`) OR the
    // ergonomic `<ui-card scrollable>` on the parent (read once — a region does not change cards mid-session).
    // The mask self-gates on real overflow (scroll-fade.ts), so a non-scrolling card never fades. Standalone
    // (no ui-card parent) falls back to `this` — inert without a card scroll viewport, which is intended.
    const card = this.parentElement
    const onCard = card instanceof HTMLElement && card.tagName === 'UI-CARD'
    const viewport = onCard ? (card as HTMLElement) : this
    const inScrollMode = (): boolean => this.scrollable || (onCard && (card as HTMLElement).hasAttribute('scrollable'))
    scrollFade(this, { viewport, enabled: inScrollMode })
  }
}

if (!customElements.get('ui-card-content')) customElements.define('ui-card-content', UICardContentElement)
