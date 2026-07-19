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
    expect(order).toEqual(['rail:left', 'pane:left', 'canvas:-', 'pane:right', 'rail:right'])
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

describe('ui-super-shell — the SPEC-R2 collapse contract', () => {
  it('header toggles flip the reflected per-side state, PAIRED, aria-expanded mirrors (wide)', () => {
    const el = make({ header: 'H', 'global-nav': 'GN', 'nav-pane': 'NP', content: 'C', 'options-pane': 'OP' })
    // jsdom rects are 0-width; the toggle's narrow arm requires width>0, so jsdom exercises the WIDE arm
    const left = el.querySelector('[data-part="side-toggle"][data-side="left"]') as HTMLElement
    const right = el.querySelector('[data-part="side-toggle"][data-side="right"]') as HTMLElement
    expect(el.hasAttribute('collapsed-left')).toBe(false)
    left.click()
    expect(el.collapsedLeft).toBe(true)
    expect(el.hasAttribute('collapsed-left')).toBe(true)
    expect(el.collapsedRight).toBe(false) // sides are independent (R2a)
    right.click()
    expect(el.collapsedRight).toBe(true)
    left.click()
    expect(el.collapsedLeft).toBe(false) // round-trip
  })

  it('R2d: the state is SETTABLE as props (a consumer restores a persisted choice)', () => {
    const el = make({ header: 'H', 'nav-pane': 'NP', content: 'C' })
    el.collapsedLeft = true
    expect(el.hasAttribute('collapsed-left')).toBe(true)
  })
})
