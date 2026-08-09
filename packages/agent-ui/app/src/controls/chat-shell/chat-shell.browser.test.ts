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

/** GH #646 follow-up #3 — the SAME shell, minus the header: `ui-agent-admin`'s own real shape
 *  (`content` + `options-pane` only, no `header` slot authored) — the fixture `mountChatShellAt` above
 *  can never reach, since it always authors one. */
function mountChatShellNoHeaderAt(widthPx: number): { wrapper: HTMLElement; el: UIChatShellElement } {
  const wrapper = document.createElement('div')
  wrapper.style.width = `${widthPx}px`
  wrapper.style.height = '400px'
  wrapper.style.display = 'flex'
  const el = document.createElement('ui-chat-shell') as UIChatShellElement
  el.style.flex = '1 1 auto'
  el.setAttribute('narrow-end', 'tabs')
  const content = document.createElement('div')
  content.setAttribute('data-slot', 'content')
  content.textContent = 'Content'
  const optionsPane = document.createElement('div')
  optionsPane.setAttribute('data-slot', 'options-pane')
  optionsPane.textContent = 'Options'
  el.append(content, optionsPane)
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
    // GH #626 — the comparison MOVED, the claim did not. It used to read the header BAR's own
    // `padding-inline`; the bar is now a padding-less rail, so reading it would compare against 0px and
    // pass vacuously in the wrong direction. What "matches the header's inset" means today is the shared
    // role the header's CONTENT insets by — `--ui-bar-inline-inset` — resolved on the bar itself, so this
    // stays a RELATIVE comparison (a token repoint moves both sides, exactly as before) rather than a
    // pinned px. Deliberately NOT a rect comparison against the authored header child: this fixture's
    // header is a bare `<div>` supplying no inset of its own, so its rect sits at the bar edge and would
    // make the assertion measure the fixture instead of the contract.
    // Resolved through a PROBE, not `getPropertyValue`: an unregistered custom property computes to its
    // substituted token stream (`calc(24px * 1)`), which never string-equals a used `padding` value of
    // `24px`. A throwaway child consuming the role the same way the strip does gives the used px.
    const probe = document.createElement('div')
    probe.style.paddingInline = 'var(--ui-bar-inline-inset)'
    header.append(probe)
    const sharedInset = getComputedStyle(probe).paddingInlineStart
    probe.remove()
    expect(sharedInset, 'the shared bar-inset role resolves on the bar').not.toBe('0px')
    expect(stripStyle.paddingInlineStart, "the strip's inline-start inset reads the shared bar-inset role").toBe(sharedInset)
    expect(stripStyle.paddingInlineEnd, "the strip's inline-end inset reads the shared bar-inset role").toBe(sharedInset)
    // Non-zero — a coincidental 0px===0px equality would satisfy the assertions above vacuously.
    expect(parseFloat(stripStyle.paddingInlineStart)).toBeGreaterThan(0)
    // And the bar it tracks is genuinely the rail #626 made it: if a padding mechanism returns to the bar,
    // the strip is back to tracking a value nobody else reads, which is the #575 drift all over again.
    expect(headerStyle.paddingInlineStart, 'the header bar itself stays a padding-less rail').toBe('0px')
  })

  it('negative control — wide (≥40rem): the narrow-tabs strip stays display:none, exactly as before this fix (#542\'s tabs probes stay green — this pads the REGION, never the control)', async () => {
    const { el } = mountChatShellAt(900)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const strip = el.querySelector('[data-part="narrow-tabs"]') as HTMLElement
    expect(strip, 'the strip is still composed (a tabs side is authored)').not.toBeNull()
    expect(getComputedStyle(strip).display, 'the strip stays hidden at wide — this fix is narrow-only').toBe('none')
  })

  // GH #646 follow-up #3 (Kim, live-surface pass, 2026-08-09) — "tracks the header's inset" presumes a
  // header exists. `ui-agent-admin`, the strip's one live consumer, composes NO header — a shape this
  // suite never actually measured before (the fixture above always authors one). Split the rule on
  // header presence: headerless falls back to the shell's own generic module-scaled rhythm instead of
  // the (nonexistent) header's fleet-bar-content role.
  it('narrow, HEADERLESS (the real ui-agent-admin shape): the strip falls back to the shell\'s own module-scaled rhythm, NOT the fleet header-bar role', async () => {
    const { el } = mountChatShellNoHeaderAt(500)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const strip = el.querySelector('[data-part="narrow-tabs"]') as HTMLElement
    expect(el.querySelector('[data-part="bar"][data-bar="header"]'), 'this fixture authors no header — the fact under test').toBeNull()
    expect(getComputedStyle(strip).display, 'the strip is visible at the narrow width').not.toBe('none')

    // Resolved through a probe (the same idiom as the header-bearing test above): an unregistered custom
    // property computes to its substituted token stream, which never string-equals a used padding value.
    const modProbe = document.createElement('div')
    modProbe.style.paddingInline = 'calc(var(--ui-super-shell-module) * 2 / 3)'
    strip.append(modProbe)
    const moduleInset = getComputedStyle(modProbe).paddingInlineStart
    modProbe.remove()
    const barProbe = document.createElement('div')
    barProbe.style.paddingInline = 'var(--ui-bar-inline-inset)'
    strip.append(barProbe)
    const barInset = getComputedStyle(barProbe).paddingInlineStart
    barProbe.remove()

    expect(moduleInset, 'the module-scaled role resolves').not.toBe('0px')
    // Anti-vacuous: the two roles must genuinely differ under the default token values, or this test
    // could pass even if the fallback silently regressed to the header role.
    expect(moduleInset, 'the module role and the fleet bar-content role are NOT the same value by default').not.toBe(barInset)
    expect(getComputedStyle(strip).paddingInlineStart, "the strip's inline-start inset reads the module-scaled role").toBe(moduleInset)
    expect(getComputedStyle(strip).paddingInlineEnd, "the strip's inline-end inset reads the module-scaled role").toBe(moduleInset)
  })
})
