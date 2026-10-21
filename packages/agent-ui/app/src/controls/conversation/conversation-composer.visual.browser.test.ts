import { describe, it, expect } from 'vitest'
import { page, server, userEvent } from 'vitest/browser'

// ADR-0223 slice 1 (Fill by Default -- the entry family) -- the DELIBERATELY minted visual goldens for
// the composer's posture flip (the ADR-0110 harness; the text-field slice-0 pilot precedent): a bare
// composer FILLS its block container; an `[inline]` composer HUGS at the relocated ~20ch floor.
// Chromium-only. Re-baseline only via `npm run test:visual:update`.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import './conversation-composer.css'
import './conversation-composer.ts'
import '@agent-ui/icons/phosphor'
import '@agent-ui/components/controls/icon'
import '@agent-ui/components/controls/button'

const mount = (attrs = ''): { wrap: HTMLElement; host: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '480px' // a fixed block container so the fill posture is a stable pixel truth
  wrap.style.padding = '8px'
  wrap.innerHTML = `<ui-conversation-composer ${attrs}></ui-conversation-composer>`
  document.body.append(wrap)
  return { wrap, host: wrap.querySelector('ui-conversation-composer') as HTMLElement }
}

describe('ui-conversation-composer -- visual regression (ADR-0223 slice-1 postures: fill default / [inline] hug)', () => {
  it.skipIf(server.browser !== 'chromium')('FILL (default): a bare composer stretches to its block container', async () => {
    const { wrap, host } = mount()
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('conversation-composer-fill-default')
    wrap.remove()
  })

  it.skipIf(server.browser !== 'chromium')('[inline] hug: the composer hugs at the ~20ch typing-width floor', async () => {
    const { wrap, host } = mount('inline')
    await (host as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('conversation-composer-inline-hug')
    wrap.remove()
  })
})

// T-0392: the open Effort menu reads as one aligned menu: the levels are menuitemradio rows sharing the
// toggles' check slot, the library check mark (ui-glyph, ADR-0245 cl.5) on the selected level and on a set
// toggle, a separator between the two groups, and the last row's focus ring inside the panel.
describe('ui-conversation-composer -- the open Effort menu (T-0392)', () => {
  it.skipIf(server.browser !== 'chromium')('aligned rows, check marks, a separator, the last ring inside the panel', async () => {
    const { wrap, host } = mount()
    const composer = host as HTMLElement & {
      updateComplete: Promise<unknown>
      efforts: readonly { id: string; label: string; checked?: boolean }[]
      effort: string
    }
    composer.efforts = [
      { id: 'low', label: 'Low' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' },
      { id: 'xhigh', label: 'X-High' },
      { id: 'thinking-off', label: 'Thinking off', checked: false },
      { id: 'show-reasoning', label: 'Show reasoning', checked: true },
    ]
    composer.effort = 'medium'
    await composer.updateComplete
    const menu = host.querySelector('[data-part="effort-menu"]') as HTMLElement & { open: boolean; updateComplete: Promise<unknown> }
    menu.open = true
    await menu.updateComplete
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const panel = menu.querySelector('[data-part="panel"]') as HTMLElement
    const rows = [...panel.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="menuitemcheckbox"]')]
    expect(rows.map((r) => r.dataset.value)).toEqual(['low', 'medium', 'high', 'xhigh', 'thinking-off', 'show-reasoning'])

    // one label edge: every row reserves the same check slot
    const textEdges = rows.map((r) => r.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(r).paddingInlineStart))
    for (const edge of textEdges) expect(edge).toBeCloseTo(textEdges[0]!, 1)

    // the check mark shows on the selected level and on the set toggle only
    const shown = rows.map((r) => getComputedStyle(r.querySelector('ui-glyph[data-part="check"]')!).visibility === 'visible')
    expect(shown).toEqual([false, true, false, false, false, true])
    expect(rows.some((r) => r.hasAttribute('data-selected'))).toBe(false)

    // a separator between the levels and the toggles
    const rule = rows[3]!.nextElementSibling as HTMLElement
    expect(rule.getAttribute('role')).toBe('separator')
    expect(rule.nextElementSibling).toBe(rows[4])
    expect(rule.getBoundingClientRect().height).toBeGreaterThan(0)

    // the last row's keyboard focus ring stays inside the panel's bottom edge
    await userEvent.keyboard('{End}')
    const last = rows[5]!
    expect(document.activeElement).toBe(last)
    expect(last.matches(':focus-visible')).toBe(true)
    const ring = getComputedStyle(last)
    const reach = Number.parseFloat(ring.outlineWidth) + Number.parseFloat(ring.outlineOffset)
    const panelBox = panel.getBoundingClientRect()
    const inner = panelBox.bottom - Number.parseFloat(getComputedStyle(panel).borderBottomWidth)
    expect(last.getBoundingClientRect().bottom + reach).toBeLessThanOrEqual(inner + 0.01)
    expect(panel.scrollHeight).toBeLessThanOrEqual(panel.clientHeight)

    await expect.element(page.elementLocator(panel)).toMatchScreenshot('conversation-composer-effort-menu-open')
    menu.open = false
    wrap.remove()
  })
})
