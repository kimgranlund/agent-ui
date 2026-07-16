import { describe, it, expect } from 'vitest'
import { UIProgressElement } from './progress.ts'

// progress.test.ts — LLD-C1 jsdom behaviour probes (props/attributes, hardening, DOM shape, ARIA effect).
// jsdom is blind to painted geometry, computed-style ink, and animation (SPEC-N2) — the whole-shape floor,
// the fill-proportion measurement, RTL direction, reduced-motion, and forced-colors legs live in
// progress.browser.test.ts; this file covers everything jsdom CAN see: prop typing, attribute coercion,
// the effective-pair hardening table (SPEC-R1), and the internals ARIA values (ariaValueNow/Min/Max/Text
// IDL properties ARE present in jsdom — range-element.test.ts precedent).

/** Re-expose the protected internals so probes can read role, ariaValueNow/Min/Max/Text, and ariaLabel. */
class ProbeProgress extends UIProgressElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
if (!customElements.get('ui-progress-probe')) customElements.define('ui-progress-probe', ProbeProgress)

function make(): ProbeProgress {
  return new ProbeProgress()
}

describe('UIProgressElement — upgrade + typed props', () => {
  it('defaults: current=null, max=100, label=""', () => {
    const el = document.createElement('ui-progress') as UIProgressElement
    expect(el).toBeInstanceOf(UIProgressElement)
    expect(el.current).toBeNull()
    expect(el.max).toBe(100)
    expect(el.label).toBe('')
  })

  it('self-defines as ui-progress, guarded against double-define', () => {
    expect(customElements.get('ui-progress')).toBe(UIProgressElement)
    expect(() => {
      if (!customElements.get('ui-progress')) customElements.define('ui-progress', UIProgressElement)
    }).not.toThrow()
  })

  it('a current="42" attribute upgrades to the typed number', () => {
    const el = document.createElement('ui-progress') as UIProgressElement
    el.setAttribute('current', '42')
    document.body.append(el)
    expect(el.current).toBe(42)
    el.remove()
  })

  it('a max="200" attribute upgrades to the typed number', () => {
    const el = document.createElement('ui-progress') as UIProgressElement
    el.setAttribute('max', '200')
    document.body.append(el)
    expect(el.max).toBe(200)
    el.remove()
  })
})

describe('UIProgressElement — DOM shape (LLD-C1)', () => {
  it('builds track > fill once, no leftover nodes on repeated prop changes', async () => {
    const el = document.createElement('ui-progress') as UIProgressElement
    document.body.append(el)
    await el.updateComplete
    expect(el.childElementCount).toBe(1)
    const track = el.querySelector('[data-part="track"]')
    expect(track).not.toBeNull()
    expect(track?.children.length).toBe(1)
    expect(track?.querySelector('[data-part="fill"]')).not.toBeNull()

    el.current = 10
    await el.updateComplete
    el.current = 90
    await el.updateComplete
    expect(el.childElementCount).toBe(1) // still exactly one track — no duplicate mint
    el.remove()
  })

  it('survives disconnect/reconnect without minting a second track/fill pair', async () => {
    const el = document.createElement('ui-progress') as UIProgressElement
    document.body.append(el)
    await el.updateComplete
    el.remove()
    document.body.append(el)
    await el.updateComplete
    expect(el.childElementCount).toBe(1)
    expect(el.querySelectorAll('[data-part="track"]').length).toBe(1)
    expect(el.querySelectorAll('[data-part="fill"]').length).toBe(1)
    el.remove()
  })

  it('determinate value=42/max=100 ⇒ fill --_pct=42, no data-indeterminate', async () => {
    const el = document.createElement('ui-progress') as UIProgressElement
    el.current = 42
    document.body.append(el)
    await el.updateComplete
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement
    expect(fill.style.getPropertyValue('--_pct')).toBe('42')
    expect(fill.hasAttribute('data-indeterminate')).toBe(false)
    el.remove()
  })

  it('indeterminate (no value) ⇒ data-indeterminate present, --_pct unset', async () => {
    const el = document.createElement('ui-progress') as UIProgressElement
    document.body.append(el)
    await el.updateComplete
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement
    expect(fill.hasAttribute('data-indeterminate')).toBe(true)
    expect(fill.style.getPropertyValue('--_pct')).toBe('')
    el.remove()
  })

  it('transitioning value → null flips determinate to indeterminate and back', async () => {
    const el = document.createElement('ui-progress') as UIProgressElement
    el.current = 50
    document.body.append(el)
    await el.updateComplete
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement
    expect(fill.hasAttribute('data-indeterminate')).toBe(false)

    el.current = null
    await el.updateComplete
    expect(fill.hasAttribute('data-indeterminate')).toBe(true)

    el.current = 75
    await el.updateComplete
    expect(fill.hasAttribute('data-indeterminate')).toBe(false)
    expect(fill.style.getPropertyValue('--_pct')).toBe('75')
    el.remove()
  })
})

describe('UIProgressElement — hardening (SPEC-R1 AC1/AC2, the effective-pair table)', () => {
  const cases: Array<{ name: string; value?: number | string; max?: number | string; wantIndeterminate: boolean; wantPct?: string }> = [
    { name: 'value absent', wantIndeterminate: true },
    { name: 'value=NaN', value: Number.NaN, wantIndeterminate: true },
    { name: 'value=Infinity', value: Number.POSITIVE_INFINITY, wantIndeterminate: true },
    { name: 'value=-Infinity', value: Number.NEGATIVE_INFINITY, wantIndeterminate: true },
    { name: 'value=-10 clamps to 0', value: -10, wantIndeterminate: false, wantPct: '0' },
    { name: 'value=150 over max=100 clamps to 100', value: 150, wantIndeterminate: false, wantPct: '100' },
    { name: 'max=NaN floors to 100 (value=50 stays 50%)', value: 50, max: Number.NaN, wantIndeterminate: false, wantPct: '50' },
    { name: 'max=0 floors to 100', value: 50, max: 0, wantIndeterminate: false, wantPct: '50' },
    { name: 'max=-5 floors to 100', value: 50, max: -5, wantIndeterminate: false, wantPct: '50' },
  ]

  for (const c of cases) {
    it(`${c.name} ⇒ no exception, ${c.wantIndeterminate ? 'indeterminate' : `determinate --_pct=${c.wantPct}`}`, async () => {
      const el = document.createElement('ui-progress') as UIProgressElement
      if (c.value !== undefined) el.current = c.value as number
      if (c.max !== undefined) el.max = c.max as number
      expect(() => document.body.append(el)).not.toThrow()
      await el.updateComplete
      const fill = el.querySelector('[data-part="fill"]') as HTMLElement
      expect(fill.hasAttribute('data-indeterminate')).toBe(c.wantIndeterminate)
      if (!c.wantIndeterminate) expect(fill.style.getPropertyValue('--_pct')).toBe(c.wantPct)
      el.remove()
    })
  }
})

describe('UIProgressElement — ARIA (SPEC-R3)', () => {
  it('AC1: value=42 label="Indexing" ⇒ role=progressbar, valueNow=42, valueText="42%", ariaLabel="Indexing"', async () => {
    const el = make()
    el.current = 42
    el.label = 'Indexing'
    document.body.append(el)
    await el.updateComplete
    expect(el.probeInternals.role).toBe('progressbar')
    expect(el.probeInternals.ariaValueMin).toBe('0')
    expect(el.probeInternals.ariaValueMax).toBe('100')
    expect(el.probeInternals.ariaValueNow).toBe('42')
    expect(el.probeInternals.ariaValueText).toBe('42%')
    expect(el.probeInternals.ariaLabel).toBe('Indexing')
    el.remove()
  })

  it('AC2: removing value at runtime clears valueNow/valueText while role/min/max persist — and restores', async () => {
    const el = make()
    el.current = 30
    document.body.append(el)
    await el.updateComplete
    expect(el.probeInternals.ariaValueNow).toBe('30')

    el.current = null
    await el.updateComplete
    expect(el.probeInternals.ariaValueNow).toBeNull()
    expect(el.probeInternals.ariaValueText).toBeNull()
    expect(el.probeInternals.role).toBe('progressbar')
    expect(el.probeInternals.ariaValueMin).toBe('0')
    expect(el.probeInternals.ariaValueMax).toBe('100')

    el.current = 55
    await el.updateComplete
    expect(el.probeInternals.ariaValueNow).toBe('55')
    expect(el.probeInternals.ariaValueText).toBe('55%')
    el.remove()
  })

  it('never aria-hidden — role is always progressbar, even indeterminate with no label', async () => {
    const el = make()
    document.body.append(el)
    await el.updateComplete
    expect(el.probeInternals.role).toBe('progressbar')
    expect(el.probeInternals.ariaHidden).not.toBe('true')
    expect(el.probeInternals.ariaLabel).toBeNull()
    el.remove()
  })

  it('empty label ⇒ ariaLabel null; non-empty label ⇒ ariaLabel set', async () => {
    const el = make()
    document.body.append(el)
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBeNull()

    el.label = 'Upload progress'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Upload progress')
    el.remove()
  })
})
