// super-shell.browser.test.ts — ui-super-shell cross-engine smoke: the LLD-C4 (GH #95) logical-
// direction guarantee, which no jsdom probe can verify (bidi reversal is a real layout computation).
// Precedent: split.browser.test.ts's "RTL drag inversion (SPEC-R3 AC3)" — mount the SAME markup
// under dir="ltr" and dir="rtl", assert the DOM-first ("start") side renders on the OPPOSITE
// physical edge, proving `[data-part='middle']`'s plain row-flex bidi reversal does the placement
// job with zero `:dir()` CSS and zero runtime direction read in super-shell.ts.
import { describe, it, expect, afterEach } from 'vitest'
// CSS wiring: the foundation (--md-sys-color-* roles + the dimensional ramp) FIRST, then this
// component's own sheet, then the self-defining element module (the app-shell.browser.test.ts /
// row.browser.test.ts precedent — @agent-ui/app has no component-styles barrel yet, LLD-C8).
import '@agent-ui/components/foundation-styles.css'
import './super-shell.css'
import { UISuperShellElement } from './super-shell.ts'

const mounted: HTMLElement[] = []
afterEach(() => { for (const el of mounted.splice(0)) el.remove() })

function mount(dir?: 'rtl'): UISuperShellElement {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  // SPEC-R4: @container hides [data-side] entirely below 40rem (640px) — stay comfortably above
  // the narrow-auto-collapse breakpoint so this suite exercises the WIDE-mode bidi placement.
  el.style.inlineSize = '900px'
  el.style.blockSize = '300px'
  if (dir) el.setAttribute('dir', dir)
  const header = document.createElement('div')
  header.setAttribute('data-slot', 'header')
  const startPane = document.createElement('div')
  startPane.setAttribute('data-slot', 'nav-pane')
  const content = document.createElement('div')
  content.setAttribute('data-slot', 'content')
  const endPane = document.createElement('div')
  endPane.setAttribute('data-slot', 'options-pane')
  el.append(header, startPane, content, endPane)
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-super-shell cross-engine smoke — logical direction (LLD-C4, GH #95)', () => {
  it('the DOM-first ("start") pane renders on the LEFT under ltr and the RIGHT under rtl — pure CSS bidi, no :dir() selector', () => {
    const ltr = mount()
    const ltrStart = ltr.querySelector('[data-slot-name="nav-pane"]') as HTMLElement
    const ltrEnd = ltr.querySelector('[data-slot-name="options-pane"]') as HTMLElement
    expect(ltrStart.getBoundingClientRect().left).toBeLessThan(ltrEnd.getBoundingClientRect().left)
    ltr.remove()

    const rtl = mount('rtl')
    const rtlStart = rtl.querySelector('[data-slot-name="nav-pane"]') as HTMLElement
    const rtlEnd = rtl.querySelector('[data-slot-name="options-pane"]') as HTMLElement
    expect(rtlStart.getBoundingClientRect().left).toBeGreaterThan(rtlEnd.getBoundingClientRect().left)
  })

  it('clicking the DOM-first ("start") header toggle collapses the START pane, regardless of dir', async () => {
    for (const dir of [undefined, 'rtl'] as const) {
      const el = mount(dir)
      const startToggle = el.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
      startToggle.click()
      await el.updateComplete
      expect(el.collapsedStart, `dir=${dir ?? 'ltr'}`).toBe(true)
      expect(el.collapsedEnd, `dir=${dir ?? 'ltr'}`).toBe(false)
      el.remove()
    }
  })

  it('the start toggle sits on the visual LEFT under ltr and the visual RIGHT under rtl (real bidi reversal of the header bar)', () => {
    const ltr = mount()
    const ltrStart = ltr.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
    const ltrEnd = ltr.querySelector('[data-part="side-toggle"][data-side="end"]') as HTMLElement
    expect(ltrStart.getBoundingClientRect().left).toBeLessThan(ltrEnd.getBoundingClientRect().left)
    ltr.remove()

    const rtl = mount('rtl')
    const rtlStart = rtl.querySelector('[data-part="side-toggle"][data-side="start"]') as HTMLElement
    const rtlEnd = rtl.querySelector('[data-part="side-toggle"][data-side="end"]') as HTMLElement
    expect(rtlStart.getBoundingClientRect().left).toBeGreaterThan(rtlEnd.getBoundingClientRect().left)
  })
})

// A fuller mount for the GH #253 radius probes: a footer (not composed by the base `mount()` helper
// above unless a `data-slot="footer"` child is authored) + a `global-nav` rail (only `global-nav`/
// `global-options` compose a `[data-part='rail']`; `nav-pane`/`options-pane` compose a `[data-part=
// 'pane']` instead) + `resizable-start` (the pane-resizer only composes when its side is resizable
// AND has at least one pane, super-shell.ts).
function mountFullChrome(): UISuperShellElement {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  el.style.inlineSize = '900px'
  el.style.blockSize = '300px'
  el.resizableStart = true
  const header = document.createElement('div')
  header.setAttribute('data-slot', 'header')
  const globalNav = document.createElement('div')
  globalNav.setAttribute('data-slot', 'global-nav')
  const navPane = document.createElement('div')
  navPane.setAttribute('data-slot', 'nav-pane')
  const content = document.createElement('div')
  content.setAttribute('data-slot', 'content')
  const footer = document.createElement('div')
  footer.setAttribute('data-slot', 'footer')
  el.append(header, globalNav, navPane, content, footer)
  document.body.append(el)
  mounted.push(el)
  return el
}

describe('ui-super-shell cross-engine smoke — bar radius (GH #253)', () => {
  it('the header and footer bars (edge-to-edge, GH #210) render with NO border-radius', () => {
    const el = mountFullChrome()
    const header = el.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    const footer = el.querySelector('[data-part="bar"][data-bar="footer"]') as HTMLElement
    expect(header).not.toBeNull()
    expect(footer).not.toBeNull()
    const headerRadius = getComputedStyle(header).borderRadius
    const footerRadius = getComputedStyle(footer).borderRadius
    // computed border-radius with no declared radius resolves to "0px" in every engine
    expect(headerRadius).toBe('0px')
    expect(footerRadius).toBe('0px')
  })

  it('rail/pane/pane-resizer (floating cards) KEEP their radius — regression-proof against the bar fix', () => {
    const el = mountFullChrome()
    const rail = el.querySelector('[data-part="rail"]') as HTMLElement
    const pane = el.querySelector('[data-part="pane"]') as HTMLElement
    const resizer = el.querySelector('[data-part="pane-resizer"]') as HTMLElement
    expect(rail).not.toBeNull()
    expect(pane).not.toBeNull()
    expect(resizer).not.toBeNull()
    const railRadius = getComputedStyle(rail).borderRadius
    const paneRadius = getComputedStyle(pane).borderRadius
    const resizerRadius = getComputedStyle(resizer).borderRadius
    expect(railRadius).not.toBe('0px')
    expect(paneRadius).not.toBe('0px')
    expect(resizerRadius).not.toBe('0px')
  })
})
