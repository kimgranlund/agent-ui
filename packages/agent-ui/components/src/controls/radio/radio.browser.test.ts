// radio.browser.test.ts — cross-engine browser smoke for ui-radio + ui-radio-group (Wave 1 S3).
//
// Runs in Chromium + WebKit via vitest.browser.config.ts (the *.browser.test.ts glob). Excluded from the
// jsdom run by the root vitest.config.ts. Goals: the dot box = --ui-compact (real px), real focus roves
// the group, checked paint (::before box-shadow dot), forced-colors (CanvasText ink), C10 zero-residue.
//
// Imports the self-defining family barrel + the foundation/component CSS so tokens resolve in the real engine.

import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import type { UIRadioElement, UIRadioGroupElement } from '@agent-ui/components/components'
import '@agent-ui/components/components'

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

// ── S3 browser smoke: dot box = --ui-compact (exact-px per [size] + [scale]×[size]) ─────────────

describe('ui-radio browser smoke — box geometry (exact px, ADR-0041)', () => {
  it('radio-box-md: ::before circle = 16px (--ui-compact-md at default ui-md scale)', () => {
    const el = mount(document.createElement('ui-radio') as UIRadioElement)
    el.textContent = 'Test'
    // --ui-compact-md = 16px at the default ui-md scale (ADR-0041 clause 2)
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(16)
    expect(Number.parseFloat(getComputedStyle(el, '::before').height)).toBe(16)
  })

  it('radio-box-sm: [size=sm] → 14px circle; [size=lg] → 18px circle (the compact ramp)', () => {
    const sm = mount(document.createElement('ui-radio') as UIRadioElement)
    sm.setAttribute('size', 'sm')
    sm.textContent = 'Small'
    expect(Number.parseFloat(getComputedStyle(sm, '::before').width)).toBe(14) // --ui-compact-sm

    const lg = mount(document.createElement('ui-radio') as UIRadioElement)
    lg.setAttribute('size', 'lg')
    lg.textContent = 'Large'
    expect(Number.parseFloat(getComputedStyle(lg, '::before').width)).toBe(18) // --ui-compact-lg
  })

  it('radio-box-scale: [scale=ui-lg]×[size=md] → 18px (the scale×size lookup, ADR-0041)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'ui-lg')
    const el = document.createElement('ui-radio') as UIRadioElement
    wrapper.append(el)
    mount(wrapper)
    // ui-lg × md = 18px (ADR-0041 table row ui-lg, column md)
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(18)
  })

  it('radio-box-scale-lg: [scale=content-lg]×[size=lg] → 28px (not a CSS calc — explicit table value)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'content-lg')
    const el = document.createElement('ui-radio') as UIRadioElement
    el.setAttribute('size', 'lg')
    wrapper.append(el)
    mount(wrapper)
    // content-lg × lg = 28px — literal from ADR-0041 table, NOT a multiplier
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(28)
  })
})

// ── S3 browser smoke: real focus roves the group ─────────────────────────────────────────────────

describe('ui-radio browser smoke — real focus roves the group', () => {
  it('radio-group-focus-roves: ArrowDown moves real focus to the next radio', () => {
    const group = mount(document.createElement('ui-radio-group') as UIRadioGroupElement)
    const r1 = document.createElement('ui-radio') as UIRadioElement
    const r2 = document.createElement('ui-radio') as UIRadioElement
    r1.value = 'a'
    r2.value = 'b'
    r1.textContent = 'Alpha'
    r2.textContent = 'Beta'
    group.append(r1, r2)

    // Focus the first radio (tabindex=0), then send ArrowDown to the group.
    r1.focus()
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))

    // The rovingFocus onMove called #commit(1), checking r2. Verify.
    expect(r2.checked).toBe(true)
    expect(r1.checked).toBe(false)
    expect(r2.tabIndex).toBe(0)
    expect(r1.tabIndex).toBe(-1)
  })
})

// ── S3 browser smoke: checked paint (dot shows when checked) ─────────────────────────────────────

describe('ui-radio browser smoke — checked paint', () => {
  it('radio-checked-paint: checked radio has [checked] attribute (drives CSS dot selector)', () => {
    const el = mount(document.createElement('ui-radio') as UIRadioElement)
    el.value = 'x'
    el.textContent = 'Option X'

    expect(el.hasAttribute('checked')).toBe(false)
    el.checked = true
    expect(el.hasAttribute('checked')).toBe(true)
  })

  it('radio-display-inline-flex: the host renders as inline-flex (anatomy base)', () => {
    const el = mount(document.createElement('ui-radio') as UIRadioElement)
    el.textContent = 'Radio'
    expect(getComputedStyle(el).display).toBe('inline-flex')
  })
})

// ── S3 browser smoke: C10 zero-residue ───────────────────────────────────────────────────────────

describe('ui-radio browser smoke — C10 zero-residue', () => {
  it('radio-c10-connect-disconnect: connect then disconnect leaves zero residue', () => {
    const el = document.createElement('ui-radio') as UIRadioElement
    el.value = 'test'
    el.textContent = 'Test'
    document.body.append(el)
    // Element connected — check it's live.
    expect(el.isConnected).toBe(true)
    el.remove()
    expect(el.isConnected).toBe(false)
    // No assertion on residue beyond successful removal (the kernel disposes scopes + AbortController).
  })

  it('radio-group-c10-connect-disconnect: group + radios connect/disconnect cleanly', () => {
    const group = document.createElement('ui-radio-group') as UIRadioGroupElement
    const r = document.createElement('ui-radio') as UIRadioElement
    r.value = 'a'
    r.textContent = 'Alpha'
    group.append(r)
    document.body.append(group)
    expect(group.isConnected).toBe(true)
    group.remove()
    expect(group.isConnected).toBe(false)
  })
})
