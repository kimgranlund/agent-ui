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
  'list', // ui-super-shell's header-hosted collapse toggle (M5, GH #83/#90) — the fleet's one hamburger/menu glyph
  'warning', // TKT-0083/ADR-0146 F7 — the ui-timeline-item `warning` status glyph (a triangle-exclamation, shape-coded per ADR-0057, distinct from error's `x`)
  'circle-notch', 'check-circle', 'x-circle', // the Figma "Claude Code Gateway" reasoning-chain card (node 21:1641-1643) — a GROUP-level marker's own distinct glyph set: a spinning ring for `active`, a circled check for `done`, a circled X for `error` (vs. the plain dot/bare check/x a leaf step's marker uses). `x-circle` is distinct from `warning`'s triangle — ADR-0057 review finding: error and warning must stay SHAPE-distinct at the group level too, never hue-only.
  'clock', // GH #147 / ADR-0153 — the group-level "Planned" (all-pending) marker: a neutral, outline clock glyph, distinct in SHAPE from active's spinning ring / done's check / error's x (ADR-0057), completing the GROUP_STATUS_GLYPH set that circle-notch/check-circle/x-circle started.
  'dots-three', // GH #168 — the fleet's one horizontal overflow/more-actions glyph (the agent-admin canvas-header's page-actions ui-menu trigger, replacing a glued "…" text node — the TKT-0048 anti-pattern). Phosphor's catalog has no `dots-three-horizontal`; `dots-three` IS the horizontal one, and its regular-weight dots match the pack's line weight where `dots-three-outline`'s donut dots would read heavier than every neighbor glyph.
  'circle-half', // GH #170/ADR-0155 narrow-header rework — the scheme-cycle icon-only chip
  'palette', // GH #170/ADR-0155 narrow-header rework — the theme-picker icon-only chip
  // ADR-0169 cl.9b (a2ui-basic's Icon row, `ICON_NAME_TABLE`) — the upstream A2UI v0.9.1 Basic
  // Catalog's 59-identifier closed `Icon.name` enum, mapped onto Phosphor glyphs. 44 new members;
  // the pre-existing 13 the upstream table itself reuses are marked `(have)` in that table and are
  // NOT repeated here.
  'user-circle', 'arrow-left', 'paperclip', 'phone', 'camera', 'trash', 'download-simple',
  'pencil-simple', 'calendar-check', 'fast-forward', 'heart', 'heart-break', 'folder', 'question',
  'house', 'info', 'map-pin', 'lock-simple', 'lock-simple-open', 'envelope-simple',
  'dots-three-vertical', 'bell-slash', 'bell', 'pause', 'credit-card', 'image', 'play', 'printer',
  'arrow-clockwise', 'rewind', 'paper-plane-right', 'gear', 'share-network', 'shopping-cart',
  'skip-forward', 'skip-back', 'star', 'star-half', 'stop', 'upload-simple', 'speaker-low',
  'speaker-slash', 'speaker-none', 'speaker-high',
  // ADR-0179 GH #686 Amendment S7-a (admin-three-pane-ia.lld.md §16.1) — ui-toggle's downstream consumer
  // (the agent-admin unified header's three pane pills, S7-c) needs a shared Chat/Settings/Co-pilot icon
  // vocabulary: chats-circle (Chat) · gear-six (Settings) · robot (Co-pilot). eye/eye-slash/plus/dots-three
  // (the state-icon + trailing-action glyphs the same wireframe names) are already vendored above.
  'chats-circle', 'gear-six', 'robot',
] as const
export type IconName = (typeof ICON_NAMES)[number]

/** An inert, swappable pack. `icons[name]` is the INNER SVG body (the `<path>`/`<rect>` markup,
 *  NO outer `<svg>`); `viewBox` is pack-wide (Phosphor = '0 0 256 256'). */
export interface IconPack {
  readonly id: string
  readonly viewBox: string
  readonly icons: Readonly<Record<IconName, string>>
}
