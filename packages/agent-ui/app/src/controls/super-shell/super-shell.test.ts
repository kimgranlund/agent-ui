// super-shell.test.ts — ui-super-shell (M5, GH #83) vs shell-archetypes-m5.spec.md.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { UISuperShellElement } from './super-shell.ts'

const mounted: HTMLElement[] = []
afterEach(() => { for (const el of mounted.splice(0)) el.remove() })

function make(slots: Partial<Record<string, string>>): UISuperShellElement {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  for (const [slot, text] of Object.entries(slots)) {
    const child = document.createElement('div')
    child.setAttribute('data-slot', slot)
    child.textContent = text ?? slot
    el.append(child)
  }
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-super-shell — the SPEC-R1 grammar', () => {
  it('upgrades and sorts authored children into [ bar | rail|pane|canvas|pane|rail | bar ] (full grammar)', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: 'C', 'options-pane': 'OP', 'global-options': 'GO', footer: 'F' })
    expect(el).toBeInstanceOf(UISuperShellElement)
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    const order = [...middle.children].map((c) => `${c.getAttribute('data-part')}:${c.getAttribute('data-side') ?? '-'}`)
    expect(order).toEqual(['rail:start', 'pane:start', 'canvas:-', 'pane:end', 'rail:end'])
    expect(el.querySelectorAll('[data-part="bar"]')).toHaveLength(2)
    expect((el.querySelector('[data-bar="header"]') as HTMLElement).textContent).toContain('H')
  })

  it('ABSENCE law: unfilled slots contribute no box; unmarked children fold into content; missing content warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = make({ content: 'C' })
    expect(el.querySelector('[data-part="bar"]')).toBeNull()
    expect(el.querySelector('[data-part="rail"]')).toBeNull()
    expect(el.querySelector('[data-part="pane"]')).toBeNull()
    expect(el.querySelector('[data-part="side-toggle"]')).toBeNull() // no header ⇒ no toggles (R2b)
    const bare = document.createElement('ui-super-shell') as UISuperShellElement
    bare.append(document.createElement('p')) // unmarked ⇒ content
    document.body.append(bare); mounted.push(bare)
    expect(bare.querySelector('[data-part="canvas"] p')).not.toBeNull()
    const empty = document.createElement('ui-super-shell')
    document.body.append(empty); mounted.push(empty as HTMLElement)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no content slot'))
    warn.mockRestore()
  })

  it('R1b ring-dropping recursion: a nested shell in content composes with panes and NO rails (depth 2)', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: '' })
    const canvas = el.querySelector('[data-part="canvas"]') as HTMLElement
    const inner = document.createElement('ui-super-shell') as UISuperShellElement
    const innerPane = document.createElement('div'); innerPane.setAttribute('data-slot', 'nav-pane'); innerPane.textContent = 'selections'
    const innerContent = document.createElement('div'); innerContent.setAttribute('data-slot', 'content'); innerContent.textContent = 'inner canvas'
    inner.append(innerPane, innerContent)
    canvas.append(inner)
    // the nested level authors no rails — none render (zero extra code, the absence law)
    expect(inner.querySelector('[data-part="rail"]')).toBeNull()
    expect(inner.querySelector('[data-part="pane"]')).not.toBeNull()
    expect(inner.querySelector('[data-part="canvas"]')?.textContent).toBe('inner canvas')
  })
})

describe('ui-super-shell — SPEC-R5 amendment: N stacked panes per side, asymmetric composition (LLD-C3, GH #96)', () => {
  it('R5a: a side stacks MULTIPLE panes (rail, then panes outer-to-content) — no longer a rail+pane ceiling', () => {
    const el = make({ 'global-nav': 'GN', 'nav-pane': 'NP', 'section-nav': 'SN', content: 'C' })
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    const order = [...middle.children].map((c) => `${c.getAttribute('data-part')}:${c.getAttribute('data-slot-name')}:${c.getAttribute('data-side')}`)
    expect(order).toEqual(['rail:global-nav:start', 'pane:nav-pane:start', 'pane:section-nav:start', 'canvas:content:null'])
  })

  it('R5b: the two sides compose INDEPENDENTLY — a side may stack more panes than its mirror (dual-sidebar frame shape)', () => {
    const el = make({ 'global-nav': 'GN', 'nav-pane': 'NP', 'section-nav': 'SN', content: 'C', 'options-pane': 'OP', 'global-options': 'GO' })
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    const order = [...middle.children].map((c) => `${c.getAttribute('data-part')}:${c.getAttribute('data-side') ?? '-'}`)
    // left (start): rail + 2 panes · right (end): 1 pane + rail — asymmetric pane counts, R5b
    expect(order).toEqual(['rail:start', 'pane:start', 'pane:start', 'canvas:-', 'pane:end', 'rail:end'])
    expect(el.querySelectorAll('[data-side="start"]')).toHaveLength(3)
    expect(el.querySelectorAll('[data-side="end"]')).toHaveLength(2)
  })

  it('R5c: options-section (the end-side mirror of section-nav) stacks closest to content, absence law applies to both new slots', () => {
    const el = make({ content: 'C', 'options-pane': 'OP', 'options-section': 'OS', 'global-options': 'GO' })
    const middle = el.querySelector('[data-part="middle"]') as HTMLElement
    const order = [...middle.children].map((c) => c.getAttribute('data-slot-name'))
    expect(order).toEqual(['content', 'options-section', 'options-pane', 'global-options'])
    // section-nav authored on neither side ⇒ no box anywhere (R1 absence law extends to the new slots)
    expect(el.querySelector('[data-slot-name="section-nav"]')).toBeNull()
  })

  it('R5c: section-nav and options-section carry navigation/complementary landmarks, matching their primary-pane mirrors', () => {
    const el = make({ 'nav-pane': 'NP', 'section-nav': 'SN', content: 'C', 'options-section': 'OS', 'options-pane': 'OP' })
    expect(el.querySelector('[data-slot-name="section-nav"]')?.getAttribute('role')).toBe('navigation')
    expect(el.querySelector('[data-slot-name="options-section"]')?.getAttribute('role')).toBe('complementary')
  })

  it('R5d: collapsing a side hides its WHOLE stack together — no per-pane collapse', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', 'section-nav': 'SN', content: 'C' })
    el.collapsedStart = true
    // the existing whole-side CSS rule (`[collapsed-start] [data-side='start']`) targets every part
    // sharing that attribute — jsdom doesn't compute layout, so assert the SHARED selector surface
    // rather than a computed style: all three start-side parts carry the identical data-side value
    // the collapse rule keys off, with no per-pane escape hatch anywhere in the markup.
    const startParts = el.querySelectorAll('[data-part="middle"] > [data-side="start"]')
    expect(startParts).toHaveLength(3)
    for (const part of startParts) expect(part.getAttribute('data-side')).toBe('start')
  })
})

describe('ui-super-shell — landmarks (LLD-C1, GH #94)', () => {
  it('every part carries its default ARIA landmark', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: 'C', 'options-pane': 'OP', 'global-options': 'GO', footer: 'F' })
    expect(el.querySelector('[data-bar="header"]')?.getAttribute('role')).toBe('banner')
    expect(el.querySelector('[data-bar="footer"]')?.getAttribute('role')).toBe('contentinfo')
    expect(el.querySelector('[data-part="canvas"]')?.getAttribute('role')).toBe('main')
    expect(el.querySelector('[data-slot-name="global-nav"]')?.getAttribute('role')).toBe('navigation')
    expect(el.querySelector('[data-slot-name="nav-pane"]')?.getAttribute('role')).toBe('navigation')
    expect(el.querySelector('[data-slot-name="global-options"]')?.getAttribute('role')).toBe('complementary')
    expect(el.querySelector('[data-slot-name="options-pane"]')?.getAttribute('role')).toBe('complementary')
  })

  it('a data-landmark override on the first authored child wins over the slot default', () => {
    const el = document.createElement('ui-super-shell') as UISuperShellElement
    const nav = document.createElement('div')
    nav.setAttribute('data-slot', 'nav-pane')
    nav.setAttribute('data-landmark', 'complementary') // the a2ui-live chat-composer precedent (ADR-0083)
    const content = document.createElement('div')
    content.setAttribute('data-slot', 'content')
    el.append(nav, content)
    document.body.append(el)
    mounted.push(el)
    expect(el.querySelector('[data-slot-name="nav-pane"]')?.getAttribute('role')).toBe('complementary')
  })

  it('an unrecognized data-landmark value is ignored — falls back to the slot default (fail-closed)', () => {
    const el = document.createElement('ui-super-shell') as UISuperShellElement
    const nav = document.createElement('div')
    nav.setAttribute('data-slot', 'nav-pane')
    nav.setAttribute('data-landmark', 'not-a-real-role')
    const content = document.createElement('div')
    content.setAttribute('data-slot', 'content')
    el.append(nav, content)
    document.body.append(el)
    mounted.push(el)
    expect(el.querySelector('[data-slot-name="nav-pane"]')?.getAttribute('role')).toBe('navigation')
  })

  it('only the HOST carries no role of its own — the landmarks live on the parts, not the custom element', () => {
    const el = make({ header: 'H', content: 'C' })
    expect(el.getAttribute('role')).toBeNull()
  })
})

describe('ui-super-shell — the SPEC-R2 collapse contract (logical start/end, LLD-C4)', () => {
  it('header toggles flip the reflected per-side state, PAIRED, aria-expanded mirrors (wide)', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: 'C', 'options-pane': 'OP' })
    // jsdom rects are 0-width; the toggle's narrow arm requires width>0, so jsdom exercises the WIDE arm
    const start = el.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
    const end = el.querySelector('[data-part="side-toggle"][data-side="end"]') as HTMLElement
    expect(el.hasAttribute('collapsed-start')).toBe(false)
    start.click()
    expect(el.collapsedStart).toBe(true)
    expect(el.hasAttribute('collapsed-start')).toBe(true)
    expect(el.collapsedEnd).toBe(false) // sides are independent (R2a)
    end.click()
    expect(el.collapsedEnd).toBe(true)
    start.click()
    expect(el.collapsedStart).toBe(false) // round-trip
  })

  it('R2d: the state is SETTABLE as props (a consumer restores a persisted choice)', () => {
    const el = make({ header: 'H', 'nav-pane': 'NP', content: 'C' })
    el.collapsedStart = true
    expect(el.hasAttribute('collapsed-start')).toBe(true)
  })

  it('toggle aria-labels are direction-agnostic text ("start"/"end"), never "left"/"right"', () => {
    const el = make({ header: 'H', 'nav-pane': 'NP', content: 'C', 'options-pane': 'OP' })
    const start = el.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
    const end = el.querySelector('[data-part="side-toggle"][data-side="end"]') as HTMLElement
    expect(start.getAttribute('aria-label')).toBe('Toggle start panes')
    expect(end.getAttribute('aria-label')).toBe('Toggle end panes')
  })
})
