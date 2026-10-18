// intent-mark.ts: the one intent to mark table every intent-keyed status mark reads (T-0351): the badge's own
// mark and the game-hud and result-card stat marks. A plain module, not a control entry, so a control that
// reads it does not pull ui-badge in. Each mark is a ui-glyph library mark (ADR-0245 cl.5).

import type { GlyphSymbol } from '../glyph/glyph-paths.ts'
import type { INTENTS } from './badge.props.gen.ts'

/** The mark per intent; `neutral` has none, absence is its signifier (SPEC-R12). */
export const INTENT_MARK: Readonly<Record<Exclude<(typeof INTENTS)[number], 'neutral'>, GlyphSymbol>> = {
  info: 'info',
  success: 'check',
  warning: 'warning',
  danger: 'x',
}

/** The mark for `intent`, or undefined for neutral or anything outside the table. An own-key lookup, so a
 *  prototype name such as 'toString' never resolves. */
export function intentMark(intent: unknown): GlyphSymbol | undefined {
  return typeof intent === 'string' && Object.hasOwn(INTENT_MARK, intent) ? INTENT_MARK[intent as keyof typeof INTENT_MARK] : undefined
}
