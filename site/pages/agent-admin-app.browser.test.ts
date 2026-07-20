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

  it('GH #55: the agent rows are seeded with the correct initial aria-checked BEFORE any commit (the migration off the ✓-text/data-active fallback)', async () => {
    await raf()
    const items = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')]
    expect(items).toHaveLength(AGENT_PRESETS.length)
    const active = resolvedActive()
    for (const item of items) {
      const wantChecked = item.dataset.value === active.id
      expect(item.getAttribute('aria-checked'), `row ${item.dataset.value} aria-checked`).toBe(String(wantChecked))
    }
    // Exactly one row is checked — one-true holds even at page-load seed time, not only post-commit.
    expect(items.filter((i) => i.getAttribute('aria-checked') === 'true')).toHaveLength(1)
  })

  it('the agent menu lists EVERY preset un-truncated and a commit switches agent + persists it', async () => {
    await raf()
    const agentMenu = document.querySelector('.agent-menu') as HTMLElement
    const trigger = agentMenu.querySelector('[data-part="trigger"]') as HTMLElement
    trigger.click()
    await raf()

    // GH #55: rows are role=menuitemradio (the selectable-item variant), not plain menuitem.
    const items = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')]
    expect(items, 'one menu row per preset — the un-truncated replacement for the chips').toHaveLength(AGENT_PRESETS.length)

    const before = resolvedActive()
    const target = AGENT_PRESETS.find((p) => p.id !== before.id)!
    const targetItem = items.find((i) => i.dataset.value === target.id)!
    targetItem.click()
    await raf()

    expect(localStorage.getItem(ACTIVE_PRESET_KEY), 'the committed agent persists').toBe(target.id)
    expect((document.querySelector('.canvas-header-name') as HTMLElement).textContent, 'the title zone follows the commit').toBe(target.label)
    expect((agentMenu.querySelector('[data-part="trigger"]') as HTMLElement).textContent).toContain(target.label)
    // GH #55: the ✓-text/data-active fallback is gone — the rows are role=menuitemradio and the
    // active marker is REAL aria-checked, managed by ui-menu itself on commit (one-true).
    const activeRow = items.find((i) => i.dataset.value === target.id)!
    const previousRow = items.find((i) => i.dataset.value === before.id)!
    expect(activeRow.getAttribute('role')).toBe('menuitemradio')
    expect(activeRow.getAttribute('aria-checked'), 'the committed row is checked').toBe('true')
    expect(activeRow.textContent, 'no more hand-rolled ✓ prefix — the label stays plain text').toBe(target.label)
    expect(previousRow.getAttribute('aria-checked'), 'the previous choice is unchecked').toBe('false')
    expect(previousRow.textContent).toBe(before.label)
  })

  it('a long tagline truncates INSIDE the header — the menu triggers stay in reach (the flexbox min-width:auto trap, PR #54 review finding)', async () => {
    await raf()
    const header = document.querySelector('header.canvas-header') as HTMLElement
    const agentTrigger = document.querySelector('.agent-menu [data-part="trigger"]') as HTMLElement
    const tagline = document.querySelector('.canvas-header-tagline') as HTMLElement
    // The header is full-viewport-width; at the fleet's 414px default every preset tagline (70-90ch)
    // exceeds the free space, so truncation MUST be doing the yielding for the triggers to fit.
    const headerBox = header.getBoundingClientRect()
    const triggerBox = agentTrigger.getBoundingClientRect()
    expect(triggerBox.right, 'the agent-menu trigger must not be pushed past the header edge').toBeLessThanOrEqual(headerBox.right + 1)
    expect(triggerBox.width, 'the trigger must remain a real, clickable target').toBeGreaterThan(20)
    expect(tagline.scrollWidth, 'the tagline is genuinely truncated (content wider than its box)').toBeGreaterThan(tagline.clientWidth)
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

  // GH #145 — the live bug report's exact repro, on the REAL page: talk to the active persona, switch via
  // the real header dropdown, and the previous persona's visible thread + Dialog Turns must be gone (the
  // reset mechanism itself is unit-proven in agent-admin.test.ts; this is the page-wiring proof that a real
  // ui-menu commit → applyPreset → admin.store swap actually reaches it end to end).
  it('GH #145: switching persona via the real header dropdown clears the previous persona\'s visible thread + Dialog Turns', async () => {
    await raf()
    const admin = document.querySelector('ui-agent-admin') as HTMLElement
    // Layout-agnostic: the fleet's default 414×896 test viewport sits BELOW agent-admin.ts's own
    // NARROW_MAX_PX (640) responsive threshold, so the composer lives under the narrow all-tabs shell
    // here, not `[data-role="canvas"]` (the wide-split home) — TKT-0085 MOVES the same node between
    // shells rather than cloning it, so a plain descendant query finds the one live instance either way.
    const composer = admin.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    composer.value = 'a question for the current persona'
    ;(composer.querySelector('[data-part="send"]') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }))
    await raf()
    expect(admin.querySelectorAll('[data-role="user"]').length, 'the message posted to the current persona').toBe(1)

    const agentMenu = document.querySelector('.agent-menu') as HTMLElement
    const trigger = agentMenu.querySelector('[data-part="trigger"]') as HTMLElement
    trigger.click()
    await raf()
    const items = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')]
    const before = resolvedActive()
    const target = AGENT_PRESETS.find((p) => p.id !== before.id)!
    items.find((i) => i.dataset.value === target.id)!.click()
    await raf()

    expect(admin.querySelectorAll('[data-role="user"]').length, 'the OLD persona\'s user bubble must be gone after the switch').toBe(0)
    expect(admin.querySelectorAll('[data-part="context-turn"]').length, 'the OLD persona\'s Dialog Turns must be gone after the switch').toBe(0)
  })
})
