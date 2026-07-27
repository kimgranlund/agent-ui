import { describe, it, expect, beforeAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIFormPopoverElement } from './form-popover.ts'
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

// jsdom probes — ui-form-popover (GH #294 F4 · form-popover.decomp.md S1/S2 T1-T4 ·
// form-popover.spec.md SPEC-R1..R11 · form-popover.lld.md LLD-C1..C7).
//
// jsdom reality: the native Popover API (`showPopover`/`hidePopover`, the ToggleEvent) is absent
// in jsdom. We STUB it on `HTMLElement.prototype` (the popover.test.ts pattern) with a minimal
// mirror of the platform contract before driving the control's logic. The REAL top-layer /
// Escape / outside-click / positioning / native-Tab behaviour is proven in
// form-popover.browser.test.ts (Chromium + WebKit).

// ── Popover API stub (jsdom lacks it entirely — mirrors popover.test.ts setup) ──────────────────

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
    if (popoverOpen.get(this)) return
    popoverOpen.set(this, true)
    fireToggle(this, 'open')
  }

  proto.hidePopover = function (this: HTMLElement): void {
    callsOf(this).hide++
    if (!popoverOpen.get(this)) return
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

/** Exposes the protected overlay handle for cleanup-idempotence probes. */
class ProbeFormPopover extends UIFormPopoverElement {
  get overlayHandle(): OverlayHandle | null {
    return (this as unknown as { _overlayHandle: OverlayHandle | null })._overlayHandle
  }
}
customElements.define('ui-form-popover-probe', ProbeFormPopover)

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────

/** Stub real DOMRects for the anchor/panel so the positioning math in overlay.ts doesn't fail. */
function stubRects(trigger: HTMLElement, panel: HTMLElement): void {
  trigger.getBoundingClientRect = () =>
    ({ left: 100, top: 100, right: 200, bottom: 140, width: 100, height: 40, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect
  panel.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 0, bottom: 0, width: 150, height: 120, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

function makeFormPopover(markup = ''): { el: UIFormPopoverElement; trigger: HTMLElement; panel: HTMLElement } {
  const el = document.createElement('ui-form-popover') as UIFormPopoverElement
  el.innerHTML = markup || '<input type="checkbox" name="opt" value="a">'
  document.body.append(el)
  const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
  const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
  stubRects(trigger, panel)
  return { el, trigger, panel }
}

function makeProbe(markup = ''): { el: ProbeFormPopover; trigger: HTMLElement; panel: HTMLElement } {
  const el = document.createElement('ui-form-popover-probe') as ProbeFormPopover
  el.innerHTML = markup || '<input type="checkbox" name="opt" value="a">'
  document.body.append(el)
  const trigger = el.querySelector<HTMLElement>('[data-part="trigger"]')!
  const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
  stubRects(trigger, panel)
  return { el, trigger, panel }
}

// ── Upgrade + typed prop surface ──────────────────────────────────────────────────────────────

describe('ui-form-popover — upgrade + typed prop surface', () => {
  it('upgrades to UIFormPopoverElement with defaults: open=false, placement=bottom-start, label="", size=md', () => {
    const el = document.createElement('ui-form-popover') as UIFormPopoverElement
    expect(el).toBeInstanceOf(UIFormPopoverElement)
    expect(el.open).toBe(false)
    expect(el.placement).toBe('bottom-start')
    expect(el.label).toBe('')
    expect(el.size).toBe('md')
  })

  it('props are typed literal unions (compile-time NCs)', () => {
    const fn = (): void => {
      const el = new UIFormPopoverElement()
      el.open = true
      // @ts-expect-error — open is boolean, not string
      el.open = 'yes'
      el.placement = 'top-end'
      // @ts-expect-error — 'invalid' is not an OverlayPlacement member
      el.placement = 'invalid'
      el.label = 'Options · 3 selected'
      el.size = 'lg'
      // @ts-expect-error — 'xl' is not a size member
      el.size = 'xl'
    }
    expect(typeof fn).toBe('function') // never invoked — the @ts-expect-error lines are the assertion
  })

  it('self-defines ui-form-popover, guarded against a double-define', () => {
    expect(customElements.get('ui-form-popover')).toBe(UIFormPopoverElement)
    expect(() => {
      if (!customElements.get('ui-form-popover')) customElements.define('ui-form-popover', UIFormPopoverElement)
    }).not.toThrow()
  })
})

// ── T1: parts created once (idempotent); ALL author children move into the panel ────────────────

describe('ui-form-popover — control-created parts (T1)', () => {
  it('creates exactly ONE [data-part=trigger] and ONE [data-part=panel] on connect', () => {
    const { el } = makeFormPopover()
    expect(el.querySelectorAll('[data-part="trigger"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="panel"]')).toHaveLength(1)
    el.remove()
  })

  it('parts are NOT re-created on disconnect + reconnect — same nodes, stable panel id', () => {
    const { el } = makeFormPopover()
    const triggerBefore = el.querySelector('[data-part="trigger"]')
    const panelBefore = el.querySelector('[data-part="panel"]')
    const idBefore = (panelBefore as HTMLElement).id
    el.remove()
    document.body.append(el)
    expect(el.querySelector('[data-part="trigger"]')).toBe(triggerBefore)
    expect(el.querySelector('[data-part="panel"]')).toBe(panelBefore)
    expect((el.querySelector('[data-part="panel"]') as HTMLElement).id).toBe(idBefore)
    expect(el.querySelectorAll('[data-part="panel"]')).toHaveLength(1)
    el.remove()
  })

  it('ALL author children move into the panel — there is no author trigger to skip (unlike ui-popover)', () => {
    const { el, panel } = makeFormPopover(
      '<input type="checkbox" name="a" value="1"><input type="text" name="b">',
    )
    expect(panel.children).toHaveLength(2)
    expect(el.children).toHaveLength(2) // trigger + panel only, at the host level
    el.remove()
  })

  it('the trigger contains [data-part=label] and [data-part=caret] (select precedent)', () => {
    const { trigger } = makeFormPopover()
    expect(trigger.querySelector('[data-part="label"]')).toBeTruthy()
    expect(trigger.querySelector('[data-part="caret"]')).toBeTruthy()
    trigger.closest('ui-form-popover')!.remove()
  })

  it('the panel carries [data-box] and tabindex="-1"', () => {
    const { panel } = makeFormPopover()
    expect(panel.hasAttribute('data-box')).toBe(true)
    expect(panel.getAttribute('tabindex')).toBe('-1')
    panel.closest('ui-form-popover')!.remove()
  })

  it('the trigger gets aria-controls pointing to the panel id; the panel has popover="auto" (overlay-owned)', () => {
    const { trigger, panel } = makeFormPopover()
    expect(panel.id).toBeTruthy()
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('popover')).toBe('auto')
    trigger.closest('ui-form-popover')!.remove()
  })

  it('the trigger carries NO aria-haspopup (SPEC-R6 — a generic disclosure surface, not a menu/listbox)', () => {
    const { trigger } = makeFormPopover()
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false)
    trigger.closest('ui-form-popover')!.remove()
  })
})

// ── T2 is the descriptor trip-wire suite below; T3 — the label effect ───────────────────────────

describe('ui-form-popover — label effect (T3)', () => {
  it('writing `label` updates [data-part=label] textContent', async () => {
    const { el, trigger } = makeFormPopover()
    el.label = 'Options · 3 selected'
    await whenFlushed()
    const labelSpan = trigger.querySelector('[data-part="label"]')!
    expect(labelSpan.textContent).toBe('Options · 3 selected')
    el.remove()
  })

  it('the label prop reflects the attribute (fleet label-reflects law, TKT-0069)', () => {
    const { el } = makeFormPopover()
    el.label = 'Filters'
    expect(el.getAttribute('label')).toBe('Filters')
    el.remove()
  })

  it('an empty label at construction renders an empty trigger label span (LLD §3 risk, documented)', () => {
    const { trigger } = makeFormPopover()
    const labelSpan = trigger.querySelector('[data-part="label"]')!
    expect(labelSpan.textContent).toBe('')
    trigger.closest('ui-form-popover')!.remove()
  })
})

// ── Two-way `open` — model→overlay ───────────────────────────────────────────────────────────

describe('ui-form-popover — open prop → overlay handle', () => {
  it('open=true → showPopover() called; open=false → hidePopover() called', async () => {
    const { el, panel } = makeFormPopover()
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

  it('open=true → open=false via a programmatic write DOES emit exactly one close+toggle pair (ADR-0101 — T6)', async () => {
    const { el, panel } = makeFormPopover()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    el.open = false // the agent-driven close path — SPEC-R3, the ADR-0101 erratum regression
    await whenFlushed()
    expect(callsOf(panel).hide, 'the ADR-0101 erratum: a prop-flip close must actually hide').toBe(1)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })
})

// ── Two-way `open` — overlay→model (light-dismiss) + aria-expanded ──────────────────────────────

describe('ui-form-popover — overlay→model sync + aria-expanded', () => {
  it('a platform light-dismiss flips open=false and emits close + toggle', async () => {
    const { el, panel } = makeFormPopover()
    el.open = true
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    simulateLightDismiss(panel)
    expect(el.open).toBe(false)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('aria-expanded stays in sync with open', async () => {
    const { el, trigger } = makeFormPopover()
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    el.open = true
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    el.open = false
    await whenFlushed()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })
})

// ── Mouse-driven trigger open/close (the ADR-0101 erratum precedent) ────────────────────────────

describe('ui-form-popover — mouse-click trigger open/close', () => {
  it('clicking the trigger opens the panel and sets open===true', async () => {
    const { el, trigger, panel } = makeFormPopover()
    trigger.click()
    await whenFlushed()
    expect(el.open).toBe(true)
    expect(callsOf(panel).show).toBe(1)
    el.remove()
  })

  it('clicking the trigger again closes the panel — open===false, one close+toggle pair', async () => {
    const { el, trigger, panel } = makeFormPopover()
    trigger.click()
    await whenFlushed()

    let closes = 0
    let toggles = 0
    el.addEventListener('close', () => closes++)
    el.addEventListener('toggle', () => toggles++)

    trigger.click()
    await whenFlushed()
    expect(el.open).toBe(false)
    expect(callsOf(panel).hide).toBe(1)
    expect(closes).toBe(1)
    expect(toggles).toBe(1)
    el.remove()
  })
})

// ── T9: live-apply bubbling — child change reaches a host-ancestor listener unmodified ──────────

describe('ui-form-popover — live-apply bubbling (T9, SPEC-R4)', () => {
  it('a child checkbox change event bubbles through the host unmodified; the host itself emits nothing but toggle/close', async () => {
    const { el, panel } = makeFormPopover('<input type="checkbox" name="opt" value="a">')
    const checkbox = panel.querySelector('input')!

    const hostEvents: string[] = []
    el.addEventListener('change', () => hostEvents.push('change'))
    el.addEventListener('toggle', () => hostEvents.push('toggle'))
    el.addEventListener('close', () => hostEvents.push('close'))

    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    await whenFlushed()

    expect(hostEvents).toEqual(['change']) // the host never aggregates/re-emits — bubbles through unmodified
    el.remove()
  })
})

// ── C10-class zero-residue ───────────────────────────────────────────────────────────────────

describe('ui-form-popover — zero-residue cleanup', () => {
  it('after disconnect, a light-dismiss does NOT emit close (the toggle listener is gone)', async () => {
    const { el, panel } = makeFormPopover()
    el.open = true
    await whenFlushed()

    let closes = 0
    el.addEventListener('close', () => closes++)

    el.remove()
    simulateLightDismiss(panel)
    expect(closes).toBe(0)
  })

  it('cleanup() is idempotent — safe to call multiple times without throwing', () => {
    const { el } = makeProbe()
    expect(() => {
      el.overlayHandle?.cleanup()
      el.overlayHandle?.cleanup()
    }).not.toThrow()
    el.remove()
  })
})

// ── T4: layering trip-wire (controls → dom/traits inward-only; no a2ui import) ──────────────────

describe('ui-form-popover — import layering (T4)', () => {
  it('form-popover.ts imports only from dom/traits/@agent-ui/icons — never a2ui', () => {
    const src = readFileSync(
      `${process.cwd()}/packages/agent-ui/components/src/controls/form-popover/form-popover.ts`,
      'utf8',
    )
    const importLines = src.match(/^import .+$/gm) ?? []
    for (const line of importLines) {
      expect(line, `form-popover.ts must not import a2ui: ${line}`).not.toMatch(/@agent-ui\/a2ui/)
    }
  })
})

// ── T2 / descriptor trip-wire ─────────────────────────────────────────────────────────────────

const FORM_POPOVER_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/form-popover`
const md = readFileSync(`${FORM_POPOVER_DIR}/form-popover.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['open', 'placement', 'label', 'size']

describe('form-popover.md descriptor — frontmatter parses + schema-valid (T2)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-form-popover')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('tag=ui-form-popover, tier=pattern, extends=UIElement, NOT form-associated', () => {
    expect(/^tag:\s*ui-form-popover\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('records the bindable `open` (reflected boolean) + close/toggle events (ADR-0019/ADR-0101)', () => {
    const open = parsed.attributes.find((a) => a.name === 'open')
    expect(open?.type).toBe('boolean')
    expect(open?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('toggle')
    expect(events).toContain('close')
  })

  it('validates with zero structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    const failures = validateComponentDescriptor(parsed)
    expect(failures).toEqual([])
  })
})

describe('form-popover.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UIFormPopoverElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UIFormPopoverElement.props)).toEqual([])
  })

  it('a drifted reflect FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'open' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UIFormPopoverElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.open.reflect' }),
    )
  })

  it('a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropLabel: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'label')
    expect(compareDescriptorToProps(dropLabel, UIFormPopoverElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.label' }),
    )
  })

  it('an added attribute FAILS the trip-wire (extra in descriptor)', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string', default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UIFormPopoverElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
