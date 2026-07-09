import { describe, it, expect } from 'vitest'
import { initialsFrom } from './avatar-initials.ts'

// avatar-initials.test.ts — LLD-C2 pure-unit rows (SPEC-R5 AC3): multi-word, single-word, grapheme
// clusters (emoji / combining marks), whitespace-only. DOM-free, no jsdom needed.

describe('initialsFrom — multi-word names', () => {
  it('takes the first grapheme of the first word + first grapheme of the last word', () => {
    expect(initialsFrom('Ada Lovelace')).toBe('AL')
  })

  it('ignores middle words — only the first and last contribute', () => {
    expect(initialsFrom('Ada Grace Lovelace')).toBe('AL')
  })

  it('collapses irregular internal whitespace (tabs, repeated spaces)', () => {
    expect(initialsFrom('  Grace   Hopper  ')).toBe('GH')
  })

  it('locale-uppercases lowercase input', () => {
    expect(initialsFrom('ada lovelace')).toBe('AL')
  })
})

describe('initialsFrom — single-word names', () => {
  it('yields exactly ONE grapheme, not two of the same letter', () => {
    expect(initialsFrom('Cher')).toBe('C')
  })

  it('uppercases a single lowercase word', () => {
    expect(initialsFrom('madonna')).toBe('M')
  })
})

describe('initialsFrom — empty / whitespace-only', () => {
  it('empty string ⇒ empty string (caller falls through to the glyph)', () => {
    expect(initialsFrom('')).toBe('')
  })

  it('whitespace-only string ⇒ empty string', () => {
    expect(initialsFrom('   \t  ')).toBe('')
  })
})

const hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'

describe.skipIf(!hasSegmenter)('initialsFrom — grapheme-cluster safety (Intl.Segmenter present)', () => {
  it('a combining-mark cluster (e + combining acute) stays ONE grapheme, base letter uppercased', () => {
    const combining = 'élan Vital' // é spelled as base + U+0301 COMBINING ACUTE ACCENT
    const result = initialsFrom(combining)
    // the cluster's base letter uppercases; the combining mark travels with it (never split, never dropped)
    expect(result.normalize('NFC')).toBe('ÉV')
  })

  it('a multi-codepoint ZWJ emoji sequence resolves as ONE grapheme, not a broken half-surrogate', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466} Team' // 👨‍👩‍👧‍👦 Team
    const result = initialsFrom(family)
    // the whole ZWJ sequence is the first grapheme (>1 UTF-16 code unit) followed by "T" from "Team"
    expect(result.length).toBeGreaterThan(2)
    expect(result.endsWith('T')).toBe(true)
  })

  it('a lone astral-plane emoji (surrogate pair) is not split mid-surrogate', () => {
    const result = initialsFrom('\u{1F600} Bot') // 😀 Bot
    expect([...result]).toHaveLength(2) // one emoji grapheme + "B"
    expect(result.endsWith('B')).toBe(true)
  })
})
