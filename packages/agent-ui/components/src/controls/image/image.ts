// image.ts — UIImageElement, the URL-sourced content-image primitive (GH #1189 R1/R2; a conventional
// component admission per the host ADR ruling — NOT a novel architectural departure, no new ADR file). A
// Display-class, non-interactive, non-form-associated leaf: no events, no keyboard contract, no focus. NOT a
// fallback-chain component like ui-avatar — no initials/icon fallback, just the <img> mechanics borrowed from
// avatar.ts (object-fit, an interior <img>).
//
// Content model: the interior `<img data-part="media">` is CONTROL-BUILT but PERSISTENT — created exactly
// once in connected() and thereafter only ever MUTATED (src/alt/object-fit-driving-attribute/loading/
// decoding/fetchpriority), never replaced via replaceChildren. This is the deliberate difference from
// ui-stat/ui-description-list's whole-swap shape: a whole-swap here would clobber the author's own default-
// slotted caption content every time `src`/`fit`/`aspect`/`usageHint` changed. Caption content is therefore
// left EXACTLY where the author placed it — CSS targets it structurally (":not([data-part='media'])") rather
// than JS moving it into a wrapper, so no MutationObserver heal machinery is needed (contrast with
// button.ts's label-wrapper heal, which that component needs because it also enforces a single-line
// text-overflow contract this one does not).
//
// ZERO CLS (R1): the host's `aspect-ratio` is ALWAYS a concrete value — `image-model.ts`'s parseAspectRatio
// sanitizes the `aspect` prop (or falls back to the 16/9 default) and the result is written as the PRIVATE,
// per-instance `--_aspect` style property (the ui-progress `--_pct` precedent: instance-computed, outside the
// `--ui-image-*` public token contract) — never "auto".
//
// LAZY-LOADING (R1): `usageHintDefaults` (image-model.ts) maps `usageHint` to native `loading`/`decoding`/
// `fetchpriority` — zero-dep, browser built-in, no IntersectionObserver.
//
// THE SCRIM + CAPTION (R2): image.css paints the bottom gradient (decorative) and gives any non-media child
// (the caption) a FLAT `--ui-image-scrim-color` background (a deterministic contrast floor, independent of
// the gradient's fade position or the caption's own height/line-count) + `--ui-image-caption-ink`. Both
// tokens are pinned, real values — this file contributes no runtime style injection for them (plan §2, CSS
// owns all of it); image-model.test.ts proves the WCAG contrast math against a pinned worst-case fixture.

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { parseAspectRatio, usageHintDefaults } from './image-model.ts'
// Generated from image.md's `attributes[]` (ADR-0173) — `node scripts/generate-props.mjs image` to
// regenerate; never hand-edit image.props.gen.ts. The fleet drift gate
// (descriptor/props-gen-driftwire.test.ts) keeps the two byte-identical.
import { props } from './image.props.gen.ts'

export interface UIImageElement extends ReactiveProps<typeof props> {}
export class UIImageElement extends UIElement {
  static props = props

  // The persistent media element — built once, mutated thereafter. Null until `src` is first non-empty (an
  // empty `src` renders no <img> at all, the avatar.ts "never a broken-image box" discipline).
  #media: HTMLImageElement | null = null

  protected override connected(): void {
    this.effect(() => {
      const src = this.src
      const alt = this.alt
      const usageHint = this.usageHint

      if (src === '') {
        // No src ⇒ no media element at all — remove it if one existed from a prior non-empty src.
        this.#media?.remove()
        this.#media = null
        return
      }

      if (!this.#media) {
        const img = document.createElement('img')
        img.dataset.part = 'media'
        // Prepend so the media element always paints FIRST (behind any caption content that follows it in
        // DOM order — the paint-order the scrim/caption CSS relies on).
        this.insertBefore(img, this.firstChild)
        this.#media = img
      }
      const img = this.#media
      img.src = src
      img.alt = alt
      // setAttribute (not the .loading/.decoding IDL properties) — jsdom does not reflect those two
      // properties back to their attributes (a real-engine-only gap), so setAttribute keeps jsdom probes
      // and real-browser behaviour identical.
      const { loading, decoding, fetchPriority } = usageHintDefaults(usageHint)
      img.setAttribute('loading', loading)
      img.setAttribute('decoding', decoding)
      if (fetchPriority) img.setAttribute('fetchpriority', fetchPriority)
      else img.removeAttribute('fetchpriority')
    })

    // The zero-CLS aspect-ratio box (R1) — a private, per-instance style property, NOT a --ui-image-*
    // public token (the ui-progress --_pct precedent). Sanitized so a malformed `aspect` never reaches CSS.
    this.effect(() => {
      this.style.setProperty('--_aspect', parseAspectRatio(this.aspect))
    })
  }

  // Deliberately NO disconnected() override that nulls #media: a reconnect (a plain appendChild reparent,
  // not moveBefore) removes the HOST from its old parent — it does NOT remove the host's OWN children. The
  // <img data-part="media"> is still a real child of this element across the move, so the ref must survive
  // it; nulling it here previously caused connected() to see #media === null on reconnect and PREPEND A
  // SECOND <img>, leaving the stale first one (both absolutely positioned) painted on top forever — the
  // exact "created exactly once … never replaced" contract this file's own banner promises (GH #1189
  // review finding B2). No cleanup is needed: when the host is truly removed (not reparented), the browser
  // garbage-collects the whole subtree, #media included.
}

if (!customElements.get('ui-image')) customElements.define('ui-image', UIImageElement) // idempotent self-define
