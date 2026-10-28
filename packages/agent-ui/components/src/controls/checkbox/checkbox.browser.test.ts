import { describe, it, expect } from 'vitest'
import { userEvent } from 'vitest/browser'

// S1 browser smoke — ui-checkbox (decomp S1 · ADR-0041 · ADR-0042).
// Probes (AC1–AC4 from ADR-0041): the box = --md-sys-compact-{size} per [size]×[scale]; the checkmark
// renders (::after has a non-zero computed dimension when checked); forced-colors (manual — the Playwright
// browser does not emulate forced-colors in headless runs, so that branch is verified by reading only);
// C10 connect→disconnect zero-residue (one toggle per click, no listener stacking).
//
// These imports are direct (not through the barrel) because the retired component-styles CSS barrel (ADR-0233) is the
// host's integration slice — it gains the checkbox @import at barrel-wiring time. The foundation CSS
// (tokens + dimensions) is loaded through the shared package barrel so the --md-sys-color-* / --md-sys-compact-*
// token chain is in place before the control sheet resolves.

import '@agent-ui/components/foundation-styles.css' // tokens (--md-sys-color-*) + dimensions (--md-sys-compact-*)
import './checkbox.css'                             // the control stylesheet (direct — pre-barrel)
import './checkbox.ts'                             // self-define (registers ui-checkbox)
import '../text-field/text-field.css'               // the field the label type is measured against (T-0197)
import '../text-field/text-field.ts'
import { glyphBox } from '../../../../../../scripts/lib/foundations-rules.mjs' // the glyph box n + 6 (T-0374)
import { resolve, rootResolve, parts } from '../../../../../../scripts/lib/foundations-model.mjs' // the model the sheet mirrors

const num = (v: string): number => Number.parseFloat(v)
// The page root register (no data-tier region): product / md, n 6 / 8 / 10 for size sm / md / lg.
const root = (size: 'sm' | 'md' | 'lg') => rootResolve(size)

describe('ui-checkbox browser smoke (S1 AC1–AC4)', () => {
  it('AC1 default: ::before box = the root md checkbox part (16px, --md-sys-compact-md, the derived compact ramp)', () => {
    const el = document.createElement('ui-checkbox')
    document.body.append(el)
    const cs = getComputedStyle(el, '::before')
    // --md-sys-compact-md = 2n at the root register on the derived ramp (ADR-0041 clause 2, ADR-0245)
    expect(Number.parseFloat(cs.width)).toBe(parts(root('md')).checkbox)
    expect(Number.parseFloat(cs.height)).toBe(parts(root('md')).checkbox)
    el.remove()
  })

  it('AC1 [size=sm] → 12px box; [size=lg] → 20px box (the compact ramp at the root)', () => {
    const sm = document.createElement('ui-checkbox')
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    expect(Number.parseFloat(getComputedStyle(sm, '::before').width)).toBe(parts(root('sm')).checkbox) // --md-sys-compact-sm
    sm.remove()

    const lg = document.createElement('ui-checkbox')
    lg.setAttribute('size', 'lg')
    document.body.append(lg)
    expect(Number.parseFloat(getComputedStyle(lg, '::before').width)).toBe(parts(root('lg')).checkbox) // --md-sys-compact-lg
    lg.remove()
  })

  it('checked: ::after glyph is visible — has a positive computed width (checkmark renders)', () => {
    const el = document.createElement('ui-checkbox')
    el.setAttribute('checked', '') // boolean attribute → checked=true
    document.body.append(el)
    // ::after with clip-path checkmark: inline-size = 60% of 16px = 9.6px
    const afterW = Number.parseFloat(getComputedStyle(el, '::after').width)
    expect(afterW).toBeGreaterThan(0)
    el.remove()
  })

  it('unchecked: ::after glyph is invisible — zero or no computed width (no checkmark)', () => {
    const el = document.createElement('ui-checkbox')
    document.body.append(el)
    // unchecked ::after has no background-color, no inline-size declared → width resolves to 0 or auto
    const afterW = Number.parseFloat(getComputedStyle(el, '::after').width)
    expect(afterW).toBe(0)
    el.remove()
  })

  it('outside any region the marks keep today\'s shape: radius box/5, check 60% x 55% inset 20%, dash 2px', () => {
    const legacy = document.createElement('div')
    legacy.setAttribute('data-foundations', 'legacy') // ADR-0245 cl.10e: the opt-out renders today's geometry
    document.body.append(legacy)
    const el = document.createElement('ui-checkbox') as HTMLElement & { indeterminate: boolean }
    el.setAttribute('checked', '')
    legacy.append(el)
    expect(num(getComputedStyle(el, '::before').borderTopLeftRadius)).toBeCloseTo(3.2, 1)
    const check = getComputedStyle(el, '::after')
    expect([num(check.width), num(check.height), num(check.left)].map((v) => Number(v.toFixed(1)))).toEqual([9.6, 8.8, 3.2])
    el.remove()

    const dash = document.createElement('ui-checkbox') as HTMLElement & { indeterminate: boolean }
    dash.indeterminate = true
    legacy.append(dash)
    const d = getComputedStyle(dash, '::after')
    expect([num(d.width), num(d.height), num(d.borderTopLeftRadius)].map((v) => Number(v.toFixed(1)))).toEqual([9.6, 2, 1])
    dash.remove()
    legacy.remove()
  })

  it('C10 connect→disconnect zero-residue: reconnect produces exactly one toggle per click', () => {
    const el = document.createElement('ui-checkbox')
    const cb = el as HTMLElement & { checked: boolean }
    document.body.append(el)

    // click while connected → toggle (false → true)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.getAttribute('checked')).toBe('') // checked reflects to attribute

    el.remove() // disconnect
    document.body.append(el) // reconnect

    // A single click should produce exactly one toggle (true → false), not two (no stacked listeners)
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.getAttribute('checked')).toBeNull() // one toggle: true → false
    expect(cb.checked).toBe(false)
    el.remove()
  })
})

// ADR-0051 — the user-invalid leg: jsdom has no CustomStateSet, so :state(user-invalid) matching and the
// real border-color repaint can only be proven here (the text-field-states.browser.test.ts precedent).
describe('ui-checkbox — user-invalid leg (ADR-0051)', () => {
  it('a required, unchecked checkbox arms :state(user-invalid) + repaints the ::before border only AFTER focus+blur', async () => {
    const el = document.createElement('ui-checkbox')
    el.setAttribute('required', '')
    document.body.append(el)

    // BEFORE interaction: no first paint flash (the trackUserInvalid timing suppression).
    expect(el.matches(':state(user-invalid)'), 'user-invalid must not flash before any interaction').toBe(false)
    const idleBorder = getComputedStyle(el, '::before').borderColor

    // Focus + blur WITHOUT a click (a click would toggle checked, curing the valueMissing state
    // this probe needs to stay armed) — real DOM focus()/blur() dispatch real focus/blur events in a
    // real engine (unlike jsdom), so this exercises the same capture-phase 'blur' listener a real user
    // tabbing past the checkbox would.
    el.focus()
    el.blur()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) // let the effect flush

    expect(el.matches(':state(user-invalid)'), ':state(user-invalid) was not armed on blur').toBe(true)
    const invalidBorder = getComputedStyle(el, '::before').borderColor
    expect(invalidBorder, 'the ::before border-color did not repaint under :state(user-invalid)').not.toBe(idleBorder)

    // RECOVERY: checking the box clears the constraint; the danger border is gated off again.
    await userEvent.click(el)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(el.matches(':state(user-invalid)'), 'user-invalid persists after the box is checked').toBe(false)
    el.remove()
  })
})

// TKT-0047 — checkbox was the one Indicator-class control with zero hover feedback (switch/radio both
// repaint on hover). Real border-color repaint can only be proven here (the user-invalid leg above's own
// precedent for this same reason).
describe('ui-checkbox — hover (TKT-0047)', () => {
  it('the ::before border repaints toward the checked colour on real pointer hover', async () => {
    const el = document.createElement('ui-checkbox')
    document.body.append(el)
    const idleBorder = getComputedStyle(el, '::before').borderColor

    await userEvent.hover(el)
    const hoverBorder = getComputedStyle(el, '::before').borderColor
    expect(hoverBorder, 'the ::before border-color did not repaint on hover').not.toBe(idleBorder)

    await userEvent.unhover(el)
    el.remove()
  })

  // component-reviewer MINOR fix: the hover rule was originally authored AFTER the user-invalid rule at
  // equal specificity (0,2,1), so source order let hover mask the danger border — hovering a required,
  // unchecked checkbox that had already been focus+blurred would hide the invalid signal at the exact
  // moment the user is about to interact. Fixed by moving the hover rule ABOVE user-invalid in the
  // stylesheet; this pins the fix as a real, provable behavior, not just a reordered comment.
  it('hover does NOT mask the user-invalid danger border (the danger colour always wins)', async () => {
    const el = document.createElement('ui-checkbox')
    el.setAttribute('required', '')
    document.body.append(el)

    el.focus()
    el.blur()
    // `border-color` transitions over `--md-sys-motion-duration-fast` (300ms, dimensions.css) — a couple of animation
    // frames (~33ms) is enough to observe a value merely CHANGED (the existing user-invalid-arms test
    // above only needs that), but this test needs the SETTLED end-state colour for an exact equality
    // comparison, so it waits past the real transition duration on both measurements below.
    await new Promise((r) => setTimeout(r, 350))
    expect(el.matches(':state(user-invalid)'), 'user-invalid was not armed on blur').toBe(true)
    const invalidBorder = getComputedStyle(el, '::before').borderColor

    await userEvent.hover(el)
    await new Promise((r) => setTimeout(r, 350)) // let the border-color transition fully settle
    const invalidHoverBorder = getComputedStyle(el, '::before').borderColor
    expect(invalidHoverBorder, 'hovering a user-invalid checkbox must NOT repaint away from the danger colour').toBe(
      invalidBorder,
    )

    await userEvent.unhover(el)
    el.remove()
  })
})


// -- ADR-0223 (Fill by Default, slice 2 -- action/selection): the two-posture acceptance leg, the
//    generalized ADR-0021 smoke (the text-field pilot's shape): FILL -- a bare host in block flow
//    stretches to the container's inline size (the container IS the floor); [inline] -- the host hugs
//    its content and sits BELOW the container. No clause 3(b) content floor exists on this control to relocate.
describe('ui-checkbox -- ADR-0223 two postures (fill default / [inline] hug, both engines)', () => {
  it('bare host offsetWidth ~= container inline size (fill); [inline] host hugs below the container', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '640px' // a wide BLOCK container -- wider than any hug resolution
    wrap.innerHTML = `<ui-checkbox>Accept terms</ui-checkbox>`
    document.body.append(wrap)
    const host = wrap.querySelector('ui-checkbox') as HTMLElement & { updateComplete?: Promise<unknown> }
    await host.updateComplete
    // FILL (the default): block-level -- the host stretches to the container.
    const containerWidth = wrap.getBoundingClientRect().width
    expect(host.offsetWidth, 'the bare host did not FILL its block container (ADR-0223 cl.1)').toBeCloseTo(containerWidth, 0)
    expect(getComputedStyle(host).display, 'the default host is not block-level').toBe('flex')
    // HUG (the ONE opt-out): [inline] flips display level AND posture -- content-sized, below the container.
    host.setAttribute('inline', '')
    const hugged = host.offsetWidth
    expect(hugged, 'the [inline] host collapsed to nothing').toBeGreaterThan(0)
    expect(hugged, 'the [inline] host did not HUG -- it still fills the container').toBeLessThan(containerWidth)
    expect(getComputedStyle(host).display, 'the [inline] host is not inline-level').toBe('inline-flex')
    wrap.remove()
  })
})

// ADR-0245 clauses 3 and 4: inside an opt-in region the box is max(2n, n + 6), the radius n/2, and the check and dash
// span the n + 6 glyph box (T-0374), centred in the box; the dash is max(1.5px, c/2) tall. Against foundations-model.mjs resolve().
// T-0197: the option label takes the control type role, so it reads at the field text size, not the 1px larger body.
describe('ui-checkbox label type (T-0197)', () => {
  it('option text is the field text (T-0197)', () => {
    for (const region of [{ tier: 'widget', scale: 'md' }, null]) {
      const wrap = document.createElement('div')
      if (region) {
        wrap.setAttribute('data-tier', region.tier)
        wrap.setAttribute('data-scale', region.scale)
      }
      const field = document.createElement('ui-text-field')
      const option = document.createElement('ui-checkbox')
      option.textContent = 'Window seat'
      wrap.append(field, option)
      document.body.append(wrap)
      try {
        expect(getComputedStyle(option).fontSize, region ? 'widget md' : 'root').toBe(getComputedStyle(field).fontSize)
      } finally {
        wrap.remove()
      }
    }
  })
})

describe('ui-checkbox geometry inside an opt-in data-tier region (ADR-0245)', () => {
  const mountIn = (scale: string, size: string, props: Record<string, boolean> = {}): { wrap: HTMLElement; el: HTMLElement } => {
    const wrap = document.createElement('div')
    wrap.setAttribute('data-tier', 'product')
    wrap.setAttribute('data-scale', scale)
    const el = document.createElement('ui-checkbox') as HTMLElement & { indeterminate: boolean }
    el.setAttribute('size', size)
    if (props.checked) el.setAttribute('checked', '')
    if (props.indeterminate) el.indeterminate = true
    wrap.append(el)
    document.body.append(wrap)
    return { wrap, el }
  }

  for (const scale of ['sm', 'md'] as const) {
    for (const size of ['sm', 'md', 'lg'] as const) {
      it(`product / ${scale} / ${size}: box max(2n, n + 6), radius ceil(n/2), check n + 6 centred`, () => {
        const r = resolve('product', scale, size)
        const side = Math.max(r.iconBox, glyphBox(r))
        const { wrap, el } = mountIn(scale, size, { checked: true })
        const box = getComputedStyle(el, '::before')
        expect(num(box.width)).toBe(side)
        expect(num(box.height)).toBe(side)
        expect(num(box.borderTopLeftRadius)).toBeCloseTo(r.checkboxRadius, 1) // ceil(n/2), the chip radius (ADR-0245 Amendment 4)
        const check = getComputedStyle(el, '::after')
        expect(num(check.width)).toBeCloseTo(glyphBox(r), 1)
        expect(num(check.height)).toBeCloseTo((glyphBox(r) * 11) / 12, 1)
        expect(num(check.left)).toBeCloseTo((side - glyphBox(r)) / 2, 1)
        wrap.remove()
      })

      it(`product / ${scale} / ${size}: dash n + 6 wide, max(1.5px, c/2) tall, centred`, () => {
        const r = resolve('product', scale, size)
        const side = Math.max(r.iconBox, glyphBox(r))
        const { wrap, el } = mountIn(scale, size, { indeterminate: true })
        const dash = getComputedStyle(el, '::after')
        expect(num(dash.width)).toBeCloseTo(glyphBox(r), 1)
        expect(num(dash.height)).toBeCloseTo(Math.max(1.5, r.c / 2), 1)
        expect(num(dash.left)).toBeCloseTo((side - glyphBox(r)) / 2, 1)
        wrap.remove()
      })
    }
  }

  // T-0374: the mark stays n + 6 and the box grows to hold it (the skill's wrapper never shrinks the artwork), so
  // on every cell the check sits inside the ::before box, centred. Oracle: the model's resolve(), which mirrors the sheet.
  it('the n plus 6 mark stays inside its box on every cell', () => {
    let cells = 0
    for (const tier of ['widget', 'product', 'content', 'brand'] as const) for (const scale of ['sm', 'md', 'lg'] as const) for (const size of ['sm', 'md', 'lg'] as const) {
      const at = `${tier} / ${scale} / ${size}`
      const r = resolve(tier, scale, size)
      const wrap = document.createElement('div')
      wrap.setAttribute('data-tier', tier)
      wrap.setAttribute('data-scale', scale)
      const el = document.createElement('ui-checkbox')
      el.setAttribute('size', size)
      el.setAttribute('checked', '')
      wrap.append(el)
      document.body.append(wrap)
      const box = getComputedStyle(el, '::before')
      const mark = getComputedStyle(el, '::after')
      const side = num(box.width)
      const start = num(mark.left)
      const end = start + num(mark.width)
      expect(num(mark.width), `${at}: the mark is n + 6`).toBeCloseTo(r.glyphBox, 1)
      expect(side, `${at}: the box is max(2n, n + 6)`).toBe(Math.max(r.iconBox, r.glyphBox))
      expect(start, `${at}: the mark starts inside the box`).toBeGreaterThanOrEqual(-0.05)
      expect(end, `${at}: the mark ends inside the box`).toBeLessThanOrEqual(side + 0.05)
      expect(Math.abs(start - (side - end)), `${at}: the mark is centred`).toBeLessThanOrEqual(0.5)
      expect(num(mark.height), `${at}: the mark's block size fits the box`).toBeLessThanOrEqual(num(box.height))
      wrap.remove()
      cells++
    }
    expect(cells).toBe(36)
  })
})
