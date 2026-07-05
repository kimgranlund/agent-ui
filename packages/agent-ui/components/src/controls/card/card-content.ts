// card-content.ts — UICardContentElement, the card's body region (decomp g9-containers slice s7; one folder,
// one writer with card.ts). PROP + self-define + the scroll-fade wiring; the layout + the scroll CSS + the mask
// PAINT live in card.css / the shared container-box.css (traits/scroll-fade.ts).
//
// The body region SUB-ELEMENT of `ui-card` — the default-children container (NO leading/label/trailing
// anatomy; it is plain flow content). It extends `UIContainerElement` (NOT form-associated). It carries ONE
// reflected boolean prop:
//   • `scrollable`  — a SIGNAL that puts the CARD into scroll mode (Kim, 2026-07-05: "the whole container
//     should scroll"). `<ui-card-content scrollable>` (the A2UI-mapped signal) — OR the ergonomic parent
//     `<ui-card scrollable>` — arms it. Named `scrollable` (NOT `scroll`) deliberately: a `scroll` prop would
//     shadow the inherited native `Element.prototype.scroll()` method — a `scroll: boolean` accessor collides
//     with the method type (TS 2320/2416). `scrollable` has no native collision, so it is a fully-typed
//     reflecting prop.
//
// REVISED 2026-07-07 (Kim, verbatim: "<ui-card-content> should have the mask and manage overflow, and adjust
// block-padding and linear gradient coordinates based on presence of the peer footer and header. it should be
// set to use 100% of its parent height when [scrollable]") — SUPERSEDES the short-lived WRAPPER MODEL
// (2026-07-06): no more author-written `[scroll-wrapper]` child, no more read-once detection, no more childList
// heal (all retired — nothing left to detect). THIS region is now directly the scroll viewport AND the masked
// element, one box: card.css gives it `overflow-y: auto` + `flex: 1 1 auto` (the mechanism realizing "100% of
// parent height" against a card whose own block-size is only `max-block-size`-bounded — see card.css's banner)
// while the card's header/footer become OVERLAID peers (`position: absolute`, no longer in flow, no longer
// competing for column space) — so content is the card's SOLE flex item, filling the whole column.
//
// `viewport` therefore collapses to `this` (the trait's own default — no override needed at all); only
// `brackets` still needs to differ, since the header/footer live on the CARD (one level up), not on `this`.
// `scrollFade(this, { brackets, enabled })` wires `traits/scroll-fade.ts` in `connected()` — the mask self-gates
// on ACTUAL overflow, so a short non-scrolling card never fades. The published `--ui-box-head`/`--ui-box-foot`
// bracket bands now drive BOTH the gradient offset (container-box.css, unchanged) AND this region's own
// block-padding (card.css) — one measured source, two consumers, per Kim's ask.
//
// The prop REFLECTS so the attribute selectors apply to JS-set values too. `render()` stays the inherited void.
// `controls → dom + traits` is the allowed direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'
import { scrollFade } from '../../traits/scroll-fade.ts'

const props = {
  // presence semantics: `<ui-card-content scrollable>` → a SIGNAL that puts the parent CARD into scroll mode (this
  // region becomes the scroll viewport). See connected() + card.css's scroll-mode block.
  scrollable: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UICardContentElement extends ReactiveProps<typeof props> {}
export class UICardContentElement extends UIContainerElement {
  static props = props

  protected connected(): void {
    // `brackets` is ALWAYS the card (its direct children are the real header/footer) — standalone (no ui-card
    // parent) falls back to `this`, inert without a card scroll frame, which is intended. `viewport` is left at
    // its default (`this`) — this region IS the scroll viewport now, no split.
    const card = this.parentElement
    const onCard = card instanceof HTMLElement && card.tagName === 'UI-CARD'
    const brackets = onCard ? (card as HTMLElement) : this
    const inScrollMode = (): boolean => this.scrollable || (onCard && (card as HTMLElement).hasAttribute('scrollable'))
    scrollFade(this, { brackets, enabled: inScrollMode })
  }
}

if (!customElements.get('ui-card-content')) customElements.define('ui-card-content', UICardContentElement)
