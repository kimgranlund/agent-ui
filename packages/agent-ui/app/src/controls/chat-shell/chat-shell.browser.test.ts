// chat-shell.browser.test.ts — GH #575 cross-engine browser truth for the narrow-tabs strip's inline
// inset. jsdom cannot resolve the real `@scope`/container-query layout that composes/reveals the
// SPEC-R7b narrow-tabs strip (super-shell.ts, relocated inside chat-shell.ts's ONE inner ui-super-shell)
// — chat-shell.test.ts covers the jsdom-provable composition/descriptor facts, this file is the
// measurement half. CSS wiring mirrors agent-admin.browser.test.ts's own precedent: foundation, then
// component-styles, then every composed sibling's own sheet, then this element's.
import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '../super-shell/super-shell.css'
import './chat-shell.css'
import '../super-shell/super-shell.ts'
import './chat-shell.ts'
import type { UIChatShellElement } from './chat-shell.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A `ui-chat-shell` authoring header + content + a `tabs`-mode end side (SPEC-R7b's one shipped
 *  narrow-tabs trigger) at an arbitrary width — a real, browser-measured container-query crossing
 *  (the agent-admin.browser.test.ts `mountAgentAdminAt` precedent), not a simulated one. */
function mountChatShellAt(widthPx: number): { wrapper: HTMLElement; el: UIChatShellElement } {
  const wrapper = document.createElement('div')
  wrapper.style.width = `${widthPx}px`
  wrapper.style.height = '400px'
  wrapper.style.display = 'flex'
  const el = document.createElement('ui-chat-shell') as UIChatShellElement
  el.style.flex = '1 1 auto'
  el.setAttribute('narrow-end', 'tabs') // SPEC-R7b — an end side in `tabs` mode joins the shell-owned narrow-tabs strip
  const header = document.createElement('div')
  header.setAttribute('data-slot', 'header')
  header.textContent = 'Header'
  const content = document.createElement('div')
  content.setAttribute('data-slot', 'content')
  content.textContent = 'Content'
  const optionsPane = document.createElement('div')
  optionsPane.setAttribute('data-slot', 'options-pane')
  optionsPane.textContent = 'Options'
  el.append(header, content, optionsPane)
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { wrapper, el }
}

describe('GH #575 — ui-chat-shell narrow-tabs strip inline inset', () => {
  it('narrow (<40rem): the narrow-tabs strip\'s inline padding matches the header bar\'s own inline inset — RELATIVE comparison, not a pinned px (a module re-scale must not redden this)', async () => {
    const { el } = mountChatShellAt(500)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const header = el.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
    const strip = el.querySelector('[data-part="narrow-tabs"]') as HTMLElement
    expect(header, 'the composed header bar exists').not.toBeNull()
    expect(strip, 'the composed narrow-tabs strip exists').not.toBeNull()
    expect(getComputedStyle(strip).display, 'the strip is visible at the narrow width').not.toBe('none')

    const headerStyle = getComputedStyle(header)
    const stripStyle = getComputedStyle(strip)
    expect(stripStyle.paddingInlineStart, "the strip's inline-start inset matches the header's").toBe(headerStyle.paddingInlineStart)
    expect(stripStyle.paddingInlineEnd, "the strip's inline-end inset matches the header's").toBe(headerStyle.paddingInlineEnd)
    // Both non-zero — a coincidental 0px===0px equality (e.g. neither region padding at all) would satisfy
    // the assertions above vacuously without proving the fix landed.
    expect(parseFloat(stripStyle.paddingInlineStart)).toBeGreaterThan(0)
  })

  it('negative control — wide (≥40rem): the narrow-tabs strip stays display:none, exactly as before this fix (#542\'s tabs probes stay green — this pads the REGION, never the control)', async () => {
    const { el } = mountChatShellAt(900)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const strip = el.querySelector('[data-part="narrow-tabs"]') as HTMLElement
    expect(strip, 'the strip is still composed (a tabs side is authored)').not.toBeNull()
    expect(getComputedStyle(strip).display, 'the strip stays hidden at wide — this fix is narrow-only').toBe('none')
  })
})
