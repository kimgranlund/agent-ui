import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

// ui-text geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
// derived tokens and measures against scale.mjs resolve(); outside one it still measures today's values.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

function mount(html: string, region = true): HTMLElement {
  const wrap = document.createElement('div')
  if (region) {
    wrap.setAttribute('data-tier', 'product')
    wrap.setAttribute('data-scale', 'sm')
  } else {
    wrap.setAttribute('data-foundations', 'legacy') // ADR-0245 cl.10e: the opt-out renders today's geometry
  }
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}

const px = (v: string): number => Number.parseFloat(v)
const root = resolve('product', 'sm', 'md')

// variant -> the derived role it reads (ADR-0245 cl.7), against resolve() at product / sm / md.
const ROLE: Record<string, number> = {
  display: root.type.display,
  headline: root.type.heading,
  title: root.type.title,
  body: root.type.body,
  label: root.type.fieldLabel,
  kicker: root.type.groupKicker, // an alias of the group label, not the section-label eyebrow (T-0117, ADR-0245 Amendment 3)
  overline: root.type.groupKicker,
  lead: root.type.subhead,
  quote: root.type.subhead,
}

describe('ui-text sizes (ADR-0245 cl.7)', () => {
  for (const [variant, size] of Object.entries(ROLE)) {
    it(`inside a region: ${variant} reads the derived role (${size}px at md)`, () => {
      const el = mount(`<ui-text variant="${variant}" size="md">Text</ui-text>`).querySelector('ui-text') as HTMLElement
      expect(px(getComputedStyle(el).fontSize)).toBeCloseTo(size, 1)
    })
  }

  it("inside a region: size shifts the text's own n (body lg is the lg body role)", () => {
    const el = mount('<ui-text variant="body" size="lg">Text</ui-text>').querySelector('ui-text') as HTMLElement
    expect(px(getComputedStyle(el).fontSize)).toBeCloseTo(resolve('product', 'sm', 'lg').type.body, 1)
  })

  it('under data-foundations=legacy: display/md is still the M3 45px row, not the derived 32px', () => {
    const el = mount('<ui-text variant="display">Text</ui-text>', false).querySelector('ui-text') as HTMLElement
    expect(px(getComputedStyle(el).fontSize)).toBe(45)
  })
})
