// types.test.ts — s-types accept (icon-adapter.decomp.json): ICON_NAMES completeness + the IconPack
// shape compiles over the full IconName vocabulary.

import { describe, expect, it } from 'vitest'
import { ICON_NAMES, type IconName, type IconPack } from './types.ts'

describe('ICON_NAMES', () => {
  it('has exactly nine names', () => {
    expect(ICON_NAMES.length).toBe(9)
  })

  it('is all distinct strings', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length)
    for (const name of ICON_NAMES) expect(typeof name).toBe('string')
  })

  it('contains the curated audit set (ADR-0066 clause 2)', () => {
    expect([...ICON_NAMES].sort()).toEqual(
      [
        'caret-down', 'caret-up', 'caret-left', 'caret-right',
        'x', 'eye', 'eye-slash', 'calendar-blank', 'check',
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
