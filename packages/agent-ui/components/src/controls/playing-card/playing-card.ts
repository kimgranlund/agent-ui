// playing-card.ts — UIPlayingCardElement, the Display-class true card-face/back leaf (ADR-0225, GH #1478).
// BEHAVIOUR + props + internals ARIA + the component-built flipper/face/back parts + self-define ONLY;
// the pure per-rank pip layout lives in playing-card-pips.ts (DOM-free, unit-testable) and every
// geometry/token/motion rule lives in playing-card.css.
//
// A display leaf: NOT form-associated, NOT interactive (no events, no keyboard contract, no focus) —
// `internals.role = 'img'` (a single flattened mark, the ui-swatch/ui-avatar[label] posture), named by
// the derived accessible name below. Content model — component-built, NOT host-as-grid: `rank`/`suit`/
// `faceDown` is display-only, whole-structure derived state (the pie-chart/avatar precedent), so
// `render()` stays the inherited no-op and one mark effect rebuilds the light-DOM child list on every
// change via `replaceChildren`. BOTH faces stay in the DOM always (`backface-visibility: hidden` in CSS
// — a real flip needs both faces painted, ADR-0225 cl.6); only `[face-down]` (a plain reflected
// attribute, read by playing-card.css) decides which one is the rotor's front.
//
// A11y (ADR-0225 intake §4): the accessible name MUST NOT leak rank/suit while `faceDown` — the label
// derivation branches on `faceDown` BEFORE reading rank/suit, so a concealed card never computes a
// leaking string even transiently.
//
// The `:state(ready)` custom state (ADR-0008 §4a-c) arms ONE FRAME past first paint (`requestAnimationFrame`,
// never `updateComplete` — a microtask fires before the browser's own paint) so a card that first-paints
// `face-down` never animates the flip (ADR-0225 cl.6's "no first-paint animation"); only a SUBSEQUENT
// `faceDown` change (after the ready state lands) transitions.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { pipsFor, isLetterRank } from './playing-card-pips.ts'

const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
const SUITS = ['', 'spades', 'hearts', 'diamonds', 'clubs'] as const

const SUIT_GLYPH: Readonly<Record<string, string>> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

/** 'A' → 'Ace', 'K' → 'King', numeric ranks read as themselves ('10' of hearts, never "Ten"). */
const RANK_NAME: Readonly<Record<string, string>> = {
  A: 'Ace',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
}

const props = {
  // reflect:true (all) — playing-card.css's `[suit=...]`/`[size=...]` repoints + the a11y derivation
  // below all key off the live attribute, the ADR-0173 convention for a CSS-consumed enum.
  rank: { ...prop.enum(RANKS, ''), reflect: true }, // '' = blank face (graceful-empty), never wire-exposed — mirrors the croupier wire enum + the fleet ''-first law
  suit: { ...prop.enum(SUITS, ''), reflect: true }, // '' = no suit ink/glyph
  faceDown: { ...prop.boolean(false), attribute: 'face-down', reflect: true }, // camelCase prop → explicit kebab attribute (the avatar iconOnly precedent — attrNameOf never auto-kebabs)
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true }, // the em-keyed box ramp tier (ADR-0225 cl.5 — the avatar F3 REPOINT pattern; a fresh, card-local chain, not the compact ramp)
} satisfies PropsSchema

export interface UIPlayingCardElement extends ReactiveProps<typeof props> {}
export class UIPlayingCardElement extends UIElement {
  static props = props

  protected override connected(): void {
    this.internals.role = 'img'

    // The accessible-name effect (ADR-0225 intake §4 A11y row) — branches on faceDown FIRST so a
    // concealed card's label is computed with no rank/suit read in that branch at all (never a leak
    // that merely happens not to render — the derivation itself never touches the concealed data).
    this.effect(() => {
      if (this.faceDown) {
        this.internals.ariaLabel = 'Face-down card'
        return
      }
      const rankName = this.rank === '' ? '' : (RANK_NAME[this.rank] ?? this.rank)
      const suitName = this.suit === '' ? '' : this.suit
      this.internals.ariaLabel = rankName && suitName ? `${rankName} of ${suitName}` : null
    })

    // The mark effect — whole-structure derived state (pie-chart/avatar precedent): every rank/suit
    // change rebuilds the flipper/face/back parts via one `replaceChildren`. BOTH faces are always
    // built (faceDown is a pure CSS-driven rotor flip, not a conditional render — ADR-0225 cl.6).
    this.effect(() => {
      this.replaceChildren(this.#flipperNode())
    })

    // :state(ready) — one frame past first paint (ADR-0008 §4a-c): the upgrade/first-paint flip SNAPS,
    // only a later faceDown change animates (ADR-0225 cl.6 — no first-paint animation).
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  #flipperNode(): HTMLElement {
    const flipper = document.createElement('div')
    flipper.dataset.part = 'flipper'
    flipper.append(this.#faceNode(), this.#backNode())
    return flipper
  }

  #faceNode(): HTMLElement {
    const face = document.createElement('div')
    face.dataset.part = 'face'
    face.append(this.#indexNode(false), this.#indexNode(true), this.#centerNode())
    return face
  }

  #indexNode(inverted: boolean): HTMLElement {
    const index = document.createElement('div')
    index.dataset.part = 'index'
    if (inverted) index.dataset.inverted = ''
    const rankSpan = document.createElement('span')
    rankSpan.dataset.part = 'index-rank'
    rankSpan.textContent = this.rank
    const suitSpan = document.createElement('span')
    suitSpan.dataset.part = 'index-suit'
    suitSpan.textContent = this.suit === '' ? '' : (SUIT_GLYPH[this.suit] ?? '')
    index.append(rankSpan, suitSpan)
    return index
  }

  /** The center content region: the rank's pip grid (A, 2–10), the large center letter (J/Q/K), or
   *  nothing at all (the '' blank-face graceful-empty state). */
  #centerNode(): HTMLElement {
    const pips = document.createElement('div')
    pips.dataset.part = 'pips'
    const glyph = this.suit === '' ? '' : (SUIT_GLYPH[this.suit] ?? '')

    if (isLetterRank(this.rank)) {
      const letter = document.createElement('span')
      letter.dataset.part = 'letter'
      letter.textContent = this.rank
      pips.append(letter)
      return pips
    }

    for (const pos of pipsFor(this.rank)) {
      const pip = document.createElement('span')
      pip.dataset.part = 'pip'
      if (pos.rotated) pip.dataset.rotated = ''
      pip.style.gridColumn = String(pos.col + 1)
      pip.style.gridRow = String(Math.round(pos.row * 2) + 1)
      pip.textContent = glyph
      pips.append(pip)
    }
    return pips
  }

  #backNode(): HTMLElement {
    const back = document.createElement('div')
    back.dataset.part = 'back'
    return back
  }
}

if (!customElements.get('ui-playing-card')) customElements.define('ui-playing-card', UIPlayingCardElement) // idempotent self-define
