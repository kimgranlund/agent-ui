// types.test.ts — s-types accept (icon-adapter.decomp.json): ICON_NAMES completeness + the IconPack
// shape compiles over the full IconName vocabulary.

import { describe, expect, it } from 'vitest'
import { ICON_NAMES, type IconName, type IconPack } from './types.ts'

describe('ICON_NAMES', () => {
  it('has exactly thirty names', () => {
    expect(ICON_NAMES.length).toBe(30)
  })

  it('is all distinct strings', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length)
    for (const name of ICON_NAMES) expect(typeof name).toBe('string')
  })

  it('contains the curated audit set (ADR-0066 clause 2 + the feed-family LLD-C9 addition + the TKT-0048 plus glyph + the Figma chat-input refactor\'s arrow-up/microphone + the TKT-0083/ADR-0146 F7 warning glyph + the Claude Code Gateway reasoning-chain card\'s circle-notch/check-circle/x-circle group markers + ui-super-shell\'s list/hamburger glyph, M5 GH #83/#90 + the GH #147/ADR-0153 clock "Planned"/all-pending group marker + the GH #168 dots-three overflow/more-actions glyph)', () => {
    expect([...ICON_NAMES].sort()).toEqual(
      [
        'caret-down', 'caret-up', 'caret-left', 'caret-right',
        'x', 'eye', 'eye-slash', 'calendar-blank', 'check',
        'arrow-right', 'magnifying-glass',
        'user', 'file', 'file-image', 'file-audio', 'file-video',
        'file-pdf', 'file-text', 'file-zip', 'file-code',
        'plus', 'arrow-up', 'microphone', 'warning',
        'circle-notch', 'check-circle', 'x-circle', 'list', 'clock',
        'dots-three',
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
