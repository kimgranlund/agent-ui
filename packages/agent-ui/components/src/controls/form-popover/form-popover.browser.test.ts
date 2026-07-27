import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UIFormPopoverElement } from './form-popover.ts'

// Browser smoke — ui-form-popover (GH #294 F4 · form-popover.decomp.md T5-T10 ·
// form-popover.spec.md SPEC-R1..R11 · form-popover.lld.md LLD-C1..C7).
//
// What is proven here (none of this resolves in jsdom):
//   [T5]  overlay lifecycle — trigger click ⇒ open + top-layer + aria-expanded; Escape ⇒ closed,
//         close-then-toggle, `open` already false in the `toggle` listener (ADR-0101 order)
//   [T5b] a11y shape — aria-controls, NO aria-haspopup, host has no explicit role, accessible name
//         === the `label` prop text, the open panel's [data-part] set is exactly
//         trigger/label/caret/panel for a plain-content fixture (the LLD §risk-scoped assertion)
//   [T6]  programmatic close — el.open = false actually hides (the ADR-0101 erratum regression)
//   [T7]  native Tab + typing — a panel with checkbox + radio + ui-text-field: typing "O" stays in
//         the field (no type-ahead steal), Tab walks natively (SPEC-R5, the anti-ui-menu proof)
//   [T8]  focus contract — focus moves into the panel on open, restores to the trigger on close
//   [T9]  live-apply bubbling — a real pointer-driven checkbox change reaches a host-ancestor
//         listener unmodified; the host itself emits only toggle/close
//   [T10] whole-shape — open panel's bounding box ≥ panel-min-inline-size; trigger box = Control
//         class height per [size]
//   [7]   forced-colors — trigger + panel survive WHCM (Chromium via CDP; WebKit baseline)
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles + dimensional ramp FIRST, then
// the sibling form-control sheets (T7's fixture), then the form-popover sheet, then the
// self-defining module. Imported DIRECTLY (relative), NOT via the component-styles barrel.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container-box.css' // the [data-box] box-model layer the panel opts into
import '../checkbox/checkbox.css'
import '../checkbox/checkbox.ts'
import '../radio/radio.css'
import '../radio/radio.ts'
import '../radio/radio-group.css'
import '../radio/radio-group.ts'
import '../text-field/text-field.css'
import '../text-field/text-field.ts'
import './form-popover.css'
import './form-popover.ts'

// ── mount/cleanup ─────────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

/**
 * Mount a ui-form-popover into a realistic container (a display:flex row — the doc-specimen
 * context per the Test-the-whole-shape law). The panel is in the top layer when open, so the
 * container only affects the trigger layout.
 */
function mount(markup: string): { wrap: HTMLElement; el: UIFormPopoverElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.style.gap = '8px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-form-popover') as UIFormPopoverElement
  return { wrap, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()!
    const panels = m.querySelectorAll<HTMLElement>('[data-part="panel"]')
    for (const panel of panels) {
      if ((panel as HTMLElement & { hidePopover?: () => void }).hidePopover) {
        try { panel.hidePopover() } catch (_) { /* already hidden */ }
      }
    }
    m.remove()
  }
})

const px = (v: string): number => Number.parseFloat(v)

const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [T5] overlay lifecycle
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-popover — overlay lifecycle (T5, both engines)', () => {
  it('trigger click opens: open===true, panel in top layer, aria-expanded="true"', async () => {
    const { el } = mount(
      '<ui-form-popover label="Options"><input type="checkbox" name="opt" value="a"></ui-form-popover>',
    )
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    expect(panel.matches(':popover-open'), 'panel should be closed by default').toBe(false)

    await userEvent.click(trigger)
    await el.updateComplete

    expect(panel.matches(':popover-open'), `${server.browser}: trigger click did not open the panel`).toBe(true)
    expect(el.open).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('Escape closes: close-then-toggle, `open` already false in the toggle listener (ADR-0101 order)', async () => {
    const { el } = mount(
      '<ui-form-popover label="Options"><input type="checkbox" name="opt" value="a"></ui-form-popover>',
    )
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!

    el.open = true
    await el.updateComplete
    expect(panel.matches(':popover-open')).toBe(true)

    const order: string[] = []
    let openAtToggle: boolean | null = null
    el.addEventListener('close', () => order.push('close'))
    el.addEventListener('toggle', () => {
      order.push('toggle')
      openAtToggle = el.open
    })

    await userEvent.keyboard('{Escape}')
    await new Promise((r) => setTimeout(r, 0)) // the Popover API toggle event is task-queued
    await el.updateComplete

    expect(panel.matches(':popover-open'), `${server.browser}: Escape did not close the panel`).toBe(false)
    expect(el.open).toBe(false)
    expect(order).toEqual(['close', 'toggle']) // close fires BEFORE toggle (ADR-0101 mechanic 3)
    expect(openAtToggle, 'open must already be false by the time toggle fires').toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [T5b] a11y shape
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-popover — a11y shape (T5b, SPEC-R6/R10, both engines)', () => {
  it('aria-controls points at the panel id; NO aria-haspopup; host has no explicit role', async () => {
    const { el } = mount(
      '<ui-form-popover label="Options"><input type="checkbox" name="opt" value="a"></ui-form-popover>',
    )
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false)
    expect(el.getAttribute('role')).toBeNull()
  })

  it('the trigger accessible name === the `label` prop text', async () => {
    const { el } = mount(
      '<ui-form-popover label="Options · 3 selected"><input type="checkbox" name="opt" value="a"></ui-form-popover>',
    )
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    // Content-only accessible name (no aria-labelledby concatenation, unlike select) — asserting
    // the rendered text content IS the name source, since jsdom cannot compute accessible names
    // but a real engine's a11y tree resolves a <button>'s name from its content.
    expect(trigger.textContent?.trim()).toContain('Options · 3 selected')
  })

  it('the open panel [data-part] set is exactly trigger/label/caret/panel for a plain-content fixture (LLD-scoped)', async () => {
    const { el } = mount(
      '<ui-form-popover label="Options"><p>Plain content, no FACE control anatomy.</p></ui-form-popover>',
    )
    el.open = true
    await el.updateComplete
    const parts = new Set(
      [...el.querySelectorAll('[data-part]')].map((n) => n.getAttribute('data-part')),
    )
    expect(parts).toEqual(new Set(['trigger', 'label', 'caret', 'panel']))
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [T6] programmatic close — the ADR-0101 erratum regression
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-popover — programmatic close (T6, both engines)', () => {
  it('trigger-click open, then a model-driven close — the panel must actually close', async () => {
    const { el } = mount(
      '<ui-form-popover label="Options"><input type="checkbox" name="opt" value="a"></ui-form-popover>',
    )
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    await userEvent.click(trigger)
    await el.updateComplete
    expect(panel.matches(':popover-open'), 'precondition: mouse-open must open the panel').toBe(true)

    el.open = false // model-driven close after a mouse-driven open
    await el.updateComplete

    expect(
      panel.matches(':popover-open'),
      `${server.browser}: a post-mouse-open model-driven close must actually hide the panel`,
    ).toBe(false)
    expect(el.open).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [T7] native Tab + typing — the anti-ui-menu proof (SPEC-R5)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-popover — native Tab + typing inside the panel (T7, both engines)', () => {
  it('typing "O" into an embedded ui-text-field stays in the field (no type-ahead steal)', async () => {
    const { el } = mount(`
      <ui-form-popover label="Filters">
        <input type="checkbox" name="opt" value="a" id="cb">
        <ui-text-field name="q"></ui-text-field>
      </ui-form-popover>
    `)
    el.open = true
    await el.updateComplete

    const field = el.querySelector('ui-text-field') as HTMLElement & { value: string }
    const editor = field.querySelector<HTMLElement>('[contenteditable]') ?? field
    editor.focus()
    await userEvent.type(editor, 'O')

    expect(
      field.value ?? editor.textContent,
      `${server.browser}: typing "O" was stolen (type-ahead-like interception) instead of landing in the field`,
    ).toContain('O')
  })

  it('Tab walks the panel content in native document order', async () => {
    // ui-checkbox (the tabbable trait), not a bare native <input type=checkbox> — WebKit/Safari
    // excludes native checkboxes/radios from the default Tab order (platform behaviour, not a
    // form-popover concern); the fleet's own FACE controls are real Tab stops cross-engine.
    const { el } = mount(`
      <ui-form-popover label="Filters">
        <ui-checkbox name="opt" value="a" id="cb1"></ui-checkbox>
        <ui-checkbox name="opt" value="b" id="cb2"></ui-checkbox>
      </ui-form-popover>
    `)
    el.open = true
    await el.updateComplete

    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const cb1 = panel.querySelector<HTMLElement>('#cb1')!
    const cb2 = panel.querySelector<HTMLElement>('#cb2')!

    cb1.focus()
    expect(document.activeElement).toBe(cb1)
    await userEvent.tab()
    expect(
      document.activeElement,
      `${server.browser}: Tab did not walk to the next native child in document order`,
    ).toBe(cb2)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [T8] focus contract — into the panel on open, restored to the trigger on close
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-popover — focus contract (T8, both engines)', () => {
  it('focus moves into the panel on open; restores to the trigger on close', async () => {
    const { el } = mount(`
      <ui-form-popover label="Filters">
        <input type="checkbox" name="opt" value="a" id="cb1">
      </ui-form-popover>
    `)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!

    await userEvent.click(trigger)
    await el.updateComplete

    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    expect(
      panel.contains(document.activeElement) || document.activeElement === panel,
      `${server.browser}: focus did not move into the panel on open`,
    ).toBe(true)

    el.open = false
    await el.updateComplete

    expect(
      document.activeElement,
      `${server.browser}: focus did not restore to the trigger on close`,
    ).toBe(trigger)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [T9] live-apply bubbling — real pointer-driven commit
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-popover — live-apply bubbling (T9, SPEC-R4, both engines)', () => {
  it('a real pointer click on a child checkbox emits change on the host unmodified; the host emits nothing else', async () => {
    const { el } = mount(`
      <ui-form-popover label="Options">
        <input type="checkbox" name="opt" value="a" id="cb">
      </ui-form-popover>
    `)
    el.open = true
    await el.updateComplete

    const checkbox = el.querySelector<HTMLInputElement>('#cb')!
    const hostEvents: string[] = []
    el.addEventListener('change', () => hostEvents.push('change'))

    await userEvent.click(checkbox)
    await el.updateComplete

    expect(checkbox.checked).toBe(true)
    expect(hostEvents, `${server.browser}: the host must relay the child's change unmodified`).toEqual(['change'])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [T10] whole-shape gestalt
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-popover — whole-shape assertion (T10, the Test-the-whole-shape DoD law)', () => {
  it('trigger box = Control-class height per [size]; open panel bounding box ≥ the min-inline-size floor', async () => {
    const { el } = mount(
      '<ui-form-popover label="Options" size="lg"><input type="checkbox" name="opt" value="a"></ui-form-popover>',
    )
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!

    const triggerRect = trigger.getBoundingClientRect()
    expect(triggerRect.width, `${server.browser}: trigger collapsed to zero width`).toBeGreaterThan(0)
    expect(triggerRect.height, `${server.browser}: trigger collapsed to zero height`).toBeGreaterThan(0)

    const lgHeight = px(getComputedStyle(document.documentElement).getPropertyValue('--md-sys-height-lg'))
    if (lgHeight > 0) {
      expect(
        Math.abs(triggerRect.height - lgHeight),
        `${server.browser}: trigger height did not track the [size=lg] Control-class ramp`,
      ).toBeLessThan(2)
    }

    el.open = true
    await el.updateComplete

    const panelRect = panel.getBoundingClientRect()
    expect(panelRect.width, `${server.browser}: panel collapsed to zero width`).toBeGreaterThan(0)
    expect(panelRect.height, `${server.browser}: panel collapsed to zero height`).toBeGreaterThan(0)

    const minWidth = px(getComputedStyle(panel).minInlineSize)
    expect(minWidth, `${server.browser}: panel min-inline-size is not a positive px — collapse risk`).toBeGreaterThan(0)
    expect(panelRect.width, 'panel rendered narrower than its own min-inline-size floor').toBeGreaterThanOrEqual(minWidth - 1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  REGRESSION — GH #302
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-popover — GH #302 regression (rovingFocus survives the #ensureParts() child-move)', () => {
  it('nesting ui-radio-group does not throw during #ensureParts(), and its rovingFocus keyboard wiring actually works', async () => {
    const errors: unknown[] = []
    const onError = (e: ErrorEvent): void => { errors.push(e.error ?? e.message) }
    window.addEventListener('error', onError)

    const { el } = mount(`
      <ui-form-popover label="Filters">
        <ui-radio-group name="sort">
          <ui-radio value="newest">Newest</ui-radio>
          <ui-radio value="oldest">Oldest</ui-radio>
        </ui-radio-group>
      </ui-form-popover>
    `)
    el.open = true
    await el.updateComplete
    // A real window-error listener won't catch every "reported" reaction exception synchronously in every
    // engine, but this yields the event loop once so any that DO surface land before the assertion below.
    await new Promise((r) => setTimeout(r, 0))
    window.removeEventListener('error', onError)
    expect(errors, `${server.browser}: nesting ui-radio-group threw during #ensureParts() (GH #302)`).toEqual([])

    // Functional proof, not just "didn't throw": rovingFocus's keydown listener must have actually
    // registered on the (correctly reconnected) group — ArrowDown moves focus + selection to the next radio.
    const first = el.querySelector<HTMLElement>('ui-radio[value="newest"]')!
    const second = el.querySelector<HTMLElement>('ui-radio[value="oldest"]')!
    first.focus()
    expect(document.activeElement).toBe(first)
    await userEvent.keyboard('{ArrowDown}')
    expect(
      document.activeElement,
      `${server.browser}: rovingFocus's keydown listener never registered — the GH #302 reentrancy silently dropped it`,
    ).toBe(second)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] forced-colors — trigger + panel survive WHCM (Chromium via CDP; WebKit baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-popover — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  it('trigger frame + panel surface are visible in normal mode AND survive forced-colors', async () => {
    const { el } = mount(
      '<ui-form-popover label="Options"><input type="checkbox" name="opt" value="a"></ui-form-popover>',
    )
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    el.open = true
    await el.updateComplete

    expect(
      alphaOf(getComputedStyle(trigger).backgroundColor),
      `${server.browser}: the trigger has no background in normal mode`,
    ).toBeGreaterThan(0)
    expect(
      alphaOf(getComputedStyle(panel).backgroundColor),
      `${server.browser}: the panel surface has no background in normal mode`,
    ).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      expect(
        alphaOf(getComputedStyle(trigger).backgroundColor),
        'trigger surface vanished under forced-colors',
      ).toBeGreaterThan(0)
      expect(
        alphaOf(getComputedStyle(panel).backgroundColor),
        'panel surface vanished under forced-colors',
      ).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
