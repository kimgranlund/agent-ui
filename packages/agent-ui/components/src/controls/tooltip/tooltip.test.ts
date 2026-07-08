import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UITooltipElement } from './tooltip.ts'
import type { OverlayHandle } from '../../traits/overlay.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Wave-4 S2 jsdom probes — ui-tooltip (decomp S2 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// jsdom reality: the native Popover API (showPopover/hidePopover, ToggleEvent) is absent in
// jsdom 29. We STUB it on HTMLElement.prototype (the sanctioned pattern from overlay.test.ts /
// popover.test.ts) with a minimal mirror of the platform contract before driving the control.
// The REAL top-layer / positioning behaviour is proven in tooltip.browser.test.ts (Chromium + WebKit).
//
// Named probes:
//   tooltip-upgrade · tooltip-typed · tooltip-define-guard · tooltip-part-idempotent ·
//   tooltip-anchor-attrs · tooltip-show-hover-delay · tooltip-show-focus-immediate ·
//   tooltip-hide-mouseleave · tooltip-hide-focusout · tooltip-hide-escape ·
//   tooltip-no-focus-steal · tooltip-open-two-way · tooltip-programmatic-no-emit ·
//   tooltip-user-close-emits · tooltip-c10-residue · tooltip-c10-stacking · tooltip-c10-cleanup ·
//   tooltip-descriptor-schema · tooltip-descriptor-bijection · tooltip-descriptor-negative

// ── Popover API stub (jsdom lacks it entirely — mirrors overlay.test.ts / popover.test.ts setup) ──

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
    if (popoverOpen.get(this)) return // already open — no-op (platform parity)
    popoverOpen.set(this, true)
    fireToggle(this, 'open')
  }

  proto.hidePopover = function (this: HTMLElement): void {
    callsOf(this).hide++
    if (!popoverOpen.get(this)) return // already hidden — no-op (platform parity)
    popoverOpen.set(this, false)
    fireToggle(this, 'closed')
  }
})

// ── Test probe subclass ───────────────────────────────────────────────────────────────────

/** Exposes the protected overlay handle for C10 idempotent-cleanup probe. */
class ProbeTooltip extends UITooltipElement {
  get overlayHandle(): OverlayHandle | null {
    return (this as unknown as { _overlayHandle: OverlayHandle | null })._overlayHandle
  }
}
customElements.define('ui-tooltip-probe', ProbeTooltip)

// ── Helpers ──────────────────────────────────────────────────────────────────────────────

/** Stub real DOMRects for the anchor/panel so the positioning math in overlay.ts does not fail. */
function stubRects(anchor: HTMLElement, panel: HTMLElement): void {
  anchor.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 200, bottom: 140, width: 100, height: 40, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect
  panel.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 0, bottom: 0, width: 150, height: 60, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

function makeTooltip(markup = ''): { el: UITooltipElement; anchor: HTMLElement; panel: HTMLElement } {
  const el = document.createElement('ui-tooltip') as UITooltipElement
  el.innerHTML = markup || '<button>Hover me</button>Tooltip text'
  el.delay = 0 // zero delay so timer-based tests use minimal waits
  document.body.append(el)
  const anchor = el.querySelector<HTMLElement>('[data-part="anchor"]')!
  const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
  stubRects(anchor, panel)
  return { el, anchor, panel }
}

function makeProbe(markup = ''): { el: ProbeTooltip; anchor: HTMLElement; panel: HTMLElement } {
  const el = document.createElement('ui-tooltip-probe') as ProbeTooltip
  el.innerHTML = markup || '<button>Hover me</button>Tooltip text'
  el.delay = 0
  document.body.append(el)
  const anchor = el.querySelector<HTMLElement>('[data-part="anchor"]')!
  const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
  stubRects(anchor, panel)
  return { el, anchor, panel }
}

// ── Upgrade + typed prop surface ──────────────────────────────────────────────────────────

describe('ui-tooltip — upgrade + typed prop surface (tooltip-upgrade)', () => {
  it('tooltip-upgrade: upgrades to UITooltipElement with open=false, placement=bottom-start, delay=600', () => {
    const el = document.createElement('ui-tooltip') as UITooltipElement
    expect(el).toBeInstanceOf(UITooltipElement)
    expect(el.open).toBe(false)
    expect(el.placement).toBe('bottom-start')
    expect(el.delay).toBe(600)
  })

  it('tooltip-typed: open is boolean, placement is the OverlayPlacement literal union, delay is number|null (NCs)', () => {
    const fn = (): void => {
      const el = new UITooltipElement()
      el.open = true
      el.open = false
      // @ts-expect-error — open is boolean, not string
      el.open = 'yes'
      el.placement = 'top-end'
      el.placement = 'right-start'
      // @ts-expect-error — 'invalid' is not an OverlayPlacement member
      el.placement = 'invalid'
      // @ts-expect-error — 'bottom' alone is not valid (no alignment suffix)
      el.placement = 'bottom'
      el.delay = 500
      el.delay = null
      // @ts-expect-error — delay is number|null, not string
      el.delay = 'slow'
    }
    expect(typeof fn).toBe('function') // never invoked — the @ts-expect-error lines are the assertion
  })

  it('tooltip-define-guard: self-defines ui-tooltip, guarded against a double-define', () => {
    expect(customElements.get('ui-tooltip')).toBe(UITooltipElement)
    expect(() => {
      if (!customElements.get('ui-tooltip')) customElements.define('ui-tooltip', UITooltipElement)
    }).not.toThrow()
  })
})

// ── Parts created once (idempotent) ──────────────────────────────────────────────────────

describe('ui-tooltip — control-created parts (tooltip-part-idempotent · tooltip-anchor-attrs)', () => {
  it('tooltip-part-idempotent: creates exactly ONE [data-part=panel] and ONE [data-part=anchor] on connect', () => {
    const { el } = makeTooltip()
    expect(el.querySelectorAll('[data-part="panel"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="anchor"]')).toHaveLength(1)
    el.remove()
  })

  it('tooltip-part-idempotent: the panel is NOT re-created on disconnect + reconnect', () => {
    const { el } = makeTooltip()
    const panelBefore = el.querySelector('[data-part="panel"]')
    el.remove()
    document.body.append(el)
    const panelAfter = el.querySelector('[data-part="panel"]')
    expect(panelAfter).toBe(panelBefore) // exact same node — never re-created
    expect(el.querySelectorAll('[data-part="panel"]')).toHaveLength(1) // still only ONE
    el.remove()
  })

  it('tooltip-anchor-attrs: anchor gets aria-describedby pointing to the panel id', () => {
    const { anchor, panel, el } = makeTooltip()
    expect(panel.id).toBeTruthy()
    expect(anchor.getAttribute('aria-describedby')).toBe(panel.id)
    el.remove()
  })

  it('tooltip-anchor-attrs: the panel has role="tooltip" set by the control', () => {
    const { panel, el } = makeTooltip()
    expect(panel.getAttribute('role')).toBe('tooltip')
    el.remove()
  })

  it('tooltip-anchor-attrs: the panel has popover="manual" set by the overlay controller', () => {
    const { panel, el } = makeTooltip()
    expect(panel.getAttribute('popover')).toBe('manual')
    el.remove()
  })
})

// ── Show on hover after delay ─────────────────────────────────────────────────────────────

describe('ui-tooltip — show on hover after delay (tooltip-show-hover-delay)', () => {
  afterEach(() => { vi.useRealTimers() })

  it('tooltip-show-hover-delay: mouseenter schedules open after delay; panel shows after timer fires', async () => {
    vi.useFakeTimers()
    const { el, anchor, panel } = makeTooltip()
    el.delay = 300

    anchor.dispatchEvent(new MouseEvent('mouseenter'))
    expect(el.open).toBe(false) // not yet — delay pending

    vi.advanceTimersByTime(300)
    await whenFlushed()
    expect(el.open).toBe(true)
    expect(callsOf(panel).show).toBe(1)
    el.remove()
  })

  it('tooltip-show-hover-delay: mouseleave before delay fires cancels the pending show', async () => {
    vi.useFakeTimers()
    const { el, anchor, panel } = makeTooltip()
    el.delay = 300

    anchor.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(100) // not enough — timer still pending
    anchor.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(300) // advance past original delay
    await whenFlushed()

    expect(el.open).toBe(false) // cancelled — never opened
    expect(callsOf(panel).show).toBe(0)
    el.remove()
  })

  it('tooltip-show-hover-delay: repeated mouseenter replaces the pending timer (no double-open)', async () => {
    vi.useFakeTimers()
    const { el, anchor, panel } = makeTooltip()
    el.delay = 300

    anchor.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(100)
    // second mouseenter before delay fires — replaces the timer
    anchor.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(300) // the replaced timer fires once
    await whenFlushed()

    expect(el.open).toBe(true)
    expect(callsOf(panel).show).toBe(1) // still exactly ONE show
    el.remove()
  })
})

// ── Show on focus (no delay) ──────────────────────────────────────────────────────────────

describe('ui-tooltip — show immediately on keyboard focus (tooltip-show-focus-immediate)', () => {
  it('tooltip-show-focus-immediate: focusin on anchor shows the tooltip immediately (no timer needed)', async () => {
    const { el, anchor, panel } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()
    expect(el.open).toBe(true)
    expect(callsOf(panel).show).toBe(1)
    el.remove()
  })

  it('tooltip-show-focus-immediate: focusin cancels any pending hover delay and opens immediately', async () => {
    vi.useFakeTimers()
    const { el, anchor, panel } = makeTooltip()
    el.delay = 500

    anchor.dispatchEvent(new MouseEvent('mouseenter')) // start hover delay
    anchor.dispatchEvent(new Event('focusin', { bubbles: true })) // focus → immediate
    await whenFlushed()

    expect(el.open).toBe(true)
    expect(callsOf(panel).show).toBe(1) // exactly ONE show — hover timer was cancelled

    vi.advanceTimersByTime(600) // advance past original delay — the cancelled timer must not fire
    await whenFlushed()
    expect(callsOf(panel).show).toBe(1) // still only ONE show
    vi.useRealTimers()
    el.remove()
  })
})

// ── Hide on mouseleave ────────────────────────────────────────────────────────────────────

describe('ui-tooltip — hide on mouseleave (tooltip-hide-mouseleave)', () => {
  it('tooltip-hide-mouseleave: mouseleave closes the open tooltip and emits close+toggle', async () => {
    const { el, anchor } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()
    expect(el.open).toBe(true)

    let closes = 0; let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    anchor.dispatchEvent(new MouseEvent('mouseleave'))
    expect(el.open).toBe(false) // the prop setter is synchronous
    // ADR-0101 — the trait (not this control) is now the sole announcer, so close/toggle fire from
    // the scope-owned effect's next tick (handle.close()), not synchronously inside the listener.
    await whenFlushed()
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('tooltip-hide-mouseleave: mouseleave when closed is a no-op (no events, no error)', () => {
    const { el, anchor } = makeTooltip()
    expect(el.open).toBe(false)
    let closes = 0
    el.addEventListener('close', () => closes++)
    anchor.dispatchEvent(new MouseEvent('mouseleave'))
    expect(closes).toBe(0) // idempotent guard — nothing to close
    el.remove()
  })
})

// ── Hide on focusout ──────────────────────────────────────────────────────────────────────

describe('ui-tooltip — hide on focusout (tooltip-hide-focusout)', () => {
  it('tooltip-hide-focusout: focusout closes the open tooltip and emits close+toggle', async () => {
    const { el, anchor } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()
    expect(el.open).toBe(true)

    let closes = 0; let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    anchor.dispatchEvent(new Event('focusout', { bubbles: true }))
    expect(el.open).toBe(false) // the prop setter is synchronous
    await whenFlushed() // close/toggle now fire from the effect-driven transition (ADR-0101)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })
})

// ── Hide on Escape ────────────────────────────────────────────────────────────────────────

describe('ui-tooltip — hide on Escape (tooltip-hide-escape)', () => {
  it('tooltip-hide-escape: Escape closes the open tooltip and emits close+toggle', async () => {
    const { el, anchor } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()
    expect(el.open).toBe(true)

    let closes = 0; let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(el.open).toBe(false) // the prop setter is synchronous
    await whenFlushed() // close/toggle now fire from the effect-driven transition (ADR-0101)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('tooltip-hide-escape: Escape when closed is a no-op (no events fired)', () => {
    const { el } = makeTooltip()
    expect(el.open).toBe(false)
    let closes = 0
    el.addEventListener('close', () => closes++)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(closes).toBe(0)
    el.remove()
  })

  it('tooltip-hide-escape: non-Escape key does not close the tooltip', async () => {
    const { el, anchor } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()
    expect(el.open).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(el.open).toBe(true) // Enter does not close a tooltip
    el.remove()
  })
})

// ── Never moves focus ─────────────────────────────────────────────────────────────────────

describe('ui-tooltip — never steals focus (tooltip-no-focus-steal)', () => {
  it('tooltip-no-focus-steal: showing the tooltip via hover does not change document.activeElement', async () => {
    vi.useFakeTimers()
    const { el, anchor } = makeTooltip()
    el.delay = 100

    // Focus something external — simulates a user who is somewhere else on the page.
    const external = document.createElement('button')
    external.textContent = 'external'
    document.body.append(external)
    external.focus()
    expect(document.activeElement).toBe(external)

    anchor.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(150)
    await whenFlushed()

    expect(el.open).toBe(true)
    expect(document.activeElement, 'tooltip hover must not steal focus').toBe(external)

    vi.useRealTimers()
    external.remove()
    el.remove()
  })

  it('tooltip-no-focus-steal: showing the tooltip via focus keeps activeElement on the anchor (not the panel)', async () => {
    const { el, anchor } = makeTooltip()

    anchor.focus()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()

    expect(el.open).toBe(true)
    // Focus must remain on the anchor — NOT moved to the panel (focusOnOpen=false means the
    // overlay controller never calls moveFocusIn). Assert positively (=== anchor) not just
    // (!== panel) so the probe bites if focus drifts to any other element.
    expect(document.activeElement).toBe(anchor)
    el.remove()
  })
})

// ── Two-way open ──────────────────────────────────────────────────────────────────────────

describe('ui-tooltip — two-way open prop (tooltip-open-two-way)', () => {
  it('tooltip-open-two-way: open=true calls showPopover; open=false calls hidePopover', async () => {
    const { el, panel } = makeTooltip()
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

  it('tooltip-open-two-way: redundant open=true does not re-call showPopover (idempotent handle)', async () => {
    const { el, panel } = makeTooltip()
    el.open = true
    await whenFlushed()
    expect(callsOf(panel).show).toBe(1)

    el.open = true // already open — overlay's isOpen guard fires
    await whenFlushed()
    expect(callsOf(panel).show).toBe(1) // not re-shown
    el.remove()
  })

  it('tooltip-programmatic-no-emit: programmatic close (open=false) DOES emit exactly one close+toggle pair (ADR-0101)', async () => {
    const { el, anchor } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()
    expect(el.open).toBe(true)

    let closes = 0; let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = false // programmatic — no user interaction involved; the trait announces this too now
    await whenFlushed()
    expect(closes).toBe(1) // the trait is the sole, uniform announcer (ADR-0101) — no discriminator left
    expect(toggles).toBe(1)
    el.remove()
  })

  it('tooltip-user-close-emits: user-driven close emits close THEN toggle, and el.open is false AT toggle time', async () => {
    const { el, anchor } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()

    const order: string[] = []
    el.addEventListener('close', () => order.push('close'))
    el.addEventListener('toggle', () => {
      // The biting assertion: el.open must already be false when toggle fires so a renderer
      // reading el.open inside its handler writes the CORRECT closed value into the model.
      expect(el.open, 'el.open must be false at toggle-handler time (not the stale open=true)').toBe(false)
      order.push('toggle')
    })

    anchor.dispatchEvent(new Event('focusout', { bubbles: true })) // user-driven
    // ADR-0101 — the trait announces from the scope-owned effect's next tick, not synchronously
    // inside the focusout listener (userClose only sets the prop); await the flush to observe it.
    await whenFlushed()
    expect(order).toEqual(['close', 'toggle']) // close BEFORE toggle (the ordering invariant)
    el.remove()
  })
})

// ── C10 zero-residue ─────────────────────────────────────────────────────────────────────

describe('ui-tooltip — C10 zero-residue (tooltip-c10-residue · tooltip-c10-stacking · tooltip-c10-cleanup)', () => {
  it('tooltip-c10-residue: after disconnect, Escape does NOT close or emit (keydown listener removed)', async () => {
    const { el, anchor } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()
    expect(el.open).toBe(true)

    let closes = 0
    el.addEventListener('close', () => closes++)

    el.remove() // disconnect → ac.abort() → keydown listener removed

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(closes).toBe(0) // listener is dead — Escape has no effect
    expect(el.open).toBe(true) // prop unchanged (listener was removed before it could act)
  })

  it('tooltip-c10-residue: after disconnect, mouseleave does NOT emit (anchor listener removed)', async () => {
    const { el, anchor } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    el.remove() // disconnect → listeners removed

    anchor.dispatchEvent(new MouseEvent('mouseleave'))
    expect(closes).toBe(0) // no listener active
  })

  it('tooltip-c10-stacking: reconnect does not stack listeners — close fires exactly ONCE per dismiss', async () => {
    const { el, anchor } = makeTooltip()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    anchor.dispatchEvent(new Event('focusout', { bubbles: true })) // first dismiss
    await whenFlushed() // ADR-0101 — close/toggle fire from the effect-driven transition
    expect(closes).toBe(1)

    // Reconnect cycle — new listeners wired, old ones already aborted
    el.remove()
    document.body.append(el)
    // re-stub rects after reconnect
    const anchor2 = el.querySelector<HTMLElement>('[data-part="anchor"]')!
    const panel2 = el.querySelector<HTMLElement>('[data-part="panel"]')!
    stubRects(anchor2, panel2)

    anchor2.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()
    anchor2.dispatchEvent(new Event('focusout', { bubbles: true }))
    await whenFlushed()
    expect(closes).toBe(2) // exactly ONE new listener — not doubled

    el.remove()
  })

  it('tooltip-c10-cleanup: cleanup() is idempotent — safe to call multiple times without throwing', () => {
    const { el } = makeProbe()
    expect(() => {
      el.overlayHandle?.cleanup()
      el.overlayHandle?.cleanup() // second call: cleaned=true → no-op (no throw)
    }).not.toThrow()
    el.remove()
  })

  it('tooltip-c10-cleanup: cleanup() on an open tooltip closes the panel and makes subsequent open() a no-op', async () => {
    const { el, anchor, panel } = makeProbe()
    anchor.dispatchEvent(new Event('focusin', { bubbles: true }))
    await whenFlushed()
    expect(popoverOpen.get(panel)).toBe(true)

    el.overlayHandle?.cleanup()
    expect(popoverOpen.get(panel)).toBe(false) // cleanup closed it

    el.overlayHandle?.open() // cleaned=true guard → no-op
    expect(callsOf(panel).show).toBe(1) // still only the original open
    el.remove()
  })
})

// ── Descriptor trip-wire ─────────────────────────────────────────────────────────────────

const TOOLTIP_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/tooltip`
const md = readFileSync(`${TOOLTIP_DIR}/tooltip.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['open', 'placement', 'delay']

describe('tooltip.md descriptor — frontmatter parses + schema-valid (tooltip-descriptor-schema)', () => {
  it('tooltip-descriptor-schema: has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-tooltip')
  })

  it('tooltip-descriptor-schema: carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('tooltip-descriptor-schema: tag=ui-tooltip, tier=pattern, extends=UIElement, NOT form-associated', () => {
    expect(/^tag:\s*ui-tooltip\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('tooltip-descriptor-schema: records the bindable open (reflected boolean) + close/toggle events (ADR-0019)', () => {
    const open = parsed.attributes.find((a) => a.name === 'open')
    expect(open?.type).toBe('boolean')
    expect(open?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('toggle') // the value:{event:'toggle'} two-way signal
    expect(events).toContain('close')  // the family close event
  })

  it('tooltip-descriptor-schema: records the delay attribute as type=number, reflect=false, default=600', () => {
    const delay = parsed.attributes.find((a) => a.name === 'delay')
    expect(delay?.type).toBe('number')
    expect(delay?.reflect).toBe(false)
    expect(delay?.default).toBe('600')
  })

  it('tooltip-descriptor-schema: validates with zero structural failures beyond the s12-pending BAD_EXTENDS for UIElement', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    const failures = validateComponentDescriptor(parsed)
    const pendingBaseClass = failures.filter((f) => f.code === 'BAD_EXTENDS' && f.path === 'extends')
    const otherFailures = failures.filter((f) => !(f.code === 'BAD_EXTENDS' && f.path === 'extends'))
    expect(otherFailures).toEqual([]) // every OTHER field is schema-clean
    expect(pendingBaseClass.length).toBeLessThanOrEqual(1) // lone pending base-class failure (gone after s12)
  })
})

describe('tooltip.md descriptor — contract↔props trip-wire (tooltip-descriptor-bijection · tooltip-descriptor-negative)', () => {
  it('tooltip-descriptor-bijection: attributes[] is a faithful bijection with UITooltipElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UITooltipElement.props)).toEqual([])
  })

  it('tooltip-descriptor-negative: a drifted reflect FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'open' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UITooltipElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.open.reflect' }),
    )
  })

  it('tooltip-descriptor-negative: a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropDelay: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'delay')
    expect(compareDescriptorToProps(dropDelay, UITooltipElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.delay' }),
    )
  })

  it('tooltip-descriptor-negative: an added attribute FAILS the trip-wire (extra in descriptor)', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string', default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UITooltipElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
