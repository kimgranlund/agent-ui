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
// The EDGE-AWARE `mask-image` fade (Kim, 2026-07-04/05, REVISED 2026-07-06 — the WRAPPER MODEL, ratified via
// /intent-extract) is AUTOMATIC in scroll mode — no opt-in prop. THIS region (ui-card-content) is always the
// PAINT target — the mask never lands on the card or its sticky header/footer siblings — but WHAT is measured
// as the scroll viewport now depends on whether the agent wrote an author-owned `[scroll-wrapper]` child:
//   • WRAPPER PRESENT — `<ui-card-content><span scroll-wrapper>…</span></ui-card-content>`: the wrapper (a
//     bare styling-hook attribute, element-agnostic — span/div, author-written, NEVER auto-injected, so it
//     never disturbs the A2UI positional reconcile) becomes THE scroll viewport, nested two levels below the
//     header/footer. Because ui-card-content itself never scrolls in this shape, its own box IS the visible
//     frame the mask stays registered to for the WHOLE scroll range — this is the fix for the fade-only-at-
//     the-extremes finding measured against the REVISED 2026-07-05 content-as-scroller shape (mask-image paints
//     relative to the masked element's OWN box; a box that never scrolls IS the visible window throughout).
//   • WRAPPER ABSENT — `<ui-card scrollable>` with plain ui-card-content children: degrades gracefully to the
//     PRIOR (2026-07-05) card-as-viewport behaviour — the CARD is the scroll viewport (card.css's
//     `overflow-y:auto`), and the mask still paints here, on content, with the ORIGINAL "fade only near the
//     scroll extremes for long content" limitation (documented, not an error — the wrapper is how an agent
//     opts into the fully-fixed fade).
// Either way `scrollFade(this, { viewport, paintTarget: this, brackets, enabled })` wires `traits/scroll-fade.ts`
// in `connected()`: `viewport` is whichever element above actually scrolls; `paintTarget` is always `this`;
// `brackets` is always the CARD (the header/footer's real direct parent, which is neither the wrapper's nor,
// in the wrapper shape, content's own ancestor at the same level) — so the presence-aware bracket-band query
// keeps working identically regardless of which viewport is in play. Wired from HERE, not card.ts, so it
// installs after this region has connected (the card already exists as our parent). The mask self-gates on
// ACTUAL overflow (scroll-fade.ts), so a short non-scrolling viewport never fades.
//
// SELF-HEALING wrapper detection (post-review hardening, mirrors ui-text.ts's `#heal` precedent): the wrapper
// check is a bare author-written styling hook, not a reactive prop — but card.css's `:has(> [scroll-wrapper])`
// layout switch IS reactive, so a read-once check alone leaves a gap for an IMPERATIVE caller: create the card,
// let it connect (wiring the fallback viewport, arming the CSS switch too), THEN append the wrapper. Declarative
// HTML and A2UI never hit this (the wrapper, if written at all, is already a child at connect), but the JS path
// would otherwise strand the trait on the stale fallback while the CSS has already flipped layouts — the card
// never overflows, so the fade silently never arms. A childList `MutationObserver` on this region re-checks
// wrapper presence on every mutation and re-wires ONLY on a genuine presence FLIP (idempotent, converges in one
// pass — a same-state mutation, e.g. content landing inside an already-present wrapper, is a no-op re-check).
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

  // The currently-wired scrollFade teardown + the wrapper-presence it was wired against — both set by the
  // `wire()` closure in `connected()`; the heal observer below reads `#hasWrapper` to detect a genuine flip
  // (never re-wires on a same-state re-check, so it cannot loop).
  #release: (() => void) | null = null
  #hasWrapper = false
  // The childList observer that heals the read-once wrapper detection (see the banner above) — the ui-text.ts
  // `#observer` precedent: disconnected explicitly in `disconnected()`, the "zero residue after removal"
  // discipline `this.effect`/`this.listen` give for free, applied by hand since a raw platform observer isn't
  // scope-owned.
  #observer: MutationObserver | null = null

  protected connected(): void {
    // `brackets` is ALWAYS the card (its direct children are the real header/footer, regardless of which
    // viewport is active) — standalone (no ui-card parent) falls back to `this`, inert without a card scroll
    // frame, which is intended. It doubles as the NO-WRAPPER viewport fallback (the same `onCard ? card : this`
    // read either way — see card-content.ts's banner). `this` is ALWAYS the paint target.
    const card = this.parentElement
    const onCard = card instanceof HTMLElement && card.tagName === 'UI-CARD'
    const brackets = onCard ? (card as HTMLElement) : this
    const inScrollMode = (): boolean => this.scrollable || (onCard && (card as HTMLElement).hasAttribute('scrollable'))

    // (Re-)detect the wrapper and (re-)wire scrollFade against whichever element actually scrolls. Called once
    // at connect and again by the heal observer on a genuine presence flip.
    const wire = (): void => {
      const wrapper = this.querySelector(':scope > [scroll-wrapper]')
      this.#hasWrapper = wrapper instanceof HTMLElement
      const viewport = this.#hasWrapper ? (wrapper as HTMLElement) : brackets
      this.#release = scrollFade(this, { viewport, paintTarget: this, brackets, enabled: inScrollMode })
    }

    wire() // the at-connect state (declarative HTML / A2UI: the wrapper, if any, is already a child)
    // Installed AFTER the initial wire() above, so it never observes its own synchronous setup — it only fires
    // for LATER mutations (the imperative late-append case this heals).
    this.#observer = new MutationObserver(() => {
      const hasWrapper = this.querySelector(':scope > [scroll-wrapper]') instanceof HTMLElement
      if (hasWrapper === this.#hasWrapper) return // no presence change — converged, nothing to heal
      this.#release?.() // tear down the stale wiring before re-wiring fresh (never leave two live)
      wire()
    })
    this.#observer.observe(this, { childList: true })
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
    this.#release?.()
    this.#release = null
  }
}

if (!customElements.get('ui-card-content')) customElements.define('ui-card-content', UICardContentElement)
