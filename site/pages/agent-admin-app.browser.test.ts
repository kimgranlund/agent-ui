// agent-admin-app.browser.test.ts — GH #51: the canvas-header `[ title | … | agent-menu ]` on the REAL
// page. Side-effect-imports the page module (the a2ui-live-conversation.browser.test.ts precedent — its
// own file, its own document, so the full-viewport mount collides with nothing), then drives the real
// ui-menu switcher end to end: open → commit a different preset → the title, the persisted active id,
// and the admin store all follow. This is the page-wiring proof GH #42 notes the admin page lacked; the
// store-swap MECHANISM itself stays unit-proven in agent-admin-app.test.ts (jsdom).
import { describe, it, expect } from 'vitest'
import './agent-admin-app.ts' // side-effect import — mounts the real header + ui-agent-admin
import { AGENT_PRESETS, ACTIVE_PRESET_KEY } from './agent-admin-presets.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** The preset the page resolved at import time (localStorage may carry a prior run's choice — resolve by
 *  the SAME rule the page uses rather than assuming the first preset). */
function resolvedActive(): (typeof AGENT_PRESETS)[number] {
  return AGENT_PRESETS.find((p) => p.id === localStorage.getItem(ACTIVE_PRESET_KEY)) ?? AGENT_PRESETS[0]!
}

describe('agent-admin-app — the canvas-header (GH #51)', () => {
  it('renders [ title | … | agent-menu ]: the active agent names the surface; the chip strip is gone', async () => {
    await raf()
    const header = document.querySelector('header.canvas-header') as HTMLElement
    expect(header, 'the canvas-header must mount above the admin surface').not.toBeNull()
    expect(document.querySelector('.preset-strip'), 'the TKT-0074 chip strip must be fully replaced').toBeNull()

    const name = header.querySelector('.canvas-header-name') as HTMLElement
    expect(name.textContent).toBe(resolvedActive().label)

    // the three zones: title flexes, the two menus sit after it in order [ … | agent-menu ]
    const menus = header.querySelectorAll('ui-menu')
    expect(menus).toHaveLength(2)
    expect(menus[0]!.className).toContain('overflow-menu')
    expect(menus[1]!.className).toContain('agent-menu')
  })

  it('the agent menu lists EVERY preset un-truncated and a commit switches agent + persists it', async () => {
    await raf()
    const agentMenu = document.querySelector('.agent-menu') as HTMLElement
    const trigger = agentMenu.querySelector('[data-part="trigger"]') as HTMLElement
    trigger.click()
    await raf()

    const items = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitem"]')]
    expect(items, 'one menu row per preset — the un-truncated replacement for the chips').toHaveLength(AGENT_PRESETS.length)

    const before = resolvedActive()
    const target = AGENT_PRESETS.find((p) => p.id !== before.id)!
    const targetItem = items.find((i) => i.dataset.value === target.id)!
    targetItem.click()
    await raf()

    expect(localStorage.getItem(ACTIVE_PRESET_KEY), 'the committed agent persists').toBe(target.id)
    expect((document.querySelector('.canvas-header-name') as HTMLElement).textContent, 'the title zone follows the commit').toBe(target.label)
    expect((agentMenu.querySelector('[data-part="trigger"]') as HTMLElement).textContent).toContain(target.label)
    // the active row carries the light marker; the previous one dropped it
    expect(items.find((i) => i.dataset.value === target.id)!.getAttribute('aria-checked')).toBe('true')
    expect(items.find((i) => i.dataset.value === before.id)!.hasAttribute('aria-checked')).toBe(false)
  })

  it('the "…" overflow carries Reset persona (the page action relocated off the strip)', async () => {
    await raf()
    const overflow = document.querySelector('.overflow-menu') as HTMLElement
    const trigger = overflow.querySelector('[data-part="trigger"]') as HTMLElement
    trigger.click()
    await raf()
    const reset = overflow.querySelector('[data-value="reset-persona"]') as HTMLElement
    expect(reset, 'Reset persona lives in the overflow menu now').not.toBeNull()
    expect(reset.getAttribute('role')).toBe('menuitem')
    reset.click() // commit — must not throw; the admin store re-seeds (mechanism unit-proven elsewhere)
    await raf()
    expect(document.querySelector('.canvas-header-name')).not.toBeNull()
  })
})
