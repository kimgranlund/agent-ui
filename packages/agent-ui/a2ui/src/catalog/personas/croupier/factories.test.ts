// factories.test.ts — the `croupier` persona's factory table (SPEC-R1, GH #497; ADR-0225 retarget, GH
// #1478), mirroring `fixture-demo/factories.test.ts`. `ui-playing-card` extends UIElement directly (not
// form-associated) — no jsdom ElementInternals gap here, so these probes are unrestricted (detached OR
// connected would both be safe); kept detached anyway for parity with the fixture-demo precedent.

import { describe, it, expect } from 'vitest'
import { playingCardFactory, croupierFactories } from './factories.ts'
import { croupierFragment } from './index.ts'

describe('croupier factories — table parity (mirrors fixture-demo/factories.test.ts)', () => {
  it('declares exactly one factory per fragment component type — no gap, no extra', () => {
    expect(Object.keys(croupierFactories).sort()).toEqual(Object.keys(croupierFragment.components).sort())
  })
})

describe('playingCardFactory — create() (ADR-0225 retarget — a direct ui-playing-card pass-through)', () => {
  it('mints a real, unparented ui-playing-card', () => {
    const el = playingCardFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-playing-card')
    expect(el.parentNode).toBeNull()
  })
})

describe('playingCardFactory — applyProp (direct prop pass-through, ADR-0225)', () => {
  it('rank lands on the element\'s rank property unchanged', () => {
    const el = playingCardFactory.create()
    playingCardFactory.applyProp(el, 'rank', 'K')
    expect((el as unknown as { rank: string }).rank).toBe('K')
  })

  it('suit lands on the element\'s suit property unchanged', () => {
    const el = playingCardFactory.create()
    for (const suit of ['spades', 'hearts', 'diamonds', 'clubs']) {
      playingCardFactory.applyProp(el, 'suit', suit)
      expect((el as unknown as { suit: string }).suit).toBe(suit)
    }
  })

  it('faceDown lands on the element\'s faceDown property, coerced to a real boolean', () => {
    const el = playingCardFactory.create()
    playingCardFactory.applyProp(el, 'faceDown', true)
    expect((el as unknown as { faceDown: boolean }).faceDown).toBe(true)
    playingCardFactory.applyProp(el, 'faceDown', false)
    expect((el as unknown as { faceDown: boolean }).faceDown).toBe(false)
  })

  it('a null value coerces rank/suit back to the component\'s own "" graceful-empty default', () => {
    const el = playingCardFactory.create()
    playingCardFactory.applyProp(el, 'rank', 'A')
    playingCardFactory.applyProp(el, 'rank', null)
    expect((el as unknown as { rank: string }).rank).toBe('')
    playingCardFactory.applyProp(el, 'suit', 'hearts')
    playingCardFactory.applyProp(el, 'suit', null)
    expect((el as unknown as { suit: string }).suit).toBe('')
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
