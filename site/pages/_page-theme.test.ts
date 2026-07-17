import { describe, it, expect, beforeEach } from 'vitest'
import { mountPage, mountFullBleedPage } from './_page.ts'

// _page-theme.test.ts — TKT-0088/ADR-0141 cl.1/4/5: the shell IS the site-wide ui-theme-provider, and the
// "Theme" header slot is a real control, not the old inert placeholder. jsdom proof (structure + wiring);
// the actual repaint/computed-style leg is a browser concern this ticket's Findings cover separately.

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>'
  localStorage.clear()
})

const shellOf = (): Element => document.querySelector('.app-shell')!

describe('mountPage — the shell is a real ui-theme-provider (ADR-0141 cl.1)', () => {
  it('the .app-shell root is a <ui-theme-provider>, not the old plain <div>', () => {
    mountPage({ title: 'Probe' })
    expect(shellOf().tagName.toLowerCase()).toBe('ui-theme-provider')
  })

  it('applies the persisted scheme/theme BEFORE first paint (no default-then-repaint flash)', () => {
    localStorage.setItem('agent-ui.scheme', 'dark')
    mountPage({ title: 'Probe' })
    expect(shellOf().getAttribute('scheme')).toBe('dark')
  })

  it('an unset persisted scheme leaves scheme="" (not "light") — ADR-0117\'s unset-inherits fix, unregressed', () => {
    // A reflected prop's default '' still WRITES the attribute (props.ts reflectOut: only a `null`
    // serialization removes it) — the load-bearing claim is the VALUE, never silently promoted to
    // 'light', not attribute-presence.
    mountPage({ title: 'Probe' })
    expect(shellOf().getAttribute('scheme')).toBe('')
  })

  it('the header renders Search (still inert — a separate ticket\'s concern) and a real Theme control', () => {
    mountPage({ title: 'Probe' })
    const header = document.querySelector('.app-context-header')!
    const search = [...header.querySelectorAll('.app-context-slot')].find((s) => s.textContent === 'Search')
    expect(search, 'Search placeholder').toBeTruthy()
    const themeGroup = header.querySelector('.app-context-theme-group')
    expect(themeGroup, 'the real Theme control').toBeTruthy()
    // no leftover inert "Theme" span — the control REPLACED it, not sat beside it
    const inertTheme = [...header.querySelectorAll('.app-context-slot')].find((s) => s.textContent === 'Theme')
    expect(inertTheme, 'no stale inert Theme placeholder survives').toBeFalsy()
  })

  it('the Theme control has a scheme-cycle button and a theme ui-menu, both real ui-button/ui-menu elements', () => {
    mountPage({ title: 'Probe' })
    const group = document.querySelector('.app-context-theme-group')!
    const schemeBtn = group.querySelector('ui-button')
    const menu = group.querySelector('ui-menu')
    expect(schemeBtn, 'scheme-cycle ui-button').toBeTruthy()
    expect(menu, 'theme ui-menu').toBeTruthy()
    expect(menu?.querySelector('[data-picker="theme"]'), 'the menu trigger carries data-picker="theme"').toBeTruthy()
  })

  it('the scheme-cycle button shows "Auto" by default and cycles Auto -> Light -> Dark -> Auto on click', () => {
    mountPage({ title: 'Probe' })
    const btn = document.querySelector('.app-context-theme-group ui-button') as HTMLElement
    expect(btn.textContent).toBe('Auto')
    btn.click()
    expect(btn.textContent).toBe('Light')
    expect(shellOf().getAttribute('scheme')).toBe('light')
    btn.click()
    expect(btn.textContent).toBe('Dark')
    expect(shellOf().getAttribute('scheme')).toBe('dark')
    btn.click()
    expect(btn.textContent).toBe('Auto')
    expect(shellOf().getAttribute('scheme')).toBe('')
  })

  it('clicking the scheme-cycle button persists the choice for the next load', () => {
    mountPage({ title: 'Probe' })
    const btn = document.querySelector('.app-context-theme-group ui-button') as HTMLElement
    btn.click()
    expect(localStorage.getItem('agent-ui.scheme')).toBe('light')
  })
})

describe('mountFullBleedPage — the SAME shell integration, the full-bleed variant', () => {
  it('the .app-shell root is also a <ui-theme-provider>', () => {
    mountFullBleedPage()
    expect(shellOf().tagName.toLowerCase()).toBe('ui-theme-provider')
  })

  it('renders the same real Theme control', () => {
    mountFullBleedPage()
    expect(document.querySelector('.app-context-theme-group')).toBeTruthy()
  })
})
