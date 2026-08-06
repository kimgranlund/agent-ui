// factories.test.ts — the `fixture-demo` persona's factory table (SPEC-R1), mirroring
// `a2ui-basic/factories.test.ts`'s "one factory really produces a working element" precedent:
// isolated proof that `fixtureBannerFactory` mints a real element and `applyProp` reflects `text` onto
// `textContent`, independent of the compose/registration machinery `compose.test.ts` already covers.

import { describe, it, expect } from 'vitest'
import { fixtureBannerFactory, fixtureDemoFactories } from './factories.ts'
import { fixtureDemoFragment } from './index.ts'

describe('fixture-demo factories — table parity (mirrors a2ui-basic/factories.test.ts)', () => {
  it('declares exactly one factory per fragment component type — no gap, no extra', () => {
    expect(Object.keys(fixtureDemoFactories).sort()).toEqual(Object.keys(fixtureDemoFragment.components).sort())
  })
})

describe('fixture-demo factories — FixtureBanner (bespoke <div> primitive)', () => {
  it('create() mints a real, unparented <div>', () => {
    expect(fixtureBannerFactory.tag).toBe('div')
    const el = fixtureBannerFactory.create()
    expect(el).toBeInstanceOf(HTMLDivElement)
    expect(el.tagName.toLowerCase()).toBe('div')
    expect(el.parentNode).toBeNull()
  })

  it('applyProp("text", …) reflects onto textContent', () => {
    const el = fixtureBannerFactory.create()
    fixtureBannerFactory.applyProp(el, 'text', 'Hello fixture')
    expect(el.textContent).toBe('Hello fixture')
  })

  it('applyProp("text", null/undefined) clears textContent (never the literal string "null")', () => {
    const el = fixtureBannerFactory.create()
    fixtureBannerFactory.applyProp(el, 'text', 'was set')
    fixtureBannerFactory.applyProp(el, 'text', null)
    expect(el.textContent).toBe('')
    fixtureBannerFactory.applyProp(el, 'text', 'was set again')
    fixtureBannerFactory.applyProp(el, 'text', undefined)
    expect(el.textContent).toBe('')
  })

  it('applyProp on an unrecognized prop is a no-op — never throws', () => {
    const el = fixtureBannerFactory.create()
    expect(() => fixtureBannerFactory.applyProp(el, 'unknownProp', 'x')).not.toThrow()
    expect(el.textContent).toBe('')
  })
})
