import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/shared/foundations.css'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

// ADR-0245 Amendment 7 (T-0143): every entry field rests on one boundary, the opaque 3:1 role
// --md-sys-color-neutral-field-outline (its contrast against every page plane is pinned in tokens.test.ts). Measured
// in a real engine, in both schemes: the resting frame of each field paints exactly that role. A probe element in
// the same wrapper resolves the role, so the comparison never depends on how the engine serialises an oklch colour.

const FIELDS: ReadonlyArray<readonly [string, string, string]> = [
  ['ui-text-field', '<ui-text-field label="Name"></ui-text-field>', 'ui-text-field'],
  ['ui-select', '<ui-select label="Plan"><div role="option" value="a">A</div></ui-select>', "ui-select > [data-part='trigger']"],
  ['ui-combo-box', '<ui-combo-box label="City"><div role="option" value="a">A</div></ui-combo-box>', "ui-combo-box > [data-part='editor']"],
  ['ui-otp-field (empty cell)', '<ui-otp-field length="4"></ui-otp-field>', "ui-otp-field > [data-part='cell']"],
  ['ui-otp-field (filled cell)', '<ui-otp-field length="4" value="12"></ui-otp-field>', "ui-otp-field > [data-part='cell'][data-filled]"],
  ['ui-textarea', '<ui-textarea label="Notes"></ui-textarea>', 'ui-textarea'],
]

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('the resting field boundary is the 3:1 field-outline role (ADR-0245 Amendment 7)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const [name, html, selector] of FIELDS) {
      it(`${name}, ${scheme}: the idle frame paints --md-sys-color-neutral-field-outline`, async () => {
        const wrap = document.createElement('div')
        wrap.style.colorScheme = scheme
        wrap.innerHTML = `${html}<div data-probe style="border-top: 1px solid var(--md-sys-color-neutral-field-outline)"></div>`
        document.body.append(wrap)
        mounted.push(wrap)
        await frame()
        const part = wrap.querySelector(selector) as HTMLElement
        expect(part, `anti-vacuous: ${selector} rendered`).not.toBeNull()
        const want = getComputedStyle(wrap.querySelector('[data-probe]') as HTMLElement).borderTopColor
        expect(want, 'anti-vacuous: the role resolves to a real colour').not.toMatch(/^(rgba\(0, 0, 0, 0\)|transparent)$/)
        expect(getComputedStyle(part).borderTopStyle).toBe('solid')
        expect(getComputedStyle(part).borderTopColor, `${name} idle border`).toBe(want)
      })
    }
  }

  it('a disabled field drops the boundary (the disabled row stays transparent)', async () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = '<ui-text-field label="Name" disabled></ui-text-field><ui-otp-field length="4" disabled></ui-otp-field><ui-textarea label="Notes" disabled></ui-textarea>'
    document.body.append(wrap)
    mounted.push(wrap)
    await frame()
    for (const selector of ['ui-text-field', "ui-otp-field > [data-part='cell']", 'ui-textarea']) {
      expect(getComputedStyle(wrap.querySelector(selector) as HTMLElement).borderTopColor, selector).toMatch(/^(rgba\(0, 0, 0, 0\)|transparent)$/)
    }
  })
})
