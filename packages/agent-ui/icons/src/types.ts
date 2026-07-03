// types.ts — the canonical icon-name vocabulary + the inert pack shape (LLD-C1, ADR-0065 clause 2).

// erasableSyntaxOnly-safe: an `as const` array -> a literal union (no enum).
export const ICON_NAMES = [
  'caret-down', 'caret-up', 'caret-left', 'caret-right',
  'x', 'eye', 'eye-slash', 'calendar-blank', 'check',
] as const
export type IconName = (typeof ICON_NAMES)[number]

/** An inert, swappable pack. `icons[name]` is the INNER SVG body (the `<path>`/`<rect>` markup,
 *  NO outer `<svg>`); `viewBox` is pack-wide (Phosphor = '0 0 256 256'). */
export interface IconPack {
  readonly id: string
  readonly viewBox: string
  readonly icons: Readonly<Record<IconName, string>>
}
