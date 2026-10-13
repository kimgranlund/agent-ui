// glyph-paths.ts: the one path table that owns functional-mark geometry (ADR-0245 clause 5). Library
// geometry, not swappable pack art: the icon pack keeps its own caret and check for pictorial use, and a
// control never re-draws one of these marks by hand. Each mark is a stroke path in the fixed 16-unit square
// below, drawn `fill="none" stroke="currentColor"` with a non-scaling stroke so the stroke width is a token
// (`--md-sys-glyph-stroke`); `dot` and `more` are filled. Paths keep a 1.5-unit margin so a round cap never
// leaves the box. The set is closed: a new mark joins only by amending ADR-0245.

export const GLYPH_VIEWBOX = '0 0 16 16'

export interface GlyphMark {
  readonly d: string
  readonly filled?: boolean
}

export const GLYPH_MARKS = {
  check: { d: 'M3 8.5 6.5 12 13 4.5' },
  x: { d: 'M4 4 12 12M12 4 4 12' },
  plus: { d: 'M8 3v10M3 8h10' },
  minus: { d: 'M3 8h10' }, // also the indeterminate dash
  'caret-up': { d: 'M3.5 10.25 8 5.75l4.5 4.5' },
  'caret-down': { d: 'M3.5 5.75 8 10.25l4.5-4.5' },
  'caret-left': { d: 'M10.25 3.5 5.75 8l4.5 4.5' },
  'caret-right': { d: 'M5.75 3.5 10.25 8l-4.5 4.5' },
  dot: { d: 'M5 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0Z', filled: true },
  more: { d: 'M1.5 8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0ZM6.5 8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0ZM11.5 8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0Z', filled: true },
  warning: { d: 'M8 2.5 14.25 13.5H1.75ZM8 6.5v3.25M8 11.75v.01' },
  info: { d: 'M2 8a6 6 0 1 0 12 0a6 6 0 1 0-12 0ZM8 7.25v3.75M8 5v.01' },
} as const satisfies Record<string, GlyphMark>

export type GlyphSymbol = keyof typeof GLYPH_MARKS

/** The closed v1 set, in ADR-0245 clause 5 order. */
export const GLYPH_SYMBOLS = Object.keys(GLYPH_MARKS) as readonly GlyphSymbol[]

export const isGlyphSymbol = (value: string): value is GlyphSymbol => Object.hasOwn(GLYPH_MARKS, value)
