// types.test.ts — s-types accept (icon-adapter.decomp.json): ICON_NAMES completeness + the IconPack
// shape compiles over the full IconName vocabulary.

import { describe, expect, it } from 'vitest'
import { ICON_NAMES, type IconName, type IconPack } from './types.ts'

describe('ICON_NAMES', () => {
  it('has exactly ninety-seven names (32 pre-ADR-0169 + 44 ADR-0169 cl.9b Icon-table members + 3 ADR-0179 GH #686 Amendment S7-a members + 2 GH #868 composer-trigger glyphs + 8 GH #1258 weather glyphs + 1 GH #1406 minus stepper glyph + 7 GH #1485 amenity/hospitality glyphs)', () => {
    expect(ICON_NAMES.length).toBe(97)
  })

  it('is all distinct strings', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length)
    for (const name of ICON_NAMES) expect(typeof name).toBe('string')
  })

  it('contains the curated audit set (ADR-0066 clause 2 + the feed-family LLD-C9 addition + the TKT-0048 plus glyph + the Figma chat-input refactor\'s arrow-up/microphone + the TKT-0083/ADR-0146 F7 warning glyph + the Claude Code Gateway reasoning-chain card\'s circle-notch/check-circle/x-circle group markers + ui-super-shell\'s list/hamburger glyph, M5 GH #83/#90 + the GH #147/ADR-0153 clock "Planned"/all-pending group marker + the GH #168 dots-three overflow/more-actions glyph + the GH #170/ADR-0155 narrow-header rework\'s circle-half/palette glyphs + ADR-0169 cl.9b\'s a2ui-basic Icon-table regeneration, 44 new glyphs + ADR-0179 GH #686 Amendment S7-a\'s chats-circle/gear-six/robot + GH #868\'s sparkle/brain composer-trigger glyphs + GH #1258\'s eight weather glyphs + GH #1406\'s minus stepper glyph + GH #1485\'s seven amenity/hospitality glyphs)', () => {
    expect([...ICON_NAMES].sort()).toEqual(
      [
        'caret-down', 'caret-up', 'caret-left', 'caret-right',
        'x', 'eye', 'eye-slash', 'calendar-blank', 'check',
        'arrow-right', 'magnifying-glass',
        'user', 'file', 'file-image', 'file-audio', 'file-video',
        'file-pdf', 'file-text', 'file-zip', 'file-code',
        'plus', 'arrow-up', 'microphone', 'warning',
        'circle-notch', 'check-circle', 'x-circle', 'list', 'clock',
        'dots-three', 'circle-half', 'palette',
        // ADR-0169 cl.9b — the a2ui-basic Icon row's `ICON_NAME_TABLE` regeneration (44 new members).
        'user-circle', 'arrow-left', 'paperclip', 'phone', 'camera', 'trash', 'download-simple',
        'pencil-simple', 'calendar-check', 'fast-forward', 'heart', 'heart-break', 'folder', 'question',
        'house', 'info', 'map-pin', 'lock-simple', 'lock-simple-open', 'envelope-simple',
        'dots-three-vertical', 'bell-slash', 'bell', 'pause', 'credit-card', 'image', 'play', 'printer',
        'arrow-clockwise', 'rewind', 'paper-plane-right', 'gear', 'share-network', 'shopping-cart',
        'skip-forward', 'skip-back', 'star', 'star-half', 'stop', 'upload-simple', 'speaker-low',
        'speaker-slash', 'speaker-none', 'speaker-high',
        // ADR-0179 GH #686 Amendment S7-a — ui-toggle's downstream Chat/Settings/Co-pilot icon vocabulary.
        'chats-circle', 'gear-six', 'robot',
        // GH #868 — conversation-composer's models/effort trigger glyphs.
        'sparkle', 'brain',
        // GH #1258 — the weather glyph set (identity with Phosphor's own names).
        'sun', 'cloud', 'cloud-sun', 'cloud-rain', 'snowflake', 'lightning', 'wind', 'cloud-fog',
        // GH #1406 — ui-text-field's side-by-side − + stepper pair (plus already existed above).
        'minus',
        // GH #1485 — the amenity/hospitality glyph set (identity with Phosphor's own names).
        'mountains', 'tree', 'campfire', 'bathtub', 'swimming-pool', 'wifi-high', 'paw-print',
      ].sort(),
    )
  })
})

describe('IconPack', () => {
  it('compiles as {id, viewBox, icons: Record<IconName, string>} over every name', () => {
    const icons = Object.fromEntries(ICON_NAMES.map((name) => [name, `<path data-name="${name}"/>`])) as Record<
      IconName,
      string
    >
    const pack: IconPack = { id: 'fixture', viewBox: '0 0 256 256', icons }
    for (const name of ICON_NAMES) expect(pack.icons[name]).toContain(name)
  })
})
