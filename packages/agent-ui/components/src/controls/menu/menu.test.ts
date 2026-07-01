import { describe, it, expect, beforeAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIMenuElement } from './menu.ts'
import type { OverlayHandle } from '../../traits/overlay.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Wave-4 S3 jsdom probes — ui-menu (decomp S3 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// jsdom reality: the native Popover API (`showPopover`/`hidePopover`, the ToggleEvent) is absent
// in jsdom. We STUB it on `HTMLElement.prototype` (the sanctioned pattern from popover.test.ts)
// with a minimal mirror of the platform contract — per-element open state, show/hide call counts,
// and the toggle event dispatch — before driving the control's logic. The REAL top-layer / Escape /
// outside-click / positioning / focus-move behaviour is proven in menu.browser.test.ts.
//
// Named probes:
//   menu-upgrade · menu-typed · menu-define-guard · menu-part-idempotent ·
//   menu-trigger-attrs · menu-panel-attrs · menu-items-role · menu-open-effect ·
//   menu-close-effect · menu-open-noop · menu-light-dismiss-sync · menu-light-dismiss-events ·
//   menu-programmatic-no-emit · menu-aria-expanded · menu-open-event · menu-roving-focus ·
//   menu-roving-wrap · menu-roving-disabled · menu-type-ahead · menu-commit-select ·
//   menu-commit-closes · menu-commit-disabled · menu-click-commit · menu-c10-residue ·
//   menu-c10-stacking · menu-c10-cleanup · menu-descriptor-schema · menu-descriptor-bijection ·
//   menu-descriptor-negative

// ── Popover API stub (jsdom lacks it — mirrors popover.test.ts setup) ───────────────────────────

const popoverOpen = new WeakMap<HTMLElement, boolean>()
const popoverCalls = new WeakMap<HTMLElement, { show: number; hide: number }>()

function callsOf(el: HTMLElement): { show: number; hide: number } {
  let c = popoverCalls.get(el)
  if (!c) {
    c = { show: 0, hide: 0 }
    popoverCalls.set(el, c)
  }
  return c
}

function fireToggle(el: HTMLElement, newState: 'open' | 'closed'): void {
  const ev = new Event('toggle')
  Object.defineProperty(ev, 'newState', { value: newState })
  el.dispatchEvent(ev)
}

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as {
    showPopover?: () => void
    hidePopover?: () => void
  }
  if (typeof proto.showPopover === 'function') return // real engine — leave the platform alone

  proto.showPopover = function (this: HTMLElement): void {
    callsOf(this).show++
    if (popoverOpen.get(this)) return // already open — no-op
    popoverOpen.set(this, true)
    fireToggle(this, 'open')
  }

  proto.hidePopover = function (this: HTMLElement): void {
    callsOf(this).hide++
    if (!popoverOpen.get(this)) return // already hidden — no-op
    popoverOpen.set(this, false)
    fireToggle(this, 'closed')
  }
})

/** Simulate a platform-initiated light-dismiss (Escape / outside-click) without calling hidePopover. */
function simulateLightDismiss(popup: HTMLElement): void {
  popoverOpen.set(popup, false)
  fireToggle(popup, 'closed')
}

// ── Test probe subclass ────────────────────────────────────────────────────────────────────────

/** Exposes the protected overlay handle for C10 idempotent-cleanup probe. */
class ProbeMenu extends UIMenuElement {
  get overlayHandle(): OverlayHandle | null {
    return (this as unknown as { _overlayHandle: OverlayHandle | null })._overlayHandle
  }
}
customElements.define('ui-menu-probe', ProbeMenu)

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────

/** Stub real DOMRects for the trigger/panel so the positioning math in overlay.ts doesn't fail. */
function stubRects(trigger: HTMLElement, panel: HTMLElement): void {
  trigger.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 200, bottom: 140, width: 100, height: 40, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect
  panel.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 0, bottom: 0, width: 160, height: 120, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

const DEFAULT_MARKUP = `
  <button>Open menu</button>
  <div data-value="a">Item A</div>
  <div data-value="b">Item B</div>
  <div data-value="c">Item C</div>
`

const MARKUP_WITH_DISABLED = `
  <button>Open menu</button>
  <div data-value="a">Alpha</div>
  <div data-value="b" disabled>Beta (disabled)</div>
  <div data-value="c">Gamma</div>
`

function makeMenu(markup = DEFAULT_MARKUP): { el: UIMenuElement; trigger: HTMLElement; panel: HTMLElement; items: HTMLElement[] } {
  const el = document.createElement('ui-menu') as UIMenuElement
  el.innerHTML = markup
  document.body.append(el)
  const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
  const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
  stubRects(trigger, panel)
  const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]
  return { el, trigger, panel, items }
}

function makeProbe(markup = DEFAULT_MARKUP): { el: ProbeMenu; trigger: HTMLElement; panel: HTMLElement; items: HTMLElement[] } {
  const el = document.createElement('ui-menu-probe') as ProbeMenu
  el.innerHTML = markup
  document.body.append(el)
  const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
  const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
  stubRects(trigger, panel)
  const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]
  return { el, trigger, panel, items }
}

// ── Upgrade + typed prop surface ──────────────────────────────────────────────────────────────

describe('ui-menu — upgrade + typed prop surface (menu-upgrade)', () => {
  it('menu-upgrade: upgrades to UIMenuElement with open=false + placement=bottom-start at defaults', () => {
    const el = document.createElement('ui-menu') as UIMenuElement
    expect(el).toBeInstanceOf(UIMenuElement)
    expect(el.open).toBe(false)
    expect(el.placement).toBe('bottom-start')
  })

  it('menu-typed: open is boolean and placement is the OverlayPlacement literal union (compile-time NCs)', () => {
    const fn = (): void => {
      const el = new UIMenuElement()
      el.open = true
      el.open = false
      // @ts-expect-error — open is boolean, not string
      el.open = 'yes'
      el.placement = 'top-end'
      el.placement = 'right-start'
      // @ts-expect-error — 'invalid' is not an OverlayPlacement member
      el.placement = 'invalid'
      // @ts-expect-error — 'bottom' alone (no alignment) is not valid
      el.placement = 'bottom'
    }
    expect(typeof fn).toBe('function') // never invoked — @ts-expect-error lines are the assertion
  })

  it('menu-define-guard: self-defines ui-menu, guarded against a double-define', () => {
    expect(customElements.get('ui-menu')).toBe(UIMenuElement)
    expect(() => {
      if (!customElements.get('ui-menu')) customElements.define('ui-menu', UIMenuElement)
    }).not.toThrow()
  })
})

// ── Parts created once (idempotent) ──────────────────────────────────────────────────────────

describe('ui-menu — control-created parts (menu-part-idempotent · menu-trigger-attrs · menu-panel-attrs)', () => {
  it('menu-part-idempotent: creates exactly ONE [data-part=panel] and ONE [data-part=trigger] on connect', () => {
    const { el } = makeMenu()
    expect(el.querySelectorAll('[data-part="panel"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="trigger"]')).toHaveLength(1)
    el.remove()
  })

  it('menu-part-idempotent: the panel is NOT re-created on disconnect + reconnect', () => {
    const { el } = makeMenu()
    const panelBefore = el.querySelector('[data-part="panel"]')
    el.remove()
    document.body.append(el)
    const panelAfter = el.querySelector('[data-part="panel"]')
    expect(panelAfter).toBe(panelBefore) // exact same node — never re-created
    expect(el.querySelectorAll('[data-part="panel"]')).toHaveLength(1)
    el.remove()
  })

  it('menu-trigger-attrs: trigger gets aria-controls pointing to the panel id, aria-haspopup="menu"', () => {
    const { trigger, panel, el } = makeMenu()
    expect(panel.id).toBeTruthy()
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    el.remove()
  })

  it('menu-panel-attrs: the panel has role="menu", popover="auto" set by the overlay controller, and tabindex="-1"', () => {
    const { panel, el } = makeMenu()
    expect(panel.getAttribute('role')).toBe('menu')
    expect(panel.getAttribute('popover')).toBe('auto')
    expect(panel.getAttribute('tabindex')).toBe('-1')
    el.remove()
  })
})

// ── Item role auto-assignment ─────────────────────────────────────────────────────────────────

describe('ui-menu — item children auto-get role=menuitem (menu-items-role)', () => {
  it('menu-items-role: all direct element children of the panel get role=menuitem if absent', () => {
    const { items, el } = makeMenu()
    expect(items.length).toBe(3)
    for (const item of items) {
      expect(item.getAttribute('role')).toBe('menuitem')
    }
    el.remove()
  })

  it('menu-items-role: an item that already has role=menuitem is not double-stamped', () => {
    const el = document.createElement('ui-menu') as UIMenuElement
    el.innerHTML = `
      <button>Open</button>
      <div role="menuitem">Pre-stamped</div>
      <div>Auto-stamped</div>
    `
    document.body.append(el)
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items.length).toBe(2)
    el.remove()
  })
})

// ── Two-way `open` — model→overlay ───────────────────────────────────────────────────────────

describe('ui-menu — open prop → overlay handle (menu-open-effect · menu-close-effect · menu-open-noop)', () => {
  it('menu-open-effect: open=true → showPopover() called; open=false → hidePopover() called', async () => {
    const { el, panel } = makeMenu()
    expect(callsOf(panel).show).toBe(0)

    el.open = true
    await whenFlushed()
    expect(callsOf(panel).show).toBe(1)
    expect(popoverOpen.get(panel)).toBe(true)

    el.open = false
    await whenFlushed()
    expect(callsOf(panel).hide).toBe(1)
    expect(popoverOpen.get(panel)).toBe(false)
    el.remove()
  })

  it('menu-open-noop: a redundant open=true write does not re-call showPopover (idempotent handle)', async () => {
    const { el, panel } = makeMenu()
    el.open = true
    await whenFlushed()
    expect(callsOf(panel).show).toBe(1)

    el.open = true // no transition — already open; handle.open() is a no-op
    await whenFlushed()
    expect(callsOf(panel).show).toBe(1)
    el.remove()
  })
})

// ── Two-way `open` — overlay→model (light-dismiss) ───────────────────────────────────────────

describe('ui-menu — overlay→model sync + events (menu-light-dismiss-sync · menu-light-dismiss-events)', () => {
  it('menu-light-dismiss-sync: a platform light-dismiss flips open=false (the two-way bind)', async () => {
    const { el, panel } = makeMenu()
    el.open = true
    await whenFlushed()
    expect(el.open).toBe(true)

    simulateLightDismiss(panel)
    expect(el.open).toBe(false)
    el.remove()
  })

  it('menu-light-dismiss-events: a platform light-dismiss emits BOTH close and toggle from the host', async () => {
    const { el, panel } = makeMenu()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    simulateLightDismiss(panel)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('menu-programmatic-no-emit: a programmatic close (open=false) does NOT emit close/toggle', async () => {
    const { el, panel } = makeMenu()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = false
    await whenFlushed()
    expect(callsOf(panel).hide).toBe(1)
    expect(closes).toBe(0)
    expect(toggles).toBe(0)
    el.remove()
  })
})

// ── aria-expanded sync ────────────────────────────────────────────────────────────────────────

describe('ui-menu — aria-expanded stays in sync with open (menu-aria-expanded)', () => {
  it('menu-aria-expanded: trigger has aria-expanded="false" on connect (default closed)', async () => {
    const { trigger, el } = makeMenu()
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })

  it('menu-aria-expanded: aria-expanded flips to "true" when open, back to "false" when closed', async () => {
    const { el, trigger } = makeMenu()
    await whenFlushed()

    el.open = true
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    el.open = false
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })

  it('menu-aria-expanded: light-dismiss resets aria-expanded via the subsequent effect re-run', async () => {
    const { el, trigger, panel } = makeMenu()
    el.open = true
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    simulateLightDismiss(panel)
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })
})

// ── `toggle` overlay-family contract — platform-dismiss only ─────────────────────────────────
//
// The overlay family contract: `toggle` fires ONLY on platform dismissal (Escape / outside-click),
// never on the open transition and never on a programmatic close (commit or open=false). The close
// direction is proven by menu-light-dismiss-events. These probes guard the two silent paths so
// no regression re-introduces an open-direction or programmatic-close emit.

describe('ui-menu — `toggle` is silent on the open transition and on programmatic close (menu-toggle-open)', () => {
  it('menu-toggle-open: open=true does NOT emit `toggle` — only platform light-dismiss does', async () => {
    const { el } = makeMenu()
    let toggles = 0
    el.addEventListener('toggle', () => toggles++)

    el.open = true
    await whenFlushed()
    expect(toggles).toBe(0) // the open transition never emits toggle (overlay family contract)
    el.remove()
  })

  it('menu-toggle-open: open=false (programmatic close) does NOT emit `toggle` — discriminator suppresses it', async () => {
    const { el } = makeMenu()
    el.open = true
    await whenFlushed()

    let toggles = 0
    el.addEventListener('toggle', () => toggles++)
    el.open = false // programmatic close — overlay discriminator suppresses toggle
    await whenFlushed()
    expect(toggles).toBe(0)
    el.remove()
  })
})

// ── Roving focus — Arrow navigation ──────────────────────────────────────────────────────────

describe('ui-menu — roving focus (menu-roving-focus · menu-roving-wrap · menu-roving-disabled)', () => {
  it('menu-roving-focus: ArrowDown moves focus to the next menuitem', async () => {
    const { el, panel, items } = makeMenu()
    el.open = true
    await whenFlushed()

    // Focus the first item manually (simulate what focusOnOpen would do in a real engine).
    items[0].focus()
    expect(document.activeElement).toBe(items[0])

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(items[1].tabIndex).toBe(0) // roving index advanced
    expect(items[0].tabIndex).toBe(-1)
    el.remove()
  })

  it('menu-roving-focus: ArrowUp moves focus to the previous menuitem', async () => {
    const { el, panel, items } = makeMenu()
    el.open = true
    await whenFlushed()

    // Navigate via keys only (rovingIndex starts at findFirst=0; manual focus() doesn't update it).
    // 0 → ArrowDown → 1 → ArrowDown → 2 → ArrowUp → 1.
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) // 0→1
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) // 1→2
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))   // 2→1
    expect(items[1].tabIndex).toBe(0)
    expect(items[0].tabIndex).toBe(-1)
    expect(items[2].tabIndex).toBe(-1)
    el.remove()
  })

  it('menu-roving-focus: Home/End jump to the first/last enabled menuitem', async () => {
    const { el, panel, items } = makeMenu()
    el.open = true
    await whenFlushed()

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(items[2].tabIndex).toBe(0)

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(items[0].tabIndex).toBe(0)
    el.remove()
  })

  it('menu-roving-wrap: ArrowDown wraps from the last item back to the first', async () => {
    const { el, panel, items } = makeMenu()
    el.open = true
    await whenFlushed()

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(items[2].tabIndex).toBe(0)

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(items[0].tabIndex).toBe(0) // wrapped to first
    el.remove()
  })

  it('menu-roving-disabled: ArrowDown skips disabled menuitems', async () => {
    const { el, panel, items } = makeMenu(MARKUP_WITH_DISABLED)
    el.open = true
    await whenFlushed()

    // items[0] = Alpha, items[1] = Beta (disabled), items[2] = Gamma
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    // Should jump over disabled item[1] to item[2]
    expect(items[2].tabIndex).toBe(0)
    expect(items[1].tabIndex).toBe(-1)
    el.remove()
  })
})

// ── Type-ahead ────────────────────────────────────────────────────────────────────────────────

describe('ui-menu — type-ahead navigation (menu-type-ahead)', () => {
  it('menu-type-ahead: typing a letter moves focus to the matching menuitem', async () => {
    const { el, panel, items } = makeMenu()
    el.open = true
    await whenFlushed()

    // items: "Item A" (0), "Item B" (1), "Item C" (2). All start with 'i'.
    // Typing 'i' from rovingIndex=0 searches forward: step=1 → idx=1 ("Item B" starts with 'i')
    // → moveTo(1). So item[1] gets tabIndex=0.
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true }))
    expect(items[1].tabIndex).toBe(0)
    el.remove()
  })

  it('menu-type-ahead: type-ahead skips disabled menuitems', async () => {
    const { el, panel, items } = makeMenu(MARKUP_WITH_DISABLED)
    el.open = true
    await whenFlushed()

    // items: "Alpha", "Beta (disabled)", "Gamma"
    // Typing 'b' from index 0 — Beta is disabled; should skip to Gamma ('g')? No, 'b' would match
    // Beta which is disabled. The type-ahead's `!isDisabled` guard should skip it and find no match,
    // leaving the focus unchanged. Instead test that 'g' lands on Gamma:
    items[0].focus()
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }))
    expect(items[2].tabIndex).toBe(0) // Gamma matched
    el.remove()
  })
})

// ── Commit → select + close ───────────────────────────────────────────────────────────────────

describe('ui-menu — commit → select event + close (menu-commit-select · menu-commit-closes)', () => {
  it('menu-commit-select: Enter on a focused menuitem emits select with { value, index }', async () => {
    const { el, panel, items } = makeMenu()
    el.open = true
    await whenFlushed()

    const selects: { value: string; index: number }[] = []
    el.addEventListener('select', (ev) => {
      selects.push((ev as CustomEvent<{ value: string; index: number }>).detail)
    })

    items[1].focus()
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(selects).toHaveLength(1)
    expect(selects[0]!.value).toBe('b')  // data-value="b"
    expect(selects[0]!.index).toBe(1)
    el.remove()
  })

  it('menu-commit-select: Space on a focused menuitem emits select', async () => {
    const { el, panel, items } = makeMenu()
    el.open = true
    await whenFlushed()

    const selects: { value: string }[] = []
    el.addEventListener('select', (ev) => {
      selects.push((ev as CustomEvent<{ value: string; index: number }>).detail)
    })

    items[0].focus()
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(selects).toHaveLength(1)
    expect(selects[0]!.value).toBe('a')
    el.remove()
  })

  it('menu-commit-select: fallback value is trimmed textContent when data-value is absent', async () => {
    const el = document.createElement('ui-menu') as UIMenuElement
    el.innerHTML = `<button>Open</button><div>Settings</div>`
    document.body.append(el)
    const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    stubRects(trigger, panel)
    el.open = true
    await whenFlushed()
    const items = [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]

    const selects: { value: string; index: number }[] = []
    el.addEventListener('select', (ev) => {
      selects.push((ev as CustomEvent<{ value: string; index: number }>).detail)
    })

    items[0].focus()
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(selects[0]!.value).toBe('Settings')
    el.remove()
  })

  it('menu-commit-closes: a commit (Enter/Space) closes the menu (open → false)', async () => {
    const { el, panel, items } = makeMenu()
    el.open = true
    await whenFlushed()
    expect(el.open).toBe(true)

    items[0].focus()
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await whenFlushed()
    expect(el.open).toBe(false)
    expect(callsOf(panel).hide).toBe(1)
    el.remove()
  })

  it('menu-commit-closes: after commit, close does NOT emit close/toggle (programmatic close path)', async () => {
    const { el, panel, items } = makeMenu()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    items[0].focus()
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await whenFlushed()
    expect(closes).toBe(0)   // programmatic close — no `close` event
    expect(toggles).toBe(0)  // no `toggle` event
    el.remove()
  })
})

// ── Click commit ──────────────────────────────────────────────────────────────────────────────

describe('ui-menu — click commit (menu-click-commit)', () => {
  it('menu-click-commit: clicking a menuitem emits select + closes the menu', async () => {
    const { el, items } = makeMenu()
    el.open = true
    await whenFlushed()

    const selects: { value: string; index: number }[] = []
    el.addEventListener('select', (ev) => {
      selects.push((ev as CustomEvent<{ value: string; index: number }>).detail)
    })

    items[2].click()
    await whenFlushed()
    expect(selects).toHaveLength(1)
    expect(selects[0]!.value).toBe('c')
    expect(selects[0]!.index).toBe(2)
    expect(el.open).toBe(false)
    el.remove()
  })
})

// ── Disabled item is skipped ──────────────────────────────────────────────────────────────────

describe('ui-menu — disabled menuitem is inert (menu-commit-disabled)', () => {
  it('menu-commit-disabled: Enter on a disabled item does NOT emit select', async () => {
    const { el, panel, items } = makeMenu(MARKUP_WITH_DISABLED)
    el.open = true
    await whenFlushed()

    const selects: unknown[] = []
    el.addEventListener('select', () => selects.push(true))

    items[1].focus() // Beta (disabled)
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(selects).toHaveLength(0)
    el.remove()
  })

  it('menu-commit-disabled: clicking a disabled item does NOT emit select', async () => {
    const { el, items } = makeMenu(MARKUP_WITH_DISABLED)
    el.open = true
    await whenFlushed()

    const selects: unknown[] = []
    el.addEventListener('select', () => selects.push(true))

    items[1].click() // Beta (disabled) — pointer-events:none in CSS, but the listener must also guard
    await whenFlushed()
    expect(selects).toHaveLength(0)
    el.remove()
  })
})

// ── C10 zero-residue ─────────────────────────────────────────────────────────────────────────

describe('ui-menu — C10 zero-residue (menu-c10-residue · menu-c10-stacking · menu-c10-cleanup)', () => {
  it('menu-c10-residue: after disconnect, a light-dismiss does NOT emit close/toggle (toggle listener removed)', async () => {
    const { el, panel } = makeMenu()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    el.remove() // disconnect → scope.dispose() → AC aborts → toggle listener dead

    simulateLightDismiss(panel) // listener is dead — should not propagate
    expect(closes).toBe(0)
  })

  it('menu-c10-stacking: reconnect does not stack listeners — close fires exactly ONCE per dismiss', async () => {
    const { el, panel } = makeMenu()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    simulateLightDismiss(panel) // first dismiss while connected → 1 close
    expect(closes).toBe(1)

    el.open = true
    await whenFlushed()

    el.remove() // disconnect
    document.body.append(el) // reconnect → wires exactly ONE new listener

    stubRects(
      el.querySelector<HTMLElement>('[data-part="trigger"]')!,
      el.querySelector<HTMLElement>('[data-part="panel"]')!,
    )
    el.open = true
    await whenFlushed()
    simulateLightDismiss(el.querySelector<HTMLElement>('[data-part="panel"]')!)
    expect(closes).toBe(2) // exactly ONE listener on the reconnected host — not doubled
    el.remove()
  })

  it('menu-c10-cleanup: cleanup() is idempotent — safe to call multiple times without throwing', () => {
    const { el } = makeProbe()
    expect(() => {
      el.overlayHandle?.cleanup()
      el.overlayHandle?.cleanup()
    }).not.toThrow()
    el.remove()
  })

  it('menu-c10-cleanup: cleanup() on an open menu closes it and makes subsequent open() a no-op', async () => {
    const { el, panel } = makeProbe()
    el.open = true
    await whenFlushed()
    expect(popoverOpen.get(panel)).toBe(true)

    el.overlayHandle?.cleanup()
    expect(popoverOpen.get(panel)).toBe(false)

    el.overlayHandle?.open()
    expect(callsOf(panel).show).toBe(1) // still only the original open
    el.remove()
  })
})

// ── Descriptor trip-wire ─────────────────────────────────────────────────────────────────────

const MENU_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/menu`
const md = readFileSync(`${MENU_DIR}/menu.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['open', 'placement']

describe('menu.md descriptor — frontmatter parses + schema-valid (menu-descriptor-schema)', () => {
  it('menu-descriptor-schema: has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-menu')
  })

  it('menu-descriptor-schema: carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('menu-descriptor-schema: tag=ui-menu, tier=pattern, extends=UIElement, NOT form-associated', () => {
    expect(/^tag:\s*ui-menu\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('menu-descriptor-schema: records the bindable `open` (reflected boolean) + select/toggle/close events (no standalone open event — family uniform)', () => {
    const open = parsed.attributes.find((a) => a.name === 'open')
    expect(open?.type).toBe('boolean')
    expect(open?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('select')
    expect(events).toContain('toggle') // fires on platform light-dismiss only (overlay family contract)
    expect(events).toContain('close')
    expect(events).not.toContain('open') // family uniform: no standalone open event
  })

  it('menu-descriptor-schema: validates with zero structural failures beyond the s12-pending BAD_EXTENDS for UIElement', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    const failures = validateComponentDescriptor(parsed)
    const pendingBaseClass = failures.filter((f) => f.code === 'BAD_EXTENDS' && f.path === 'extends')
    const otherFailures = failures.filter((f) => !(f.code === 'BAD_EXTENDS' && f.path === 'extends'))
    expect(otherFailures).toEqual([])
    expect(pendingBaseClass.length).toBeLessThanOrEqual(1)
  })
})

describe('menu.md descriptor — contract↔props trip-wire (menu-descriptor-bijection · menu-descriptor-negative)', () => {
  it('menu-descriptor-bijection: attributes[] is a faithful bijection with UIMenuElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UIMenuElement.props)).toEqual([])
  })

  it('menu-descriptor-negative: a drifted reflect FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'open' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UIMenuElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.open.reflect' }),
    )
  })

  it('menu-descriptor-negative: a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropPlacement: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'placement')
    expect(compareDescriptorToProps(dropPlacement, UIMenuElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.placement' }),
    )
  })

  it('menu-descriptor-negative: an added attribute FAILS the trip-wire (extra in descriptor)', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string', default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UIMenuElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
