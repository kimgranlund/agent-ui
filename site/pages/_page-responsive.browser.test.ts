// _page-responsive.browser.test.ts — AC17 (GH #170 / ADR-0155): the docs-site chrome on the amended
// shell grammar, cross-engine (the `site` browser project). The site nav moved from `stack` to the
// shell's own compact/narrow OVERLAY: below the 52.5rem compact line the nav pane hides behind the
// header menu toggle; tapping opens it as an overlay (X glyph, scrim + Escape dismiss); the persisted
// wide collapse choice is untouched; the header row stays clean and nothing overflows horizontally.
//
// Band control: the composed ui-super-shell's container query resolves against ITS OWN inline-size, which
// fills the `#app` box — so sizing `#app` moves the shell across bands (16px root ⇒ 40rem=640, 52.5rem=840).
import { describe, it, expect, afterEach } from 'vitest'
import { mountPage } from './_page.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function mountAt(width: number, persistCollapsed = false): { shell: HTMLElement; app: HTMLElement } {
  document.body.innerHTML = ''
  try { localStorage.clear(); if (persistCollapsed) localStorage.setItem('agent-ui.site.nav-collapsed', 'true') } catch { /* ignore */ }
  const app = document.createElement('div')
  app.id = 'app'
  app.style.inlineSize = `${width}px`
  document.body.append(app)
  mountPage({ title: 'Probe' })
  const shell = document.querySelector('ui-super-shell') as HTMLElement
  return { shell, app }
}

const isHidden = (el: HTMLElement | null): boolean => !el || getComputedStyle(el).display === 'none'
const navPane = (shell: HTMLElement): HTMLElement => shell.querySelector('[data-part="pane"][data-slot-name="nav-pane"]') as HTMLElement
const startToggle = (shell: HTMLElement): HTMLElement => shell.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement

afterEach(() => { document.body.innerHTML = ''; try { localStorage.clear() } catch { /* ignore */ } })

describe('docs-site chrome — AC17 responsive nav (both engines)', () => {
  it('below the compact line (360px) the nav pane hides and the header shows a single menu toggle, no end toggle', async () => {
    const { shell } = mountAt(360)
    await raf()
    expect(isHidden(navPane(shell)), 'nav pane hidden below 52.5rem').toBe(true)
    expect(isHidden(startToggle(shell)), 'the menu toggle is present + visible').toBe(false)
    expect(shell.querySelector('[data-part="side-toggle"][data-side="end"]'), 'no dead end toggle (site authors no end side)').toBeNull()
  })

  it('tapping the toggle opens the nav overlay with the X glyph; scrim tap and Escape each dismiss it', async () => {
    const { shell } = mountAt(360)
    await raf()
    const toggle = startToggle(shell)
    toggle.click(); await raf()
    expect(shell.getAttribute('data-narrow-open'), 'overlay open').toBe('start')
    expect(isHidden(navPane(shell)), 'the nav pane is restored as an overlay').toBe(false)
    expect(isHidden(toggle.querySelector('[data-glyph="close"]')), 'the X glyph paints while open').toBe(false)
    expect(isHidden(toggle.querySelector('[data-glyph="menu"]')), 'the menu glyph hides while open').toBe(true)
    // the overlay carries the full vertical rail with real links (the collapse="menu" dropdown retired)
    expect(navPane(shell).querySelector('a[href]'), 'the overlay nav has real navigable links').not.toBeNull()
    // scrim tap dismisses
    const scrim = shell.querySelector('[data-part="scrim"]') as HTMLElement
    expect(isHidden(scrim), 'scrim visible while open').toBe(false)
    scrim.click(); await raf()
    expect(shell.hasAttribute('data-narrow-open'), 'scrim tap dismisses').toBe(false)
    // re-open, then Escape dismisses
    toggle.click(); await raf()
    shell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await raf()
    expect(shell.hasAttribute('data-narrow-open'), 'Escape dismisses').toBe(false)
  })

  it('at wide (1200px) the nav renders in-flow, and the persisted collapse choice round-trips via localStorage', async () => {
    const wide = mountAt(1200)
    await raf()
    expect(isHidden(navPane(wide.shell)), 'nav in-flow at wide').toBe(false)
    // toggling at wide collapses the side AND persists the choice
    startToggle(wide.shell).click(); await raf()
    expect(wide.shell.hasAttribute('collapsed-start'), 'wide toggle collapses the persisted side state').toBe(true)
    expect(localStorage.getItem('agent-ui.site.nav-collapsed'), 'the choice persists').toBe('true')
    // a fresh wide mount with the persisted choice restores it (the round-trip)
    const restored = mountAt(1200, true)
    await raf()
    expect(restored.shell.hasAttribute('collapsed-start'), 'persisted collapse restored on reload').toBe(true)
  })

  it('no horizontal overflow at 360 / 640 / 840 / 1200px, and the 360px header row stays clean', async () => {
    for (const width of [360, 640, 840, 1200]) {
      const { shell } = mountAt(width)
      await raf()
      expect(shell.scrollWidth, `no horizontal overflow of the shell at ${width}px`).toBeLessThanOrEqual(shell.clientWidth + 1)
    }
    const { shell } = mountAt(360)
    await raf()
    const header = shell.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    expect(header.scrollWidth, 'the 360px header row (brand + Search + Theme + toggle) fits without overflow').toBeLessThanOrEqual(header.clientWidth + 1)
  })
})
