// playing-card-pips.ts — the per-rank pip layout table for ui-playing-card (ADR-0225 cl.5, the intake
// §4 Geometry row). Pure data + derivation, no DOM — the avatar-initials.ts sibling-module shape
// (unit-testable without a browser).
//
// A + 2–10 render TRUE pip counts (the rank's own numeric value) laid out on a 3-column × 5-row grid
// (col 0=left, 1=center, 2=right; row 0=top … row 4=bottom, row 2=the exact vertical center) — the
// physical printed-card convention: every pip strictly BELOW the center row (`row > CENTER_ROW`) is
// printed upside-down (`rotated: true`) so the layout reads correctly from either end of the card,
// while the exact-center row (and A's single pip) stays upright. This mirrors the real French-suited
// card quirk that most ranks are 180°-rotation-symmetric except 7 (whose extra 7th pip has no partner
// — a genuine, deliberately-kept asymmetry, not a bug).
//
// J/Q/K take the LETTER treatment (ADR-0225 "Refused from the full-scope reading" — court art is
// image-asset territory, illegible at the sm/md ramp): `pipsFor('J'|'Q'|'K')` returns `[]`, and the
// host renders the rank letter large-and-centered instead of a pip grid. `''` (the graceful-empty
// blank face) also returns `[]` — a blank face paints no pips and no letter.

/** The pip grid: 3 columns (0=left, 1=center, 2=right), 5 row slots (0=top … 4=bottom). */
export const PIP_GRID_ROWS = 5
/** The exact vertical center row — a pip AT this row stays upright regardless of count parity. */
export const PIP_GRID_CENTER_ROW = 2

export type PipCol = 0 | 1 | 2

/** One pip's grid position (raw table entry — `row` may be fractional, the rank-10 off-center pair). */
export interface PipSlot {
  readonly col: PipCol
  readonly row: number
}

/** A resolved pip position + its derived orientation (`rotated` = printed upside-down). */
export interface PipPosition extends PipSlot {
  readonly rotated: boolean
}

const L: PipCol = 0
const C: PipCol = 1
const R: PipCol = 2

/** Numeric ranks the pip field renders — 'A' counts as one pip (the ace's single large center pip). */
export const PIP_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const
export type PipRank = (typeof PIP_RANKS)[number]

/** The letter-treatment ranks — no pip grid, the rank letter renders large-and-centered instead. */
export const LETTER_RANKS = ['J', 'Q', 'K'] as const
export type LetterRank = (typeof LETTER_RANKS)[number]

// The raw per-rank layout table — every rank's pip COUNT equals its numeric value (the accept condition
// this module's own test pins). Positions are the physical-card layout described in the header comment.
const PIP_LAYOUT: Readonly<Record<PipRank, readonly PipSlot[]>> = {
  A: [{ col: C, row: 2 }],
  '2': [
    { col: C, row: 0 },
    { col: C, row: 4 },
  ],
  '3': [
    { col: C, row: 0 },
    { col: C, row: 2 },
    { col: C, row: 4 },
  ],
  '4': [
    { col: L, row: 0 },
    { col: R, row: 0 },
    { col: L, row: 4 },
    { col: R, row: 4 },
  ],
  '5': [
    { col: L, row: 0 },
    { col: R, row: 0 },
    { col: C, row: 2 },
    { col: L, row: 4 },
    { col: R, row: 4 },
  ],
  '6': [
    { col: L, row: 0 },
    { col: R, row: 0 },
    { col: L, row: 2 },
    { col: R, row: 2 },
    { col: L, row: 4 },
    { col: R, row: 4 },
  ],
  '7': [
    { col: L, row: 0 },
    { col: R, row: 0 },
    { col: C, row: 1 }, // the deliberate asymmetry — no row-3 partner (the real French-suited-deck quirk)
    { col: L, row: 2 },
    { col: R, row: 2 },
    { col: L, row: 4 },
    { col: R, row: 4 },
  ],
  '8': [
    { col: L, row: 0 },
    { col: R, row: 0 },
    { col: C, row: 1 },
    { col: L, row: 2 },
    { col: R, row: 2 },
    { col: C, row: 3 },
    { col: L, row: 4 },
    { col: R, row: 4 },
  ],
  '9': [
    { col: L, row: 0 },
    { col: R, row: 0 },
    { col: L, row: 1 },
    { col: R, row: 1 },
    { col: C, row: 2 },
    { col: L, row: 3 },
    { col: R, row: 3 },
    { col: L, row: 4 },
    { col: R, row: 4 },
  ],
  '10': [
    { col: L, row: 0 },
    { col: R, row: 0 },
    { col: L, row: 1 },
    { col: R, row: 1 },
    { col: C, row: 0.5 },
    { col: L, row: 3 },
    { col: R, row: 3 },
    { col: L, row: 4 },
    { col: R, row: 4 },
    { col: C, row: 3.5 },
  ],
}

const isPipRank = (rank: string): rank is PipRank => (PIP_RANKS as readonly string[]).includes(rank)

/** true iff `rank` takes the large-center-letter treatment (J/Q/K — no pip grid, ADR-0225). */
export function isLetterRank(rank: string): rank is LetterRank {
  return (LETTER_RANKS as readonly string[]).includes(rank)
}

/** The resolved pip layout for `rank` — `[]` for '', J, Q, K (blank face / letter treatment); otherwise
 *  exactly `Number(rank)` (or 1 for 'A') positions, each carrying its derived `rotated` orientation. */
export function pipsFor(rank: string): PipPosition[] {
  if (!isPipRank(rank)) return []
  return PIP_LAYOUT[rank].map((slot) => ({ ...slot, rotated: slot.row > PIP_GRID_CENTER_ROW }))
}
