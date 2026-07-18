// types.ts — the canonical icon-name vocabulary + the inert pack shape (LLD-C1, ADR-0065 clause 2).

// erasableSyntaxOnly-safe: an `as const` array -> a literal union (no enum).
export const ICON_NAMES = [
  'caret-down', 'caret-up', 'caret-left', 'caret-right',
  'x', 'eye', 'eye-slash', 'calendar-blank', 'check',
  'arrow-right', 'magnifying-glass',
  'user', 'file', 'file-image', 'file-audio', 'file-video',
  'file-pdf', 'file-text', 'file-zip', 'file-code',
  'plus',
  'arrow-up', 'microphone',
  'warning', // TKT-0083/ADR-0146 F7 — the ui-timeline-item `warning` status glyph (a triangle-exclamation, shape-coded per ADR-0057, distinct from error's `x`)
] as const
export type IconName = (typeof ICON_NAMES)[number]

/** An inert, swappable pack. `icons[name]` is the INNER SVG body (the `<path>`/`<rect>` markup,
 *  NO outer `<svg>`); `viewBox` is pack-wide (Phosphor = '0 0 256 256'). */
export interface IconPack {
  readonly id: string
  readonly viewBox: string
  readonly icons: Readonly<Record<IconName, string>>
}
