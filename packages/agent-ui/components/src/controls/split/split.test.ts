import { describe, it, expect } from 'vitest'
import { UISplitElement } from './split.ts'
import { UISplitPaneElement } from './split-pane.ts'
import { UIContainerElement } from '../../dom/container.ts'
import { UIFormElement } from '../../dom/form.ts'

// n1a/n1f — UISplitElement jsdom behaviour (LLD-C1/C4/C7, SPEC-R1..R5). jsdom has NO real layout
// (`getBoundingClientRect` is all-zero), so every bounds computation degrades to the unbounded [0,1]
// fallback here — real CSS-driven clamp/whole-shape/RTL-drag-px proofs are split.browser.test.ts's job
// (LLD-C7's explicit jsdom/browser split). This file proves: prop→DOM mapping; separator count = N−1;
// aria-* presence + integer shape; keyboard step → ratio + aria-valuenow (incl. RTL-logical + out-of-set
// axis coercion); the solver's sum-invariance via the element; `sizes` length-mismatch reconcile; dynamic
// panes (append/remove); mid-drag mutation abort (SPEC-R2 AC6).

class ProbeSplit extends UISplitElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
  get seps(): HTMLElement[] {
    return this.separatorElsSeam
  }
  get ratios(): number[] {
    return this.ratiosSeam
  }
}
customElements.define('ui-split-probe', ProbeSplit)

function makeSplit(paneCount: number, opts: { axis?: 'horizontal' | 'vertical'; dir?: 'rtl' } = {}): ProbeSplit {
  const el = new ProbeSplit()
  if (opts.axis) el.axis = opts.axis
  if (opts.dir) el.setAttribute('dir', opts.dir)
  for (let i = 0; i < paneCount; i++) el.append(new UISplitPaneElement())
  document.body.append(el)
  return el
}

describe('UISplitElement — upgrade + defaults', () => {
  it('upgrades to the class; axis defaults horizontal; sizes defaults undefined (uncontrolled)', () => {
    const el = document.createElement('ui-split') as UISplitElement
    document.body.append(el)
    expect(el).toBeInstanceOf(UISplitElement)
    expect(el).toBeInstanceOf(UIContainerElement)
    expect(el.axis).toBe('horizontal')
    expect(el.sizes).toBeUndefined()
    el.remove()
  })

  it('is NOT form-associated', () => {
    const el = new UISplitElement()
    expect(el).not.toBeInstanceOf(UIFormElement)
    expect('validity' in el).toBe(false)
  })

  it('static props is exactly [axis, sizes], in order', () => {
    expect(Object.keys(UISplitElement.props)).toEqual(['axis', 'sizes'])
  })

  it('exposes no host ARIA role (a pure layout container, the ui-row precedent)', () => {
    const el = makeSplit(0) as ProbeSplit
    expect(el.probeInternals.role).toBeNull()
    expect(el.getAttribute('role')).toBeNull()
    el.remove()
  })
})

describe('UISplitElement — axis reflection + coercion', () => {
  it('axis reflects to the attribute', () => {
    const el = new UISplitElement()
    document.body.append(el)
    el.axis = 'vertical'
    expect(el.getAttribute('axis')).toBe('vertical')
    el.remove()
  })

  it('an out-of-set axis attribute snaps to horizontal (the default + snap target)', () => {
    const el = new UISplitElement()
    document.body.append(el)
    el.setAttribute('axis', 'diagonal')
    expect(el.axis).toBe('horizontal')
    el.remove()
  })
})

describe('UISplitElement — separator count = N − 1 (SPEC-R1 AC1)', () => {
  it('0 panes → 0 separators, no throw', () => {
    const el = makeSplit(0)
    expect(el.seps).toHaveLength(0)
    el.remove()
  })
  it('1 pane → 0 separators, no throw', () => {
    const el = makeSplit(1)
    expect(el.seps).toHaveLength(0)
    el.remove()
  })
  it('3 panes → exactly 2 separators', () => {
    const el = makeSplit(3)
    expect(el.seps).toHaveLength(2)
    el.remove()
  })
  it('separators are inserted BETWEEN their adjacent pane pair (DOM order: pane, sep, pane, sep, pane)', () => {
    const el = makeSplit(3)
    const kids = [...el.children]
    expect(kids[0]).toBeInstanceOf(UISplitPaneElement)
    expect(kids[1]).toBe(el.seps[0])
    expect(kids[2]).toBeInstanceOf(UISplitPaneElement)
    expect(kids[3]).toBe(el.seps[1])
    expect(kids[4]).toBeInstanceOf(UISplitPaneElement)
    el.remove()
  })
})

describe('UISplitElement — separator ARIA (SPEC-R4 AC2)', () => {
  it('each separator carries role=separator, aria-orientation, aria-controls, tabindex=0, aria-label, integer aria-value*', () => {
    const el = makeSplit(3)
    for (const [i, sep] of el.seps.entries()) {
      expect(sep.getAttribute('role')).toBe('separator')
      expect(sep.getAttribute('aria-orientation')).toBe('horizontal')
      expect(sep.getAttribute('tabindex')).toBe('0')
      expect(sep.getAttribute('aria-label')).toBeTruthy()
      const controls = sep.getAttribute('aria-controls')
      expect(controls).toBe((el.children[i * 2] as UISplitPaneElement).id)
      for (const attr of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax']) {
        const v = sep.getAttribute(attr)
        expect(v, `${attr} must be present`).not.toBeNull()
        expect(Number.isInteger(Number(v)), `${attr}="${v}" must be an integer`).toBe(true)
      }
    }
    el.remove()
  })

  it('aria-orientation matches axis="vertical"', () => {
    const el = makeSplit(2, { axis: 'vertical' })
    expect(el.seps[0].getAttribute('aria-orientation')).toBe('vertical')
    el.remove()
  })

  it('3 equal panes: separator 0 reads ~50% (its own pair is panes 0+1, both equal)', () => {
    const el = makeSplit(3)
    expect(Number(el.seps[0].getAttribute('aria-valuenow'))).toBe(50)
    expect(Number(el.seps[1].getAttribute('aria-valuenow'))).toBe(50)
    el.remove()
  })
})

describe('UISplitElement — keyboard resize (SPEC-R4 AC1)', () => {
  it('ArrowRight on a horizontal separator grows the leading pane by the key step (5% fallback)', () => {
    const el = makeSplit(2)
    const before = el.ratios[0]
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.ratios[0]).toBeCloseTo(before + 0.05, 6)
    expect(el.ratios[1]).toBeCloseTo(1 - el.ratios[0], 10) // 2-pane sum invariant
    el.remove()
  })

  it('ArrowLeft shrinks the leading pane', () => {
    const el = makeSplit(2)
    const before = el.ratios[0]
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))
    expect(el.ratios[0]).toBeCloseTo(before - 0.05, 6)
    el.remove()
  })

  it('ArrowDown/ArrowUp step a VERTICAL split (Up/Down, not Left/Right)', () => {
    const el = makeSplit(2, { axis: 'vertical' })
    const before = el.ratios[0]
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(el.ratios[0]).toBeCloseTo(before + 0.05, 6)
    el.remove()
  })

  it('Home drives the leading pane to its minimum (unbounded in jsdom ⇒ 0)', () => {
    const el = makeSplit(2)
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }))
    expect(el.ratios[0]).toBeCloseTo(0, 6)
    el.remove()
  })

  it('End drives the leading pane to its maximum (unbounded in jsdom ⇒ 1)', () => {
    const el = makeSplit(2)
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    expect(el.ratios[0]).toBeCloseTo(1, 6)
    el.remove()
  })

  it('an unrecognized key is a no-op', () => {
    const el = makeSplit(2)
    const before = [...el.ratios]
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }))
    expect(el.ratios).toEqual(before)
    el.remove()
  })

  it('a keydown NOT targeting a [data-separator] is ignored', () => {
    const el = makeSplit(2)
    const before = [...el.ratios]
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.ratios).toEqual(before)
    el.remove()
  })

  it('aria-valuenow re-derives after a keyboard step (the ARIA write rides the reactive effect — awaits updateComplete, the slider-multi precedent)', async () => {
    const el = makeSplit(2)
    const before = Number(el.seps[0].getAttribute('aria-valuenow'))
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    await el.updateComplete
    const after = Number(el.seps[0].getAttribute('aria-valuenow'))
    expect(after).toBeGreaterThan(before)
    el.remove()
  })

  it('keyboard emits BOTH input and change per step (native range-input parity)', () => {
    const el = makeSplit(2)
    const events: string[] = []
    el.addEventListener('input', () => events.push('input'))
    el.addEventListener('change', () => events.push('change'))
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(events).toEqual(['input', 'change'])
    el.remove()
  })
})

describe('UISplitElement — RTL-logical keyboard mapping (SPEC-R4 AC3)', () => {
  it('under dir=rtl, ArrowRight SHRINKS the leading (inline-start) pane — not grows', () => {
    const el = makeSplit(2, { dir: 'rtl' })
    const before = el.ratios[0]
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.ratios[0]).toBeLessThan(before) // the assertion that bites under a physical (non-logical) mapping
    el.remove()
  })

  it('under dir=rtl, ArrowLeft GROWS the leading pane', () => {
    const el = makeSplit(2, { dir: 'rtl' })
    const before = el.ratios[0]
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))
    expect(el.ratios[0]).toBeGreaterThan(before)
    el.remove()
  })

  it('rtl does NOT affect a vertical split (RTL only inverts the horizontal sense)', () => {
    const el = makeSplit(2, { axis: 'vertical', dir: 'rtl' })
    const before = el.ratios[0]
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(el.ratios[0]).toBeGreaterThan(before) // unchanged sign — grows, same as LTR
    el.remove()
  })
})

describe('UISplitElement — the solver via the element: sum-invariance holds after ANY resize', () => {
  it('3 panes, multiple keyboard steps: ratios always sum to 1 (±ε)', () => {
    const el = makeSplit(3)
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'ArrowLeft']) {
      el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      expect(el.ratios.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8)
    }
    el.remove()
  })
})

describe('UISplitElement — controlled `sizes` (SPEC-R2 AC3, prop-as-source-of-truth)', () => {
  it('controlled sizes renders as given and NEVER self-mutates on resize', () => {
    const el = makeSplit(2)
    el.sizes = [0.7, 0.3]
    expect(el.ratios).toEqual([0.7, 0.3])
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.sizes).toEqual([0.7, 0.3]) // untouched — the control never writes its own controlled prop
    expect(el.ratios).toEqual([0.7, 0.3]) // the rendered layout is UNCHANGED until the consumer writes sizes back
    el.remove()
  })

  it('the proposed ratios ride the event detail so the consumer can write sizes back', () => {
    const el = makeSplit(2)
    el.sizes = [0.5, 0.5]
    let detail: number[] | undefined
    el.addEventListener('change', (e) => { detail = (e as CustomEvent<number[]>).detail })
    el.seps[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(detail).toBeDefined()
    expect(detail?.[0]).toBeCloseTo(0.55, 6)
    // the consumer writes it back — NOW the layout moves
    el.sizes = detail
    expect(el.ratios[0]).toBeCloseTo(0.55, 6)
    el.remove()
  })

  it('sizes length mismatch reconciles without throwing and warns once', () => {
    const el = makeSplit(3)
    const warn = console.warn
    let warnCount = 0
    console.warn = (): void => { warnCount++ }
    try {
      el.sizes = [0.5, 0.5] // 2 entries, 3 panes present
      expect(() => el.ratios).not.toThrow()
      expect(el.ratios).toHaveLength(3)
      expect(el.ratios.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8)
      // reading it again (same mismatch) must NOT warn a second time
      void el.ratios
      void el.ratios
      expect(warnCount).toBe(1)
    } finally {
      console.warn = warn
    }
    el.remove()
  })

  it('a single pane never throws regardless of sizes', () => {
    const el = makeSplit(1)
    el.sizes = [1, 1, 1] // absurd mismatch
    expect(() => el.ratios).not.toThrow()
    expect(el.ratios).toHaveLength(1)
    el.remove()
  })
})

describe('UISplitElement — dynamic panes (SPEC-R2 AC5)', () => {
  it('appending a pane re-derives separators (N−1) and ratios (sum 1), no throw', async () => {
    const el = makeSplit(2)
    expect(el.seps).toHaveLength(1)
    el.append(new UISplitPaneElement())
    await Promise.resolve() // MutationObserver callback is microtask-deferred
    await Promise.resolve()
    expect(el.seps).toHaveLength(2)
    expect(el.ratios).toHaveLength(3)
    expect(el.ratios.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8)
    expect(el.seps.every((s) => s.isConnected)).toBe(true) // no orphaned separator
    el.remove()
  })

  it('removing a pane re-derives separators and renormalizes the survivors, no throw', async () => {
    const el = makeSplit(3)
    const removed = el.children[0] as UISplitPaneElement
    removed.remove()
    await Promise.resolve()
    await Promise.resolve()
    expect(el.seps).toHaveLength(1)
    expect(el.ratios).toHaveLength(2)
    expect(el.ratios.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8)
    el.remove()
  })

  it('removing all panes leaves zero separators, no throw', async () => {
    const el = makeSplit(2)
    for (const pane of [...el.children]) pane.remove()
    await Promise.resolve()
    await Promise.resolve()
    expect(el.seps).toHaveLength(0)
    expect(() => el.ratios).not.toThrow()
    el.remove()
  })

  it('CONTROLLED + dynamic: appending a pane while `sizes` is set still gives fresh separators real ARIA and the new pane real geometry (component-reviewer MEDIUM fix — the render/ARIA effect must re-run in EITHER sizing mode, not just uncontrolled)', async () => {
    const el = makeSplit(2)
    el.sizes = [0.5, 0.5]
    await el.updateComplete
    el.append(new UISplitPaneElement())
    await Promise.resolve() // MutationObserver callback is microtask-deferred
    await Promise.resolve()
    await el.updateComplete // the render/ARIA effect's re-run (the #version poke)

    expect(el.seps).toHaveLength(2) // re-derived — the assertion that bites if the controlled branch never re-syncs
    for (const [i, sep] of el.seps.entries()) {
      expect(sep.getAttribute('aria-valuenow'), `separator ${i} missing aria-valuenow`).not.toBeNull()
      expect(sep.getAttribute('aria-controls'), `separator ${i} missing aria-controls`).not.toBe('')
    }
    // the new (3rd) pane: pane0, sep0, pane1, sep1, pane2 — index 4 in DOM order
    const newPane = el.children[4] as UISplitPaneElement
    expect(newPane.style.getPropertyValue('--_pane-flex'), 'new pane never got its --_pane-flex geometry seam').not.toBe('')
    // sizes itself is untouched (prop-as-source-of-truth) — only reconciled to the new pane count on read
    expect(el.sizes).toEqual([0.5, 0.5])
    el.remove()
  })
})

describe('UISplitElement — mid-drag pane mutation aborts the drag (SPEC-R2 AC6)', () => {
  it('a pane-count change during an in-flight drag stops it — a subsequent pointermove on the stale separator is ignored', async () => {
    const el = makeSplit(2)
    const sep = el.seps[0]
    sep.setPointerCapture = (): void => {} // jsdom stub (INSTRUMENT-BRIDGE precedent)

    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })

    sep.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, pointerId: 1, bubbles: true, cancelable: true }))
    sep.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, pointerId: 1, bubbles: true, cancelable: true }))
    const countBeforeMutation = inputCount

    el.append(new UISplitPaneElement()) // mid-drag mutation — the captured separator index goes stale
    await Promise.resolve()
    await Promise.resolve()

    // the OLD separator's drag listeners were removed by abortDrag() — a move on it now does nothing
    sep.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, pointerId: 1, bubbles: true, cancelable: true }))
    expect(inputCount).toBe(countBeforeMutation) // the assertion that bites if the resize continued against the stale index

    el.remove()
  })
})

describe('UISplitElement — zero residue across connect/disconnect', () => {
  it('disconnect removes the MutationObserver + separators; reconnect re-seeds cleanly', async () => {
    const el = makeSplit(3)
    expect(el.seps).toHaveLength(2)
    el.remove() // disconnect

    el.append(new UISplitPaneElement()) // mutate while disconnected — must NOT throw, no observer live
    document.body.append(el) // reconnect — re-seeds from scratch
    await Promise.resolve()
    expect(el.seps).toHaveLength(3) // 4 panes now present after the disconnected append
    el.remove()
  })

  it('a keydown after disconnect does nothing (listener removed)', () => {
    const el = makeSplit(2)
    const sep = el.seps[0]
    el.remove()
    expect(() => sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))).not.toThrow()
  })
})

describe('UISplitElement — self-define', () => {
  it('registers as ui-split, guarded against double-define', () => {
    expect(customElements.get('ui-split')).toBe(UISplitElement)
    expect(() => {
      if (!customElements.get('ui-split')) customElements.define('ui-split', UISplitElement)
    }).not.toThrow()
  })
})
