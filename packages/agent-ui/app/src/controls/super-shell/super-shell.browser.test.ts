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
