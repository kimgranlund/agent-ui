import { describe, it, expect, beforeAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIPopoverElement } from './popover.ts'
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

// Wave-4 S1 jsdom probes — ui-popover (decomp S1 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// jsdom reality: the native Popover API (`showPopover`/`hidePopover`, the ToggleEvent) is absent
// in jsdom 29. We STUB it on `HTMLElement.prototype` (the sanctioned pattern from overlay.test.ts)
// with a minimal mirror of the platform contract — per-element open state, show/hide call counts,
// and the toggle event dispatch — before driving the control's logic. The REAL top-layer / Escape /
// outside-click / positioning behaviour is proven in popover.browser.test.ts (Chromium + WebKit).
//
// Named probes:
//   popover-upgrade · popover-typed · popover-define-guard · popover-part-idempotent ·
//   popover-trigger-attrs · popover-open-effect · popover-close-effect · popover-open-noop ·
//   popover-light-dismiss-sync · popover-light-dismiss-events · popover-programmatic-no-emit ·
//   popover-aria-expanded · popover-trigger-click (ADR-0101 erratum: mouse-click open must set the
//   `open` prop, not bypass it via a raw `handle.toggle()` — the ticket #28 residual) ·
//   popover-c10-residue · popover-c10-stacking · popover-c10-cleanup ·
//   popover-descriptor-schema · popover-descriptor-bijection · popover-descriptor-negative

// ── Popover API stub (jsdom lacks it entirely — mirrors overlay.test.ts setup) ─────────────────

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

/** Simulate a platform-initiated light-dismiss (Escape / outside-click) without calling hidePopover. */
function simulateLightDismiss(popup: HTMLElement): void {
  popoverOpen.set(popup, false)
  fireToggle(popup, 'closed')
}

// ── Test probe subclass ────────────────────────────────────────────────────────────────────────

/** Exposes the protected overlay handle for C10 idempotent-cleanup probe. */
class ProbePopover extends UIPopoverElement {
  get overlayHandle(): OverlayHandle | null {
    return (this as unknown as { _overlayHandle: OverlayHandle | null })._overlayHandle
  }
}
customElements.define('ui-popover-probe', ProbePopover)

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────

/** Stub real DOMRects for the anchor/panel so the positioning math in overlay.ts doesn't fail. */
function stubRects(trigger: HTMLElement, panel: HTMLElement): void {
  trigger.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 200, bottom: 140, width: 100, height: 40, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect
  panel.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 0, bottom: 0, width: 150, height: 120, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

function makePopover(markup = ''): { el: UIPopoverElement; trigger: HTMLElement; panel: HTMLElement } {
  const el = document.createElement('ui-popover') as UIPopoverElement
  // Default content: a button trigger + a paragraph of panel content
  el.innerHTML = markup || '<button>Toggle</button><p>Panel content</p>'
  document.body.append(el)
  // Parts are created in connected(); find them now.
  const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
  const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
  stubRects(trigger, panel)
  return { el, trigger, panel }
}

function makeProbe(markup = ''): { el: ProbePopover; trigger: HTMLElement; panel: HTMLElement } {
  const el = document.createElement('ui-popover-probe') as ProbePopover
  el.innerHTML = markup || '<button>Toggle</button><p>Panel content</p>'
  document.body.append(el)
  const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
  const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
  stubRects(trigger, panel)
  return { el, trigger, panel }
}

// ── Upgrade + typed prop surface ──────────────────────────────────────────────────────────────

describe('ui-popover — upgrade + typed prop surface (popover-upgrade)', () => {
  it('popover-upgrade: upgrades to UIPopoverElement with open=false + placement=bottom-start at defaults', () => {
    const el = document.createElement('ui-popover') as UIPopoverElement
    expect(el).toBeInstanceOf(UIPopoverElement)
    expect(el.open).toBe(false)
    expect(el.placement).toBe('bottom-start')
  })

  it('popover-typed: open is boolean and placement is the OverlayPlacement literal union (compile-time NCs)', () => {
    const fn = (): void => {
      const el = new UIPopoverElement()
      el.open = true
      el.open = false
      // @ts-expect-error — open is boolean, not string
      el.open = 'yes'
      el.placement = 'top-end'
      el.placement = 'right-start'
      // @ts-expect-error — 'invalid' is not an OverlayPlacement member (proves the literal union)
      el.placement = 'invalid'
      // @ts-expect-error — 'bottom' alone (no alignment) is not valid
      el.placement = 'bottom'
    }
    expect(typeof fn).toBe('function') // never invoked — the @ts-expect-error lines are the assertion
  })

  it('popover-define-guard: self-defines ui-popover, guarded against a double-define', () => {
    expect(customElements.get('ui-popover')).toBe(UIPopoverElement)
    expect(() => {
      if (!customElements.get('ui-popover')) customElements.define('ui-popover', UIPopoverElement)
    }).not.toThrow()
  })
})

// ── Parts created once (idempotent) ──────────────────────────────────────────────────────────

describe('ui-popover — control-created parts (popover-part-idempotent · popover-trigger-attrs)', () => {
  it('popover-part-idempotent: creates exactly ONE [data-part=panel] and ONE [data-part=trigger] on connect', () => {
    const { el } = makePopover()
    expect(el.querySelectorAll('[data-part="panel"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="trigger"]')).toHaveLength(1)
    el.remove()
  })

  it('popover-part-idempotent: the panel is NOT re-created on disconnect + reconnect', () => {
    const { el } = makePopover()
    const panelBefore = el.querySelector('[data-part="panel"]')
    el.remove()
    document.body.append(el)
    const panelAfter = el.querySelector('[data-part="panel"]')
    expect(panelAfter).toBe(panelBefore) // exact same node — never re-created
    expect(el.querySelectorAll('[data-part="panel"]')).toHaveLength(1) // still only ONE
    el.remove()
  })

  it('popover-trigger-attrs: trigger gets aria-controls pointing to the panel id', () => {
    const { trigger, panel } = makePopover()
    const el = trigger.closest('ui-popover')!
    expect(panel.id).toBeTruthy()
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
    el.remove()
  })

  it('popover-trigger-attrs: the panel has popover="auto" set by the overlay controller', () => {
    const { panel } = makePopover()
    const el = panel.closest('ui-popover')!
    expect(panel.getAttribute('popover')).toBe('auto')
    el.remove()
  })

  it('popover-trigger-attrs: the panel has tabindex="-1" so programmatic focus can land on it', () => {
    const { panel } = makePopover()
    const el = panel.closest('ui-popover')!
    expect(panel.getAttribute('tabindex')).toBe('-1')
    el.remove()
  })
})

// ── Two-way `open` — model→overlay ───────────────────────────────────────────────────────────

describe('ui-popover — open prop → overlay handle (popover-open-effect · popover-close-effect · popover-open-noop)', () => {
  it('popover-open-effect: open=true → showPopover() called; open=false → hidePopover() called', async () => {
    const { el, panel } = makePopover()
    expect(callsOf(panel).show).toBe(0) // closed by default — no showPopover on connect

    el.open = true
    await whenFlushed()
    expect(callsOf(panel).show).toBe(1) // the scope-owned effect opened it
    expect(popoverOpen.get(panel)).toBe(true)

    el.open = false
    await whenFlushed()
    expect(callsOf(panel).hide).toBe(1) // and closed it
    expect(popoverOpen.get(panel)).toBe(false)
    el.remove()
  })

  it('popover-open-effect: an open-on-connect popover (open=true before append) calls showPopover() once on connect', async () => {
    const el = document.createElement('ui-popover') as UIPopoverElement
    el.innerHTML = '<button>Toggle</button><p>Content</p>'
    el.open = true // set BEFORE connect (property-wins) → effect opens on connect
    document.body.append(el)
    await whenFlushed()
    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    stubRects(el.querySelector<HTMLElement>('[data-part="trigger"]')!, panel)
    expect(callsOf(panel).show).toBe(1)
    expect(popoverOpen.get(panel)).toBe(true)
    el.remove()
  })

  it('popover-open-noop: a redundant open=true write does not re-call showPopover (idempotent handle)', async () => {
    const { el, panel } = makePopover()
    el.open = true
    await whenFlushed()
    expect(callsOf(panel).show).toBe(1)

    el.open = true // no transition — already open; handle.open() is a no-op
    await whenFlushed()
    expect(callsOf(panel).show).toBe(1) // not re-shown
    el.remove()
  })
})

// ── Two-way `open` — overlay→model (light-dismiss) ───────────────────────────────────────────

describe('ui-popover — overlay→model sync + events (popover-light-dismiss-sync · popover-light-dismiss-events)', () => {
  it('popover-light-dismiss-sync: a platform light-dismiss flips open=false (the two-way bind)', async () => {
    const { el, panel } = makePopover()
    el.open = true
    await whenFlushed()
    expect(el.open).toBe(true)

    simulateLightDismiss(panel) // Escape / outside-click
    expect(el.open).toBe(false) // the close listener synced the prop immediately
    el.remove()
  })

  it('popover-light-dismiss-events: a platform light-dismiss emits BOTH close and toggle from the host', async () => {
    const { el, panel } = makePopover()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    simulateLightDismiss(panel)
    expect(closes).toBe(1) // the family close event (overlay controller)
    expect(toggles).toBe(1) // the value:{event:'toggle'} two-way signal (ADR-0019)
    el.remove()
  })

  it('popover-programmatic-no-emit: a programmatic close (open=false) DOES emit exactly one close+toggle pair (ADR-0101)', async () => {
    const { el, panel } = makePopover()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = false // the agent drives the close — the trait announces every real hide now
    await whenFlushed()
    expect(callsOf(panel).hide).toBe(1) // the panel WAS hidden
    expect(closes).toBe(1) // announced — component-/model-driven closes are no longer silent
    expect(toggles).toBe(1)
    el.remove()
  })
})

// ── aria-expanded sync ────────────────────────────────────────────────────────────────────────

describe('ui-popover — aria-expanded stays in sync with open (popover-aria-expanded)', () => {
  it('popover-aria-expanded: trigger has aria-expanded="false" on connect (default closed)', async () => {
    const { trigger, el } = makePopover()
    await whenFlushed() // let the initial effect run
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })

  it('popover-aria-expanded: aria-expanded flips to "true" when open, back to "false" when closed', async () => {
    const { el, trigger } = makePopover()
    await whenFlushed()

    el.open = true
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    el.open = false
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })

  it('popover-aria-expanded: light-dismiss resets aria-expanded to "false" via the subsequent effect re-run', async () => {
    const { el, trigger, panel } = makePopover()
    el.open = true
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    simulateLightDismiss(panel) // this.open → false → schedules effect
    await whenFlushed() // effect runs: aria-expanded → 'false'
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })
})

// ── Mouse-driven trigger open (the ADR-0101 erratum regression — the residual #28 defeat) ────────
//
// Every probe above opens via the PROGRAMMATIC prop (`el.open = true`), which never exercised the
// trigger's own click handler — the exact gap that let the mouse-click-open→handle.toggle() bypass
// ship undetected (3533 green tests, zero coverage of the primary mouse gesture).

describe('ui-popover — mouse-click trigger open/close (popover-trigger-click)', () => {
  it('popover-trigger-click: clicking the trigger opens the panel and sets open===true', async () => {
    const { el, trigger, panel } = makePopover()
    expect(el.open).toBe(false)

    trigger.click()
    await whenFlushed()
    expect(el.open, 'a mouse-click open must set the reflected open prop').toBe(true)
    expect(callsOf(panel).show).toBe(1)
    el.remove()
  })

  it('popover-trigger-click: clicking the trigger again closes the panel — open===false, one close+toggle pair', async () => {
    const { el, trigger, panel } = makePopover()
    trigger.click()
    await whenFlushed()
    expect(el.open).toBe(true)

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    trigger.click()
    await whenFlushed()
    expect(el.open, 'the second click must set open===false').toBe(false)
    expect(callsOf(panel).hide).toBe(1)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('popover-trigger-click REGRESSION (ticket #28): click-open the trigger, then a model-driven close — the panel must actually close', async () => {
    const { el, trigger, panel } = makePopover()

    // The exact reproduction: a MOUSE click opens the trigger (not the programmatic `el.open = true`
    // every other probe above uses) — before the fix, this left `el.open` stuck at `false` while the
    // panel was really open, so a subsequent programmatic `open = false` (the agent/model-driven close
    // path ADR-0101 targets) was a same-value no-op under the reactive cutoff.
    trigger.click()
    await whenFlushed()
    expect(el.open, 'precondition: mouse-open must set open===true').toBe(true)

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = false // model-driven close after a mouse-driven open
    await whenFlushed()

    expect(el.open, 'the panel must report closed after a post-mouse-open model-driven close').toBe(false)
    expect(callsOf(panel).hide, 'hidePopover() must actually fire — the bug: it never did').toBe(1)
    expect(closes, 'exactly one close event').toBe(1)
    expect(toggles, 'exactly one toggle event').toBe(1)
    el.remove()
  })
})

// ── C10 zero-residue ─────────────────────────────────────────────────────────────────────────

describe('ui-popover — C10 zero-residue (popover-c10-residue · popover-c10-stacking · popover-c10-cleanup)', () => {
  it('popover-c10-residue: after disconnect, a light-dismiss does NOT emit close/toggle (toggle listener removed)', async () => {
    const { el, panel } = makePopover()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    el.remove() // disconnect → scope.dispose() (cleanup fires) → AC aborts (toggle listener dead)

    // After disconnect: the popup's toggle listener is gone (host.listen rides the connection AC).
    simulateLightDismiss(panel) // listener is dead — should not propagate
    expect(closes).toBe(0) // no events on a disconnected host's panel toggle
  })

  it('popover-c10-stacking: reconnect does not stack listeners — close fires exactly ONCE per dismiss', async () => {
    const { el, panel } = makePopover()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    simulateLightDismiss(panel) // first dismiss while connected → 1 close
    expect(closes).toBe(1)
    // re-open and close again
    el.open = true
    await whenFlushed()

    el.remove() // disconnect
    document.body.append(el) // reconnect → connected() re-wires exactly ONE new listener

    stubRects(
      el.querySelector<HTMLElement>('[data-part="trigger"]')!,
      el.querySelector<HTMLElement>('[data-part="panel"]')!,
    )
    el.open = true
    await whenFlushed()
    simulateLightDismiss(el.querySelector<HTMLElement>('[data-part="panel"]')!)
    expect(closes).toBe(2) // exactly ONE new listener on the reconnected host — not doubled
    el.remove()
  })

  it('popover-c10-cleanup: cleanup() is idempotent — safe to call multiple times without throwing', () => {
    const { el } = makeProbe()
    const probe = el
    expect(() => {
      probe.overlayHandle?.cleanup()
      probe.overlayHandle?.cleanup() // second call: `cleaned` is already true — no throw
    }).not.toThrow()
    el.remove()
  })

  it('popover-c10-cleanup: cleanup() on an open popover closes it and makes subsequent open() a no-op', async () => {
    const { el, panel } = makeProbe()
    el.open = true
    await whenFlushed()
    expect(popoverOpen.get(panel)).toBe(true)

    el.overlayHandle?.cleanup()
    expect(popoverOpen.get(panel)).toBe(false) // cleanup closed it

    el.overlayHandle?.open() // `cleaned` guard → no-op
    expect(callsOf(panel).show).toBe(1) // still only the original open
    el.remove()
  })
})

// ── Descriptor trip-wire ─────────────────────────────────────────────────────────────────────

const POPOVER_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/popover`
const md = readFileSync(`${POPOVER_DIR}/popover.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['open', 'placement']

// `extends: UIElement` is not yet in BASE_CLASSES (the integration slice s12 adds it). Tolerate
// exactly that ONE pending structural failure, like the modal descriptor probe does.
// (UIModalElement does the same for UIContainerElement — see modal-descriptor.test.ts.)

describe('popover.md descriptor — frontmatter parses + schema-valid (popover-descriptor-schema)', () => {
  it('popover-descriptor-schema: has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-popover')
  })

  it('popover-descriptor-schema: carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('popover-descriptor-schema: tag=ui-popover, tier=pattern, extends=UIElement, NOT form-associated', () => {
    expect(/^tag:\s*ui-popover\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('popover-descriptor-schema: records the bindable `open` (reflected boolean) + close/toggle events (ADR-0019)', () => {
    const open = parsed.attributes.find((a) => a.name === 'open')
    expect(open?.type).toBe('boolean')
    expect(open?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('toggle') // the value:{event:'toggle'} two-way signal
    expect(events).toContain('close')  // the family close event
  })

  it('popover-descriptor-schema: validates with zero structural failures beyond the s12-pending BAD_EXTENDS for UIElement', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    const failures = validateComponentDescriptor(parsed)
    const pendingBaseClass = failures.filter((f) => f.code === 'BAD_EXTENDS' && f.path === 'extends')
    const otherFailures = failures.filter((f) => !(f.code === 'BAD_EXTENDS' && f.path === 'extends'))
    expect(otherFailures).toEqual([]) // every OTHER field is schema-clean
    expect(pendingBaseClass.length).toBeLessThanOrEqual(1) // the lone pending base-class failure (gone after s12)
  })
})

describe('popover.md descriptor — contract↔props trip-wire (popover-descriptor-bijection · popover-descriptor-negative)', () => {
  it('popover-descriptor-bijection: attributes[] is a faithful bijection with UIPopoverElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UIPopoverElement.props)).toEqual([])
  })

  it('popover-descriptor-negative: a drifted reflect FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'open' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UIPopoverElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.open.reflect' }),
    )
  })

  it('popover-descriptor-negative: a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropPlacement: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'placement')
    expect(compareDescriptorToProps(dropPlacement, UIPopoverElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.placement' }),
    )
  })

  it('popover-descriptor-negative: an added attribute FAILS the trip-wire (extra in descriptor)', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string', default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UIPopoverElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
