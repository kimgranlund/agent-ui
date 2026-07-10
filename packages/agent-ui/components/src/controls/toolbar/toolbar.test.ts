import { describe, it, expect, afterEach, vi } from 'vitest'
import { UIToolbarElement } from './toolbar.ts'
import { UIContainerElement, UIFormElement } from '../../dom/index.ts'

// A stray element left in the document by an earlier FAILING test (its own `el.remove()` cleanup never ran)
// would otherwise leak into later tests (extra roving hosts, a wrong document.activeElement) — the
// roving-focus.test.ts precedent (traits/roving-focus.test.ts:72).
afterEach(() => {
  document.body.innerHTML = ''
})

// toolbar.lld.md LLD-C8 — jsdom behaviour suite for ui-toolbar (ADR-0121). Covers: props reflect/fail-open
// (SPEC-R2), ARIA via internals only (SPEC-R3), roving-focus tabindex/keydown behaviour (SPEC-R4 — the LOGICAL
// half; the REAL rendered focus-order + whole-shape proof is browser-only, LLD-C9/toolbar.browser.test.ts), the
// no-event negative control (SPEC-R5), and zero-residue connect/disconnect (LLD §6). Native `<button>` items are
// used throughout (one ITEM_SELECTOR member, SPEC §2 "Item" definition) so this suite carries no cross-control
// dependency on ui-button.

class ProbeToolbar extends UIToolbarElement {
  /** Re-expose the protected internals so probes can read role/ariaOrientation/ariaLabel. */
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-toolbar-probe', ProbeToolbar)

function make(): ProbeToolbar {
  return new ProbeToolbar()
}

function button(label: string, opts: { disabled?: boolean; ariaDisabled?: boolean } = {}): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  if (opts.disabled) b.disabled = true
  if (opts.ariaDisabled) b.setAttribute('aria-disabled', 'true')
  return b
}

const kd = (target: Element, key: string): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  target.dispatchEvent(e)
  return e
}

// ── upgrade + typed prop surface (SPEC-R1/R2) ───────────────────────────────────────────────────────────────

describe('UIToolbarElement — upgrade + typed props (SPEC-R1/R2)', () => {
  it('self-defines as ui-toolbar, guarded against double-define', () => {
    expect(customElements.get('ui-toolbar')).toBe(UIToolbarElement)
    expect(() => {
      if (!customElements.get('ui-toolbar')) customElements.define('ui-toolbar', UIToolbarElement)
    }).not.toThrow()
  })

  it('is a UIContainerElement subclass, NOT a UIFormElement (non-form family, face.formAssociated=false)', () => {
    const el = make()
    expect(el).toBeInstanceOf(UIContainerElement)
    expect(el).not.toBeInstanceOf(UIFormElement)
  })

  it('a fresh instance reads every default: elevation/brightness=0, orientation=horizontal, align=center, justify=start, gap=sm, overflow=wrap, label=""', () => {
    const el = make()
    expect(el.elevation).toBe('0')
    expect(el.brightness).toBe('0')
    expect(el.orientation).toBe('horizontal')
    expect(el.align).toBe('center') // NOTE differs from ui-row's 'start' — the bar look
    expect(el.justify).toBe('start')
    expect(el.gap).toBe('sm') // NOTE differs from ui-row's 'none' — toolbars are tight
    expect(el.overflow).toBe('wrap')
    expect(el.label).toBe('')
  })

  it('declares NO size/density/wrap/reflow/posture prop', () => {
    const props = UIToolbarElement.props as Record<string, unknown>
    for (const banned of ['size', 'density', 'wrap', 'reflow', 'posture']) expect(banned in props).toBe(false)
  })

  it('every enumerated prop round-trips property → attribute and back', () => {
    const el = make()
    document.body.append(el)
    el.orientation = 'vertical'
    expect(el.getAttribute('orientation')).toBe('vertical')
    el.setAttribute('orientation', 'horizontal')
    expect(el.orientation).toBe('horizontal')

    el.align = 'end'
    expect(el.getAttribute('align')).toBe('end')
    el.justify = 'between'
    expect(el.getAttribute('justify')).toBe('between')
    el.gap = 'lg'
    expect(el.getAttribute('gap')).toBe('lg')
    el.overflow = 'scroll'
    expect(el.getAttribute('overflow')).toBe('scroll')
    el.label = 'Format selection'
    expect(el.getAttribute('label')).toBe('Format selection')
    el.remove()
  })

  it('an out-of-vocabulary enum value fails open to that prop\'s values[0] (SPEC-R2 AC3, never a crash)', () => {
    // The enum codec's fail-open target is `values[0]` (props.ts enumType.from), NOT necessarily the class's
    // unset-instance `default` — orientation/overflow/justify happen to declare default === values[0], but
    // align/gap deliberately do NOT (LLD §3 note: align defaults 'center', the bar look, while ALIGNS leads
    // with 'start'; gap defaults 'sm', while GAPS leads with 'none') — so their fail-open targets are 'start'
    // and 'none' respectively, distinct from their unset default.
    const el = make()
    document.body.append(el)
    el.setAttribute('orientation', 'diagonal')
    expect(el.orientation).toBe('horizontal')
    el.setAttribute('overflow', 'spillover')
    expect(el.overflow).toBe('wrap')
    el.setAttribute('justify', 'sideways')
    expect(el.justify).toBe('start')
    el.setAttribute('align', 'middle')
    expect(el.align).toBe('start') // values[0] of ALIGNS — NOT the class default 'center'
    el.setAttribute('gap', 'huge')
    expect(el.gap).toBe('none') // values[0] of GAPS — NOT the class default 'sm'
    el.remove()
  })

  it('the UNSET (never-attributed) instance default is still center/sm — distinct from the fail-open snap target above', () => {
    const el = make()
    expect(el.align).toBe('center')
    expect(el.gap).toBe('sm')
  })
})

// ── ARIA via internals only (SPEC-R3) ───────────────────────────────────────────────────────────────────────

describe('UIToolbarElement — role=toolbar + ariaOrientation/ariaLabel via ElementInternals (SPEC-R3)', () => {
  it('internals.role is "toolbar"; the host carries no role/aria-* attribute', () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('toolbar')
    expect(el.getAttribute('role')).toBeNull()
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('ariaOrientation is null on the horizontal default; "vertical" only when orientation=vertical', async () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.ariaOrientation).toBeNull()
    el.orientation = 'vertical'
    await el.updateComplete
    expect(el.probeInternals.ariaOrientation).toBe('vertical')
    el.orientation = 'horizontal'
    await el.updateComplete
    expect(el.probeInternals.ariaOrientation).toBeNull()
    el.remove()
  })

  it('ariaLabel is null when label is unset; a non-empty label writes it; clearing label clears it', async () => {
    const el = make()
    document.body.append(el)
    expect(el.probeInternals.ariaLabel).toBeNull()
    el.label = 'Document actions'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Document actions')
    el.label = ''
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBeNull()
    el.remove()
  })
})

// ── roving focus — the logical half (SPEC-R4; the real-render/cross-engine half is browser-only) ──────────────

describe('UIToolbarElement — roving tabindex + item discovery (SPEC-R4)', () => {
  it('exactly one enabled item gets tabindex=0 on connect (the first non-disabled item); the rest -1', () => {
    const el = make()
    const [b0, b1, b2] = [button('One'), button('Two'), button('Three')]
    el.append(b0, b1, b2)
    document.body.append(el)
    expect(b0.tabIndex).toBe(0)
    expect(b1.tabIndex).toBe(-1)
    expect(b2.tabIndex).toBe(-1)
    el.remove()
  })

  it('a disabled middle item is skipped by the initial roving index and by ArrowRight', () => {
    const el = make()
    const [b0, b1, b2] = [button('One'), button('Two', { disabled: true }), button('Three')]
    el.append(b0, b1, b2)
    document.body.append(el)
    kd(el, 'ArrowRight')
    expect(document.activeElement).toBe(b2) // skips the disabled b1
    expect(b2.tabIndex).toBe(0)
    el.remove()
  })

  it('aria-disabled="true" is excluded the same as the disabled attribute (#items() pre-filters it out of the roving set entirely)', () => {
    const el = make()
    const [b0, b1] = [button('One', { ariaDisabled: true }), button('Two')]
    el.append(b0, b1)
    document.body.append(el)
    expect(b1.tabIndex).toBe(0) // b0 excluded — b1 is the first (and only) roving-eligible item
    // b0 is excluded from #items() entirely (LLD-C4), so the trait never assigns it a tabindex at all — its
    // tabIndex is whatever the platform gives an aria-disabled-but-not-natively-disabled button (still
    // click/Tab-focusable per ARIA APG's aria-disabled convention — that is the PLATFORM's concern, not
    // toolbar.ts's). What toolbar.ts DOES own: b0 is never a roving-focus target.
    b1.focus()
    kd(el, 'ArrowRight') // only one eligible item — no further movement, and b0 is never reached
    expect(document.activeElement).toBe(b1)
    el.remove()
  })

  it('items nested inside a ui-row-shaped grouping element still participate (descendant query, SPEC-R4 AC3)', () => {
    const el = make()
    const group = document.createElement('ui-row')
    const [b0, b1] = [button('One'), button('Two')]
    group.append(b0, b1)
    el.append(group)
    document.body.append(el)
    expect(b0.tabIndex).toBe(0)
    expect(b1.tabIndex).toBe(-1)
    kd(el, 'ArrowRight')
    expect(document.activeElement).toBe(b1)
    el.remove()
  })

  it('ArrowRight/ArrowLeft move focus horizontally and STOP at the ends (no wrap, unlike ui-tabs)', () => {
    const el = make()
    const [b0, b1, b2] = [button('One'), button('Two'), button('Three')]
    el.append(b0, b1, b2)
    document.body.append(el)

    kd(el, 'ArrowLeft') // already at the start — stays (no wrap to the last)
    expect(document.activeElement).not.toBe(b2)
    expect(b0.tabIndex).toBe(0)

    kd(el, 'ArrowRight')
    expect(document.activeElement).toBe(b1)
    kd(el, 'ArrowRight')
    expect(document.activeElement).toBe(b2)
    kd(el, 'ArrowRight') // already at the end — stays (no wrap to the first)
    expect(document.activeElement).toBe(b2)
    expect(b2.tabIndex).toBe(0)

    kd(el, 'ArrowLeft')
    expect(document.activeElement).toBe(b1)
    el.remove()
  })

  it('Home/End jump to the first/last non-disabled item', () => {
    const el = make()
    const [b0, b1, b2] = [button('One'), button('Two'), button('Three')]
    el.append(b0, b1, b2)
    document.body.append(el)
    kd(el, 'End')
    expect(document.activeElement).toBe(b2)
    kd(el, 'Home')
    expect(document.activeElement).toBe(b0)
    el.remove()
  })

  it('ArrowDown/ArrowUp drive orientation=vertical; ArrowLeft/Right are no-ops on that axis', () => {
    const el = make()
    el.orientation = 'vertical'
    const [b0, b1] = [button('One'), button('Two')]
    el.append(b0, b1)
    document.body.append(el)
    kd(el, 'ArrowRight') // wrong axis — no movement
    expect(document.activeElement).not.toBe(b1)
    kd(el, 'ArrowDown')
    expect(document.activeElement).toBe(b1)
    el.remove()
  })

  it('orientation is resolved ONCE at connect — a post-connect flip does not re-arm the roving key-axis until reconnect', () => {
    const el = make()
    const [b0, b1] = [button('One'), button('Two')]
    el.append(b0, b1)
    document.body.append(el) // connect-resolves horizontal (the default)
    el.orientation = 'vertical' // reflects live (CSS flips), but the roving trait was already invoked with 'horizontal'
    kd(el, 'ArrowDown') // the connect-resolved axis is horizontal — vertical keys are no-ops
    expect(document.activeElement).not.toBe(b1)
    kd(el, 'ArrowRight') // the horizontal axis still drives the trait
    expect(document.activeElement).toBe(b1)
    el.remove()
  })

  it('an empty toolbar (#items() = []) — the trait no-ops, no throw', () => {
    const el = make()
    expect(() => document.body.append(el)).not.toThrow()
    expect(() => kd(el, 'ArrowRight')).not.toThrow()
    el.remove()
  })

  it('an all-disabled item set is a valid, focus-inert bar — the trait moves focus to neither item', () => {
    // Both items are excluded from #items() entirely (LLD-C4's disabled filter), so the trait's own item list
    // is empty at init AND on every keydown re-read — no item is ever a roving target (LLD §6: "a degenerate
    // but valid state"). (Whether a disabled native <button>'s OWN tabIndex reads 0 or -1 is a platform/engine
    // question the toolbar does not own — jsdom and a real browser disagree here; the toolbar-owned contract
    // is that arrow navigation never lands on either item, proven directly below.)
    const el = make()
    const [b0, b1] = [button('One', { disabled: true }), button('Two', { disabled: true })]
    el.append(b0, b1)
    document.body.append(el)
    kd(el, 'ArrowRight')
    expect(document.activeElement).not.toBe(b0)
    expect(document.activeElement).not.toBe(b1)
    el.remove()
  })
})

// ── no events, no value (SPEC-R5) ───────────────────────────────────────────────────────────────────────────

describe('UIToolbarElement — no events, no value (the negative control, SPEC-R5)', () => {
  it('a roving key move emits NO change/input/select/open/close/toggle from the host', () => {
    const el = make()
    const [b0, b1] = [button('One'), button('Two')]
    el.append(b0, b1)
    document.body.append(el)
    const seen: string[] = []
    for (const type of ['change', 'input', 'select', 'open', 'close', 'toggle']) {
      el.addEventListener(type, () => seen.push(type))
    }
    kd(el, 'ArrowRight')
    kd(el, 'Home')
    kd(el, 'End')
    expect(seen).toEqual([])
    el.remove()
  })

  it('is not form-associated — no form/validity/willValidate surface', () => {
    const el = make()
    expect('form' in el).toBe(false)
    expect('validity' in el).toBe(false)
    expect('willValidate' in el).toBe(false)
  })
})

// ── zero residue (connect / disconnect / reconnect) ─────────────────────────────────────────────────────────

describe('UIToolbarElement — zero residue across connect/disconnect (LLD §6)', () => {
  it('disconnect removes the roving listener; reconnect re-arms exactly once (no duplicate moves)', () => {
    const el = make()
    const [b0, b1, b2] = [button('One'), button('Two'), button('Three')]
    el.append(b0, b1, b2)
    document.body.append(el)
    kd(el, 'ArrowRight')
    expect(document.activeElement).toBe(b1)

    el.remove() // disconnect → the connection AbortSignal releases the trait's keydown listener

    document.body.append(el) // reconnect → connected() re-runs, re-arming the trait fresh
    b0.focus()
    // A stale (un-released) listener alongside the fresh one would both independently compute the SAME next
    // index from their own closure state and both call `list[next].focus()` — landing on the SAME element
    // either way (a single activeElement check cannot tell 1 listener from 2 stacked ones). Count the actual
    // `.focus()` invocations on the target instead: exactly one call means exactly one live listener.
    const focusSpy = vi.spyOn(b1, 'focus')
    kd(el, 'ArrowRight')
    expect(document.activeElement).toBe(b1)
    expect(focusSpy, 'a stale pre-disconnect listener survived reconnect (stacked, not re-armed)').toHaveBeenCalledTimes(1)
    el.remove()
  })

  it('ARIA effects re-run on reconnect with the current prop values', async () => {
    const el = make()
    el.label = 'Reconnected bar'
    document.body.append(el)
    expect(el.probeInternals.ariaLabel).toBe('Reconnected bar')

    el.remove()
    document.body.append(el)
    expect(el.probeInternals.ariaLabel).toBe('Reconnected bar')
    el.remove()
  })
})
