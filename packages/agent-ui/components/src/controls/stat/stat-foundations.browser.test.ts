import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs' // the model the sheet mirrors (T-0506)
import '@agent-ui/components/foundation-styles.css'
import './stat.css'
import './stat.ts'

// ui-stat geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
// derived tokens and measures against foundations-model.mjs resolve(); outside one it still measures today's values.

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
const fieldLabel = resolve('product', 'sm', 'md').type.fieldLabel

describe('ui-stat type (ADR-0245 cl.7)', () => {
  const part = (wrap: HTMLElement, p: string): HTMLElement => wrap.querySelector(`[data-part="${p}"]`) as HTMLElement
  const STAT = '<ui-stat label="Revenue" value="1.2k"></ui-stat>'

  it('inside a region: label is the field-label role and the value is the heading role', () => {
    const wrap = mount(STAT)
    expect(px(getComputedStyle(part(wrap, 'label')).fontSize)).toBeCloseTo(fieldLabel, 1)
    expect(px(getComputedStyle(part(wrap, 'value')).fontSize)).toBeCloseTo(root.type.heading, 1)
  })

  it('under data-foundations=legacy: the M3 label-medium (12px) and headline-small (24px, which the heading role also reaches at md) rows', () => {
    const wrap = mount(STAT, false)
    expect(px(getComputedStyle(part(wrap, 'label')).fontSize)).toBe(12)
    expect(px(getComputedStyle(part(wrap, 'value')).fontSize)).toBe(24)
  })
})
