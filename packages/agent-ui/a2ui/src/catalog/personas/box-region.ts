// box-region.ts: the persona composites' card spacing on the ADR-0046 container box model (ADR-0046 Amendment 7,
// T-0084). CardTable and QuestionCard are region-less `ui-card` roots: their own parts and the producer's Buttons
// are loose card children (the Buttons stay root children, ADR-0243 Amendment 2), so the card's ADR-0056 humane
// default pads them by the region padding alone and spaces them with an 8px adjacent-sibling margin. A stock card
// with regions puts its ink the 6px box inset plus the region padding in from the border, so this pads the
// composite's card by both, per axis, and zeroes the card's loose-child margin so the composite's own flex `gap`
// is the one rhythm (a hidden part then leaves no gap). The shared --ui-box-* tokens with their literal fallbacks
// (the card.css idiom: a ui-card is not a [data-box], so the tokens resolve to their 6/6/12/8 defaults).

/** The ADR-0046 box tokens, as inline-style values. */
export const BOX = {
  inset: 'var(--ui-box-inset, 0.375rem)', // 6px, the box inset around a region
  padBlock: 'var(--ui-box-pad-block, 0.375rem)', // 6px, a region's block padding
  padInline: 'var(--ui-box-pad-inline, 0.75rem)', // 12px, a region's inline padding
  gap: 'var(--ui-box-gap, 0.5rem)', // 8px, the gap between a region's children
} as const

/** Pad a region-less `ui-card` like one region inside a stock card, and hand its child rhythm to `gap`. */
export function boxRegionCard(el: HTMLElement): void {
  const s = el.style
  s.paddingBlock = `calc(${BOX.inset} + ${BOX.padBlock})`
  s.paddingInline = `calc(${BOX.inset} + ${BOX.padInline})`
  s.setProperty('--ui-card-content-gap', '0px') // the card's own loose-child margin; the flex gap replaces it
}
