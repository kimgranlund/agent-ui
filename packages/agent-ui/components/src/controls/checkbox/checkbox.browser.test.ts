import { describe, it, expect } from 'vitest'
import { userEvent } from 'vitest/browser'

// S1 browser smoke — ui-checkbox (decomp S1 · ADR-0041 · ADR-0042).
// Probes (AC1–AC4 from ADR-0041): the box = --ui-compact-{size} per [size]×[scale]; the checkmark
// renders (::after has a non-zero computed dimension when checked); forced-colors (manual — the Playwright
// browser does not emulate forced-colors in headless runs, so that branch is verified by reading only);
// C10 connect→disconnect zero-residue (one toggle per click, no listener stacking).
//
// These imports are direct (not through the barrel) because the component-styles barrel is the
// host's integration slice — it gains the checkbox @import at barrel-wiring time. The foundation CSS
// (tokens + dimensions) is loaded through the shared package barrel so the --md-sys-color-* / --ui-compact-*
// token chain is in place before the control sheet resolves.

import '@agent-ui/components/foundation-styles.css' // tokens (--md-sys-color-*) + dimensions (--ui-compact-*)
import './checkbox.css'                             // the control stylesheet (direct — pre-barrel)
import './checkbox.ts'                             // self-define (registers ui-checkbox)

describe('ui-checkbox browser smoke (S1 AC1–AC4)', () => {
  it('AC1 default: ::before box = 16×16 px (--ui-compact-md at ui-md scale)', () => {
    const el = document.createElement('ui-checkbox')
    document.body.append(el)
    const cs = getComputedStyle(el, '::before')
    // --ui-compact-md = 16px at the default ui-md scale (ADR-0041 clause 2)
    expect(Number.parseFloat(cs.width)).toBe(16)
    expect(Number.parseFloat(cs.height)).toBe(16)
    el.remove()
  })

  it('AC1 [size=sm] → 14px box; [size=lg] → 18px box (the compact ramp)', () => {
    const sm = document.createElement('ui-checkbox')
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    expect(Number.parseFloat(getComputedStyle(sm, '::before').width)).toBe(14) // --ui-compact-sm
    sm.remove()

    const lg = document.createElement('ui-checkbox')
    lg.setAttribute('size', 'lg')
    document.body.append(lg)
    expect(Number.parseFloat(getComputedStyle(lg, '::before').width)).toBe(18) // --ui-compact-lg
    lg.remove()
  })

  it('AC1 [scale=ui-lg] × [size=md] → 18px box (the scale × size lookup, ADR-0041 clause 2)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'ui-lg')
    const el = document.createElement('ui-checkbox')
    wrapper.append(el)
    document.body.append(wrapper)
    // ui-lg × md = 18px (ADR-0041 table row ui-lg, column md)
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(18)
    wrapper.remove()
  })

  it('AC4 no --ui-scale multiplier: [scale=content-lg] × [size=lg] → 28px (not a CSS calc result)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'content-lg')
    const el = document.createElement('ui-checkbox')
    el.setAttribute('size', 'lg')
    wrapper.append(el)
    document.body.append(wrapper)
    // content-lg × lg = 28px — the literal from the ADR-0041 table, NOT a scale multiplier
    expect(Number.parseFloat(getComputedStyle(el, '::before').width)).toBe(28)
    wrapper.remove()
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
    // `border-color` transitions over `--ui-motion-fast` (300ms, dimensions.css) — a couple of animation
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
