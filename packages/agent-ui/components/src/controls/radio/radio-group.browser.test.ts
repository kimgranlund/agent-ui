// radio-group.browser.test.ts — cross-engine browser smoke for ui-radio-group's OWNED layout (ADR-0103).
//
// Runs in Chromium + WebKit via vitest.browser.config.ts (the *.browser.test.ts glob). jsdom computes no
// layout, so the REAL proofs live here: a bare group stacks with a real gap (no page CSS at all), an
// `[orientation='horizontal']` group wraps into a row with the same gap, the gap responds to [density], and
// a negative control proves the child-position assertions actually depend on the shipped rule (an
// element-level `gap: 0` override collapses the very delta the positive legs measure).
//
// Imports the self-defining family barrel + the foundation/component CSS so tokens resolve in the real engine.

import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import type { UIRadioGroupElement } from '@agent-ui/components/components'
import '@agent-ui/components/components'

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

/** A group with three labeled radios (direct children — the group's own discovery contract). */
function group(attrs: Record<string, string> = {}): UIRadioGroupElement {
  const el = document.createElement('ui-radio-group') as UIRadioGroupElement
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const value of ['a', 'b', 'c']) {
    const radio = document.createElement('ui-radio')
    radio.setAttribute('value', value)
    radio.textContent = value.toUpperCase()
    el.append(radio)
  }
  return el
}

const px = (v: string): number => Number.parseFloat(v)

describe('ui-radio-group browser smoke — component-owned layout (ADR-0103)', () => {
  it('a bare group (no page CSS at all) renders flex + column + a real, non-zero gap', () => {
    const el = mount(group())
    const cs = getComputedStyle(el)
    expect(cs.display).toBe('flex')
    expect(cs.flexDirection).toBe('column')
    expect(px(cs.rowGap)).toBeGreaterThan(0)
  })

  it('child-position anti-vacuous: the second radio sits BELOW the first by ≥ the computed gap (vertical stack)', () => {
    const el = mount(group())
    const [r1, r2] = [...el.children] as HTMLElement[]
    const rect1 = r1.getBoundingClientRect()
    const rect2 = r2.getBoundingClientRect()
    const gap = px(getComputedStyle(el).rowGap)
    expect(rect2.top, 'the second radio did not move below the first at all').toBeGreaterThan(rect1.top)
    expect(rect2.top - rect1.bottom, 'the visible gap between radios is smaller than the computed CSS gap').toBeGreaterThanOrEqual(gap - 1)
  })

  it("[orientation='horizontal'] renders one wrapping ROW — same gap, cross-axis centred", () => {
    const el = mount(group({ orientation: 'horizontal' }))
    const cs = getComputedStyle(el)
    expect(cs.flexDirection).toBe('row')
    expect(cs.flexWrap).toBe('wrap')
    expect(cs.alignItems).toBe('center')

    const [r1, r2] = [...el.children] as HTMLElement[]
    const rect1 = r1.getBoundingClientRect()
    const rect2 = r2.getBoundingClientRect()
    const gap = px(cs.columnGap)
    expect(gap, 'horizontal orientation reads a real gap').toBeGreaterThan(0)
    // same row (top-aligned within rounding) and separated left→right by ≥ the gap.
    expect(Math.abs(rect2.top - rect1.top)).toBeLessThan(2)
    expect(rect2.left - rect1.right).toBeGreaterThanOrEqual(gap - 1)
  })

  it('the gap rides --ui-space-sm and responds to a subtree [density] (anti-vacuous)', () => {
    const wrap = document.createElement('div')
    document.body.append(wrap)
    mounted.push(wrap)
    const el = group()
    wrap.append(el)

    const gapPx = (): number => px(getComputedStyle(el).rowGap)
    const base = gapPx() // --ui-space-sm @ density 1 = 8px
    expect(base).toBeGreaterThan(0)

    wrap.setAttribute('density', 'compact') // --ui-density → 0.5
    expect(gapPx()).toBeCloseTo(base / 2, 1)

    wrap.setAttribute('density', 'spacious') // --ui-density → 1.5
    expect(gapPx()).toBeCloseTo(base * 1.5, 1)
  })

  it('one Tab stop, real focus (ADR-0121 amendment regression guard): exactly one ui-radio is Tab-reachable, not three', async () => {
    // Previously UNTESTED in a real engine (jsdom's opposite child-before-parent connectedCallback order
    // masked this) — ui-radio extends UIIndicatorElement, which runs the SAME `tabbable` trait ui-button
    // does; the group's own rovingFocus() call and each radio's own tabbable effect raced exactly the way
    // toolbar.ts's did, silently breaking "one Tab stop" for a radio group in every real browser. The
    // roving-marker contract (traits/roving-focus.ts ↔ traits/tabbable.ts) fixes both call sites at once —
    // this pins the group side of that fix stays correct.
    const el = mount(group())
    const [r1, r2, r3] = [...el.children] as HTMLElement[]
    expect(r1.tabIndex, 'the first radio is not the roving item').toBe(0)
    expect(r2.tabIndex, 'a second radio unexpectedly holds a tab stop too').toBe(-1)
    expect(r3.tabIndex, 'a third radio unexpectedly holds a tab stop too').toBe(-1)

    r1.focus()
    await userEvent.tab()
    expect(document.activeElement, 'Tab did not leave the group as one stop').not.toBe(r2)
    expect(document.activeElement, 'Tab did not leave the group as one stop').not.toBe(r3)
  })

  it('NEGATIVE control: forcing the gap to 0 collapses the very delta the positive legs measure', () => {
    // Proves the anti-vacuous position assertions have teeth: an element-level override that zeroes the
    // group's OWN gap token reproduces the pre-ADR-0103 mash (radios touching, zero visible separation) —
    // exactly what a removed component rule would also render.
    const el = mount(group())
    el.style.setProperty('--ui-radio-group-gap', '0px')
    const [r1, r2] = [...el.children] as HTMLElement[]
    const rect1 = r1.getBoundingClientRect()
    const rect2 = r2.getBoundingClientRect()
    expect(px(getComputedStyle(el).rowGap)).toBe(0)
    expect(rect2.top - rect1.bottom, 'a zeroed gap must collapse the visible separation to ~0').toBeLessThan(1)
  })
})

// ADR-0051 — the user-invalid leg. The group carries no visual surface of its own (the file header) —
// the danger repaint reaches into each ui-radio CHILD's own ::before ring, so this proof focuses/blurs a
// RADIO (the group's blur listener is capture-phase, catching a descendant's blur) and reads the CHILD's
// computed ::before border. jsdom has no CustomStateSet, so :state(user-invalid) matching is browser-only.
describe('ui-radio-group — user-invalid leg (ADR-0051)', () => {
  it('a required, unselected group arms :state(user-invalid) on the GROUP + repaints each ui-radio child\'s ::before border, only AFTER focus+blur', async () => {
    const el = mount(group({ required: '' }))
    const [r1] = [...el.children] as HTMLElement[]

    expect(el.matches(':state(user-invalid)'), 'user-invalid must not flash before any interaction').toBe(false)
    const idleBorder = getComputedStyle(r1!, '::before').borderColor

    r1!.focus()
    r1!.blur()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    expect(el.matches(':state(user-invalid)'), ':state(user-invalid) was not armed on the group after a child blur').toBe(true)
    const invalidBorder = getComputedStyle(r1!, '::before').borderColor
    expect(invalidBorder, "a ui-radio child's ::before border-color did not repaint under the group's :state(user-invalid)").not.toBe(idleBorder)

    // RECOVERY: selecting a radio clears the constraint.
    await userEvent.click(r1!)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(el.matches(':state(user-invalid)'), 'user-invalid persists after a radio is selected').toBe(false)
  })
})
