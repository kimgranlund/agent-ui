// factories.test.ts — the `croupier` persona's factory table (SPEC-R1, GH #497), mirroring
// `fixture-demo/factories.test.ts`. `ui-card`/`ui-text` carry no form association (not `UIFormElement`
// subclasses) — no jsdom ElementInternals gap here, so these probes are unrestricted (detached OR
// connected would both be safe); kept detached anyway for parity with the fixture-demo precedent.

import { describe, it, expect } from 'vitest'
import { playingCardFactory, croupierFactories } from './factories.ts'
import { croupierFragment } from './index.ts'

describe('croupier factories — table parity (mirrors fixture-demo/factories.test.ts)', () => {
  it('declares exactly one factory per fragment component type — no gap, no extra', () => {
    expect(Object.keys(croupierFactories).sort()).toEqual(Object.keys(croupierFragment.components).sort())
  })
})

describe('playingCardFactory — create()', () => {
  it('mints a real, unparented ui-card holding one ui-text', () => {
    const el = playingCardFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-card')
    expect(el.parentNode).toBeNull()
    const text = el.querySelector('ui-text')
    expect(text).not.toBeNull()
    expect((text as unknown as { emphasis: boolean }).emphasis).toBe(true)
  })
})

describe('playingCardFactory — applyProp', () => {
  it('rank + suit compose into the rank+glyph pair — never a bare rank letter', () => {
    const el = playingCardFactory.create()
    playingCardFactory.applyProp(el, 'rank', 'K')
    playingCardFactory.applyProp(el, 'suit', 'spades')
    expect(el.querySelector('ui-text')?.textContent).toBe('K♠')
  })

  it('every suit maps to its own glyph', () => {
    const el = playingCardFactory.create()
    playingCardFactory.applyProp(el, 'rank', '10')
    for (const [suit, glyph] of [
      ['hearts', '♥'],
      ['diamonds', '♦'],
      ['clubs', '♣'],
      ['spades', '♠'],
    ] as const) {
      playingCardFactory.applyProp(el, 'suit', suit)
      expect(el.querySelector('ui-text')?.textContent).toBe(`10${glyph}`)
    }
  })

  it('faceDown shows the hole-card glyph and dims the card, regardless of rank/suit', () => {
    const el = playingCardFactory.create()
    playingCardFactory.applyProp(el, 'rank', 'A')
    playingCardFactory.applyProp(el, 'suit', 'diamonds')
    playingCardFactory.applyProp(el, 'faceDown', true)
    expect(el.querySelector('ui-text')?.textContent).toBe('🂠')
    expect((el as unknown as { brightness: string }).brightness).toBe('-1')
  })

  it('un-flipping (faceDown → false) restores the rank+suit glyph and neutral brightness', () => {
    const el = playingCardFactory.create()
    playingCardFactory.applyProp(el, 'rank', 'Q')
    playingCardFactory.applyProp(el, 'suit', 'hearts')
    playingCardFactory.applyProp(el, 'faceDown', true)
    playingCardFactory.applyProp(el, 'faceDown', false)
    expect(el.querySelector('ui-text')?.textContent).toBe('Q♥')
    expect((el as unknown as { brightness: string }).brightness).toBe('0')
  })

  it('an unrecognized prop is a no-op — never throws', () => {
    const el = playingCardFactory.create()
    expect(() => playingCardFactory.applyProp(el, 'unknownProp', 'x')).not.toThrow()
  })

  it('has no value mark and no submitGate — a display-only leaf', () => {
    expect(playingCardFactory.value).toBeUndefined()
    expect(playingCardFactory.submitGate).toBeUndefined()
  })
})
