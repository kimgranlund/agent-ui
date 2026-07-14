import { describe, it, expect, afterEach } from 'vitest'

// The CROSS-ENGINE ui-agent-admin smoke (TKT-0039, ADR-0131). jsdom cannot resolve CSS flex/@scope
// layout — this file is where the three-pane side-by-side geometry becomes TRUE in BOTH Chromium and
// WebKit (the master-detail.browser.test.ts precedent). CSS wiring: the foundation first, then
// `component-styles.css` (the family barrel carries ui-split/ui-split-pane/ui-text-field/etc.'s shipped
// CSS), then every composed sibling's own CSS, then this element's own.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../surface-host/surface-host.css'
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import type { UITextareaElement } from '@agent-ui/components/controls/textarea'
import { ENTRY_KINDS } from './entries.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mountAgentAdmin(): { wrapper: HTMLElement; el: UIAgentAdminElement } {
  const wrapper = document.createElement('div')
  wrapper.style.width = '1200px'
  wrapper.style.height = '600px'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto' // the master-detail.md/conversation.md "consumer-supplied block-size" precedent
  wrapper.style.display = 'flex'
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  return { wrapper, el }
}

describe('ui-agent-admin cross-engine smoke — three panes render side by side (ADR-0131 cl.2)', () => {
  it('canvas, prompts, and settings each occupy a non-zero, non-overlapping box, left to right', () => {
    const { el } = mountAgentAdmin()
    const canvas = el.querySelector('[data-role="canvas"]') as HTMLElement
    const prompts = el.querySelector('[data-role="prompts"]') as HTMLElement
    const settings = el.querySelector('[data-role="settings"]') as HTMLElement
    const c = canvas.getBoundingClientRect()
    const p = prompts.getBoundingClientRect()
    const s = settings.getBoundingClientRect()
    for (const box of [c, p, s]) {
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }
    expect(c.right).toBeLessThanOrEqual(p.left + 1) // canvas is left of prompts (integer rounding slop)
    expect(p.right).toBeLessThanOrEqual(s.left + 1) // prompts is left of settings
  })

  it('a seeded prompt-section entry\'s content field is visibly focusable and legible (a real element, not display:none)', () => {
    const { el } = mountAgentAdmin()
    const field = el.querySelector('[data-entry-id="foundation"] [data-part="entry-content"]') as HTMLElement
    field.focus()
    // ui-textarea forwards .focus() to its internal contenteditable editor part (the text-field precedent) —
    // the ACTIVE element is that editor div, not the host; :focus-within proves focus landed inside the field.
    expect(field.matches(':focus-within')).toBe(true)
    const box = field.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })

  it('the toggle switch on a seeded entry is a real, visibly rendered ui-switch (whole-shape, not a collapsed stub)', () => {
    const { el } = mountAgentAdmin()
    const toggle = el.querySelector('[data-entry-id="foundation"] [data-part="entry-toggle"]') as HTMLElement
    expect(toggle.tagName.toLowerCase()).toBe('ui-switch')
    const box = toggle.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })

  it('all four capability sections (Skills/Workflows/Resources/Tools) render in the settings pane, each a real non-zero box', () => {
    const { el } = mountAgentAdmin()
    const settings = el.querySelector('[data-role="settings"]') as HTMLElement
    const sections = [...settings.querySelectorAll('[data-part="entry-section"]')]
    expect(sections.map((s) => s.getAttribute('data-kind'))).toEqual([
      ENTRY_KINDS.skill,
      ENTRY_KINDS.workflow,
      ENTRY_KINDS.resource,
      ENTRY_KINDS.tool,
    ])
    for (const section of sections) {
      const box = section.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }
  })
})

describe('ui-agent-admin cross-engine smoke — the add-form is GENUINELY collapsed when hidden (component-reviewer CRITICAL fix)', () => {
  it('a hidden add-form computes display:none; toggling reveals it as a real, visible box', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.tool}"]`) as HTMLElement
    const form = section.querySelector('[data-part="entry-add-form"]') as HTMLElement

    // Before the CSS fix, `display: flex` beat the UA [hidden] rule — this assertion is the one the
    // review found the shipped whole-shape suite was blind to.
    expect(getComputedStyle(form).display).toBe('none')
    expect(form.getBoundingClientRect().height).toBe(0)

    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    expect(getComputedStyle(form).display).not.toBe('none')
    expect(form.getBoundingClientRect().height).toBeGreaterThan(0)
  })
})

describe('ui-agent-admin cross-engine smoke — an uncommitted edit survives a sibling toggle (component-reviewer MAJOR fix)', () => {
  it('a mid-edit content field keeps its live value AND its focus after a sibling entry re-renders the list', async () => {
    const { el } = mountAgentAdmin()
    const foundationField = el.querySelector(
      '[data-entry-id="foundation"] [data-part="entry-content"]',
    ) as UITextareaElement
    foundationField.focus()
    foundationField.value = 'Half-typed, never committed'
    foundationField.dispatchEvent(new Event('input', { bubbles: true }))

    const personalityToggle = el.querySelector(
      '[data-entry-id="personality"] [data-part="entry-toggle"]',
    ) as HTMLElement & { checked: boolean }
    personalityToggle.checked = false
    personalityToggle.dispatchEvent(new Event('change', { bubbles: true }))

    const foundationAfter = el.querySelector(
      '[data-entry-id="foundation"] [data-part="entry-content"]',
    ) as UITextareaElement
    expect(foundationAfter.value).toBe('Half-typed, never committed')
    // component-reviewer MINOR fix: entry-list.ts's restore path awaits `updateComplete` before calling
    // `selectToEnd()` (the model→surface sync that populates the editor's textContent is async, and
    // collapsing a range onto a still-empty editor caret-lands at 0, not the end) — await the SAME flush
    // here before asserting focus, matching the real timing `selectToEnd()` now runs on.
    await foundationAfter.updateComplete
    // real browser focus semantics — the jsdom leg only asserts the value half; this leg is where the fix's
    // focus claim is actually provable. ui-textarea's selectToEnd() (entry-list.ts's ADR-0134 migration seam)
    // focuses the internal editor part, not the host — :focus-within proves focus survived onto the NEW row.
    expect(foundationAfter.matches(':focus-within')).toBe(true)
  })
})

describe('ui-agent-admin cross-engine smoke — adding a custom capability actually renders (ADR-0132)', () => {
  it('submitting the add-form for a Skill renders a new, real, toggleable entry row', () => {
    const { el } = mountAgentAdmin()
    const section = el.querySelector(`[data-kind="${ENTRY_KINDS.skill}"]`) as HTMLElement
    ;(section.querySelector('[data-part="entry-add-toggle"]') as HTMLElement).click()
    const labelField = section.querySelector('[data-part="entry-add-label"]') as HTMLInputElement
    labelField.value = 'Web search'
    labelField.dispatchEvent(new Event('input', { bubbles: true }))
    ;(section.querySelector('[data-part="entry-add-form"]') as HTMLFormElement).requestSubmit()

    const row = el.querySelector('[data-kind="skill"] [data-entry-id="web-search"]') as HTMLElement
    expect(row).not.toBeNull()
    const box = row.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    const toggle = row.querySelector('[data-part="entry-toggle"]') as HTMLElement & { checked: boolean }
    expect(toggle.checked).toBe(true)
  })
})

describe('ui-agent-admin cross-engine smoke — the live-apply loop actually renders in a real turn (ADR-0131)', () => {
  it('editing a setting, then submitting, paints a reply bubble that visibly cites the new value', () => {
    const { el } = mountAgentAdmin()
    const store = el.store!
    store.set('name', 'Cross-engine Scout')

    const field = el.querySelector('[data-role="canvas"] [data-part="field"]') as HTMLElement & { value: string }
    const form = el.querySelector('[data-role="canvas"] [data-part="composer"]') as HTMLFormElement
    field.value = 'ping'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    const agentBubbles = el.querySelectorAll('[data-role="agent"]')
    expect(agentBubbles.length).toBeGreaterThan(0)
    const body = agentBubbles[agentBubbles.length - 1].querySelector('[data-part="body"]') as HTMLElement
    expect(body.textContent).toContain('Cross-engine Scout')
    // whole-shape: the bubble itself is a real, visible box, not a zero-size DOM stub
    const box = agentBubbles[agentBubbles.length - 1].getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })
})
