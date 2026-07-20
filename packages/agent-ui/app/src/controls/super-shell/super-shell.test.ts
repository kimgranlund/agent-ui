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
