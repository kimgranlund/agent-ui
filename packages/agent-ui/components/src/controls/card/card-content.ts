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
//
// REVISED 2026-07-08 (Kim's third option, resolving the "the mask fades the scrollbar" tension — ADR-0046
// Amendment 6): card.css HIDES ui-card-content's native scrollbar in scroll mode (`scrollbar-width: none` +
// `::-webkit-scrollbar { display: none }`) — native `overflow-y: auto` scrolling is UNCHANGED, so with no
// visible bar left for the mask to fade, the running fade becomes the sole (and only) scroll affordance. This
// makes THIS region a keyboard dead-end unless it can itself take focus — connected() below gives it
// `tabindex="0"` (+ `role=group`, + a best-effort `ariaLabelledByElements` name off the header) whenever
// `inScrollMode()` is true, reactively, mirroring the fade's own gate. A focused, tabindex=0, overflow:auto DIV
// is NOT reliably keyboard-scrollable by the platform's own default action across engines — MEASURED
// (card.browser.test.ts): Chromium scrolls it once genuinely (trusted-click-)focused, WebKit does not move it
// AT ALL (ArrowDown/PageDown/End all no-op), confirming the exact "WebKit lags" gap flagged at design time. So
// connected() wires an EXPLICIT keydown handler (below) rather than depend on an inconsistent default action —
// deterministic scrolling on every engine, not a per-platform gamble.

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

    // Keyboard operability (WCAG 2.1.1 Keyboard — component-review, 2026-07-08): card.css HIDES the native
    // scrollbar in scroll mode (Kim's "keep native, but hide it" resolution, ADR-0046 Amendment 6) — the fade
    // is now the ONLY visible scroll affordance. `tabindex="0"` makes THIS region a genuine tab stop.
    // Reactive: tracks the SAME `inScrollMode()` the fade above gates on, so toggling the content-level
    // `scrollable` signal live also toggles focusability (the parent-level `<ui-card scrollable>` stays the
    // documented read-once-at-connect case — same asymmetry as the fade arming).
    this.effect(() => {
      if (!inScrollMode()) {
        this.removeAttribute('tabindex')
        this.internals.role = null
        if ('ariaLabelledByElements' in this.internals) this.internals.ariaLabelledByElements = null
        return
      }
      this.setAttribute('tabindex', '0')
      this.internals.role = 'group'
      // An accessible name for the now-focusable region, borrowed from the header — a card's header IS its
      // content's caption. `ariaLabelledByElements` is a newer ElementInternals reflection API (unsupported in
      // jsdom; real-engine support is flagged for Kim's on-device check, not asserted here) — feature-detected
      // so its absence never throws. A headerless card gets no name: a documented gap (card.md), matching the
      // family's "unnamed stays generic" ARIA posture (ADR-0014).
      if ('ariaLabelledByElements' in this.internals) {
        const header = onCard ? (card as HTMLElement).querySelector(':scope > ui-card-header') : null
        this.internals.ariaLabelledByElements = header ? [header] : null
      }
    })

    // The EXPLICIT scroll — the platform's own default action for arrow/Page/Home/End on a focused,
    // tabindex=0, overflow:auto DIV is NOT reliable across engines (measured: Chromium moves it once
    // trusted-focused; WebKit does not move it at all) — so this region scrolls itself deterministically
    // rather than gamble on that default. `event.target === this` guards against hijacking arrow keys a
    // focused DESCENDANT owns for its own purpose (e.g. a roving-tabindex control inside the content); only
    // when THIS region itself is the direct key target does it act. `preventDefault()` on a handled key
    // suppresses whatever native default action might ALSO fire (Chromium), so the increment is the same
    // everywhere, not a double-scroll.
    this.listen(this, 'keydown', (event: Event) => {
      if (event.target !== this || !inScrollMode()) return
      const key = (event as KeyboardEvent).key
      const line = 40 // px per arrow press — an ordinary reading-line increment, density-invariant on purpose
      const page = this.clientHeight * 0.9 // near-full-page, a small overlap (the standard page-scroll convention)
      switch (key) {
        case 'ArrowDown':
          this.scrollTop += line
          break
        case 'ArrowUp':
          this.scrollTop -= line
          break
        case 'PageDown':
          this.scrollTop += page
          break
        case 'PageUp':
          this.scrollTop -= page
          break
        case 'Home':
          this.scrollTop = 0
          break
        case 'End':
          this.scrollTop = this.scrollHeight
          break
        default:
          return
      }
      event.preventDefault()
    })
  }
}

if (!customElements.get('ui-card-content')) customElements.define('ui-card-content', UICardContentElement)
