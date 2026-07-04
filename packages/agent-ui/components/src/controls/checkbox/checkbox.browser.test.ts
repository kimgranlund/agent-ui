import { describe, it, expect } from 'vitest'

// S1 browser smoke — ui-checkbox (decomp S1 · ADR-0041 · ADR-0042).
// Probes (AC1–AC4 from ADR-0041): the box = --ui-compact-{size} per [size]×[scale]; the checkmark
// renders (::after has a non-zero computed dimension when checked); forced-colors (manual — the Playwright
// browser does not emulate forced-colors in headless runs, so that branch is verified by reading only);
// C10 connect→disconnect zero-residue (one toggle per click, no listener stacking).
//
// These imports are direct (not through the barrel) because the component-styles barrel is the
// host's integration slice — it gains the checkbox @import at barrel-wiring time. The foundation CSS
// (tokens + dimensions) is loaded through the shared package barrel so the --md-sys-color-* / --ui-compact-*
// token chain is in place before the control sheet resolves.

import '@agent-ui/components/foundation-styles.css' // tokens (--md-sys-color-*) + dimensions (--ui-compact-*)
import './checkbox.css'                             // the control stylesheet (direct — pre-barrel)
import './checkbox.ts'                             // self-define (registers ui-checkbox)

describe('ui-checkbox browser smoke (S1 AC1–AC4)', () => {
  it('AC1 default: ::before box = 16×16 px (--ui-compact-md at ui-md scale)', () => {
    const el = document.createElement('ui-checkbox')
    document.body.append(el)
    const cs = getComputedStyle(el, '::before')
    // --ui-compact-md = 16px at the default ui-md scale (ADR-0041 clause 2)
    expect(Number.parseFloat(cs.width)).toBe(16)
    expect(Number.parseFloat(cs.height)).toBe(16)
    el.remove()
  })

  it('AC1 [size=sm] → 14px box; [size=lg] → 18px box (the compact ramp)', () => {
    const sm = document.createElement('ui-checkbox')
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    expect(Number.parseFloat(getComputedStyle(sm, '::before').width)).toBe(14) // --ui-compact-sm
    sm.remove()

    const lg = document.createElement('ui-checkbox')
    lg.setAttribute('size', 'lg')
    document.body.append(lg)
    expect(Number.parseFloat(getComputedStyle(lg, '::before').width)).toBe(18) // --ui-compact-lg
    lg.remove()
  })

  it('AC1 [scale=ui-lg] × [size=md] → 18px box (the scale × size lookup, ADR-0041 clause 2)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'ui-lg')
    const el = document.createElement('ui-checkbox')
    wrapper.append(el)
    document.body.append(wrapper)
    // ui-lg × md = 18px (ADR-0041 table row ui-lg, column md)
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(18)
    wrapper.remove()
  })

  it('AC4 no --ui-scale multiplier: [scale=content-lg] × [size=lg] → 28px (not a CSS calc result)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'content-lg')
    const el = document.createElement('ui-checkbox')
    el.setAttribute('size', 'lg')
    wrapper.append(el)
    document.body.append(wrapper)
    // content-lg × lg = 28px — the literal from the ADR-0041 table, NOT a scale multiplier
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(28)
    wrapper.remove()
  })

  it('checked: ::after glyph is visible — has a positive computed width (checkmark renders)', () => {
    const el = document.createElement('ui-checkbox')
    el.setAttribute('checked', '') // boolean attribute → checked=true
    document.body.append(el)
    // ::after with clip-path checkmark: inline-size = 60% of 16px = 9.6px
    const afterW = Number.parseFloat(getComputedStyle(el, '::after').width)
    expect(afterW).toBeGreaterThan(0)
    el.remove()
  })

  it('unchecked: ::after glyph is invisible — zero or no computed width (no checkmark)', () => {
    const el = document.createElement('ui-checkbox')
    document.body.append(el)
    // unchecked ::after has no background-color, no inline-size declared → width resolves to 0 or auto
    const afterW = Number.parseFloat(getComputedStyle(el, '::after').width)
    expect(afterW).toBe(0)
    el.remove()
  })

  it('C10 connect→disconnect zero-residue: reconnect produces exactly one toggle per click', () => {
    const el = document.createElement('ui-checkbox')
    const cb = el as HTMLElement & { checked: boolean }
    document.body.append(el)

    // click while connected → toggle (false → true)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.getAttribute('checked')).toBe('') // checked reflects to attribute

    el.remove() // disconnect
    document.body.append(el) // reconnect

    // A single click should produce exactly one toggle (true → false), not two (no stacked listeners)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.getAttribute('checked')).toBeNull() // one toggle: true → false
    expect(cb.checked).toBe(false)
    el.remove()
  })
})
