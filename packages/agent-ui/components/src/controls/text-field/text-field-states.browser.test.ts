import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from '@vitest/browser/context'
import type { UITextFieldElement } from '@agent-ui/components/components'

// s11 (states leg) — the CROSS-ENGINE behaviour + focus-ring + forced-colors smoke for ui-text-field (decomp
// g4-g6 node s11). Where the jsdom probes pin the DECLARED rules, this pins what a REAL engine does with a
// real contenteditable + a real <form> + the @scope focus/forced-colors blocks — none of which jsdom can
// resolve. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances).
// Sibling to button-states.browser.test.ts (G5 s17) — same harness, same load-bearing CSS order, same
// engine-split policy (drive what both engines allow; reach the Chromium-only forced-colors leg via cdp() and
// assert a WebKit BASELINE there).
//
// Under proof: (1) a real contenteditable editor accepts typed input and `this.value` tracks it; (2) the value
// round-trips a real <form>'s FormData and `form.reset()` restores the default; (3) the :focus-within ring is
// present on MOUSE focus too (native text-input parity — the ADR-0014 dev#1 deviation from the button's
// keyboard-only :focus-visible ring), it is the SOLE focus indicator (the field border steps TRANSPARENT, no
// double border), and it survives forced-colors; (4) the IDLE field border + ink + placeholder survive
// forced-colors (do not vanish).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet, then the self-defining family barrel. Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

// A realistic author width. ui-text-field has NO intrinsic width — it is `inline-grid` with a `1fr` editor
// cell, so an empty, unplaceholdered field collapses the editor to ~0px (no content to size the 1fr column).
// Real usage sizes the field (an author width, or the G7 ui-field wrapper); a real engine's pointer hit-test
// then has an editor to land on. (The height geometry law is width-independent — see the geometry smoke.)
const SIZED = 'style="inline-size: 220px"'

// ── mount/cleanup ──────────────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; field: UITextFieldElement; editor: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const field = wrap.querySelector('ui-text-field') as UITextFieldElement
  const editor = field.querySelector('[data-part="editor"]') as HTMLElement // created on connect
  return { wrap, field, editor }
}
afterEach(async () => {
  await userEvent.unhover(document.body) // drop any held hover so it cannot bleed into the next test
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)

/** Alpha of a computed colour — 0 ⇒ the paint has VANISHED (a bare system keyword with no rgb() is opaque). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** True when a VISIBLE focus outline is painted on the element (style ≠ none, positive width, opaque colour). */
const ringDrawn = (el: HTMLElement): boolean => {
  const cs = getComputedStyle(el)
  return cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0 && alphaOf(cs.outlineColor) > 0
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] A real contenteditable surface — typed input flows into this.value (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-text-field — the real contenteditable surface tracks this.value (both engines)', () => {
  it('typed input lands in the editor AND this.value tracks it', async () => {
    const { field, editor } = mount(`<ui-text-field ${SIZED}></ui-text-field>`)
    expect(field.value, 'a fresh field is not empty').toBe('')

    await userEvent.click(editor) // mouse-focus the contenteditable region
    expect(editor.contains(document.activeElement) || document.activeElement === editor, 'click did not focus the editor').toBe(
      true,
    )
    await userEvent.keyboard('hello')
    await field.updateComplete

    // the surface→model wire: each editor `input` set this.value = editor.textContent.
    expect(editor.textContent, 'the editor did not receive the typed text').toBe('hello')
    expect(field.value, 'this.value did not track the typed input').toBe('hello')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] The value round-trips a real <form> (FormData) and reset() restores the default
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-text-field — real <form> round-trip + reset (both engines)', () => {
  it('the typed value contributes to FormData keyed by [name]; form.reset() restores the initial value', async () => {
    const { field, editor } = mount('<form><ui-text-field name="q" value="seed"></ui-text-field></form>')
    const form = field.closest('form') as HTMLFormElement
    expect(field.value, 'the initial value attribute did not seed this.value').toBe('seed')

    // edit the real surface so the value diverges from the captured defaultValue.
    await userEvent.click(editor)
    await userEvent.keyboard(' edited')
    await field.updateComplete
    const typed = field.value
    expect(typed, 'typing did not change the value off its default').not.toBe('seed')

    // round-trip: the field's value reaches the form's FormData, keyed by its [name] (FACE setFormValue).
    const data = new FormData(form)
    expect(data.get('q'), 'the field value did not reach FormData keyed by [name]').toBe(typed)

    // reset: the platform fires formResetCallback → formReset() → value ← the initial-attribute defaultValue,
    // and the model→surface effect writes the editor back to it (the caret-guarded programmatic write).
    form.reset()
    await field.updateComplete
    expect(field.value, 'form.reset() did not restore the default value').toBe('seed')
    expect(editor.textContent, 'form.reset() did not restore the editor surface').toBe('seed')
    expect(new FormData(form).get('q'), 'the restored value did not re-publish to the form').toBe('seed')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] :focus-within ring — drawn on MOUSE focus too (native text-input parity, ADR-0014 dev#1)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-text-field — :focus-within ring on the HOST frame (both engines)', () => {
  it('a MOUSE click on the editor draws the host ring (:focus-within, NOT keyboard-only :focus-visible)', async () => {
    const { field, editor } = mount(`<ui-text-field ${SIZED}></ui-text-field>`)
    expect(ringDrawn(field), 'a ring was already drawn before focus').toBe(false)

    await userEvent.click(editor) // POINTER modality — the deviation: a text field rings on mouse focus too
    expect(field.matches(':focus-within'), 'the host did not match :focus-within after focusing the editor').toBe(true)
    // the ADR-0014 dev#1 contract: the ring (the shared --md-sys-color-focus-ring outline) is on the HOST frame, drawn off
    // :focus-within — so unlike the button's :focus-visible ring, a mouse click DOES surface it (text-entry parity).
    expect(ringDrawn(field), `${server.browser}: the :focus-within ring was not drawn on mouse focus`).toBe(true)

    // the ring is the SOLE focus indicator — the field border steps TRANSPARENT on focus (a --md-sys-color-focus-ring
    // border-color step would double with the ring into a visible double border; ADR-0014 dev#1). MOTION-AWARE
    // read: once :state(ready) is armed the border-color FADES to transparent over --ui-motion-fast, so poll
    // until it settles to alpha 0 (rgba(0,0,0,0)) — no second blue frame is painted.
    await expect
      .poll(() => alphaOf(getComputedStyle(field).borderTopColor), { timeout: 1500 })
      .toBe(0)

    // the ring lives on the host, never the editor child (the editor sets outline:none).
    expect(getComputedStyle(editor).outlineStyle, 'the editor child drew its own outline').toBe('none')
    // the ring width is the shared 2px fleet ring (read from --ui-focus-ring-width).
    expect(px(getComputedStyle(field).outlineWidth), 'the ring is not the shared 2px width').toBeCloseTo(2, 0)
  })

  it('the ring geometry is layout-NEUTRAL — focusing does not perturb the frame box', async () => {
    const { field, editor } = mount(`<ui-text-field ${SIZED}></ui-text-field>`)
    const beforeH = field.getBoundingClientRect().height
    const beforeW = field.getBoundingClientRect().width
    await userEvent.click(editor)
    expect(ringDrawn(field), 'no ring drawn on focus').toBe(true)
    // the outline is painted outside the box (outline/outline-offset never participate in layout).
    expect(field.getBoundingClientRect().height, 'the ring changed the frame height').toBeCloseTo(beforeH, 1)
    expect(field.getBoundingClientRect().width, 'the ring changed the frame width').toBeCloseTo(beforeW, 1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] forced-colors — the ring survives AND the border + ink + placeholder do not vanish
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-text-field — forced-colors survival (Chromium emulates via CDP; WebKit asserts the baseline)', () => {
  it('the :focus-within ring survives forced-colors AND the idle border/ink/placeholder do not vanish', async () => {
    // an empty, placeholdered field so the [data-empty]::before placeholder is actually generated.
    const { field, editor } = mount(`<ui-text-field placeholder="Search…" ${SIZED}></ui-text-field>`)

    // baseline (BOTH engines, normal mode): the IDLE (unfocused) field paints a visible border + ink +
    // placeholder — so the forced-colors assertions below cannot be vacuous. (The border is checked idle because
    // a FOCUSED field's border is transparent by design — see the focus assertion next.)
    expect(alphaOf(getComputedStyle(field).borderTopColor), 'idle border invisible in normal mode').toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(field).color), 'ink invisible in normal mode').toBeGreaterThan(0)
    expect(
      alphaOf(getComputedStyle(editor, '::before').color),
      'placeholder ink invisible in normal mode',
    ).toBeGreaterThan(0)

    // focus draws the host ring AND steps the field border TRANSPARENT (the ring is the sole indicator — no
    // double border; ADR-0014 dev#1). MOTION-AWARE: the border-color FADES to transparent over --ui-motion-fast
    // once :state(ready) is armed, so poll until it settles to alpha 0.
    await userEvent.click(editor)
    expect(ringDrawn(field), 'no :focus-within ring in normal mode').toBe(true)
    await expect
      .poll(() => alphaOf(getComputedStyle(field).borderTopColor), { timeout: 1500 })
      .toBe(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented split) — assert we are genuinely NOT in
      // forced-colors (so the Chromium proof below is not silently faked) and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      // anti-vacuous: the engine REALLY entered forced-colors, so text-field.css's @media (forced-colors:
      // active) block is the one applying.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // the ring SURVIVES (the field is still focused) — the :focus-within outline resolves via
      // --md-sys-color-focus-ring → Highlight (the WHCM ring is free). The focus border-color is dropped by forced-colors;
      // the outline is WHY dev#1 makes the ring the SOLE focus indicator (the transparent border carries nothing).
      expect(ringDrawn(field), 'the :focus-within ring vanished under forced-colors').toBe(true)

      // the IDLE border + ink + placeholder do NOT vanish — blur to the idle frame, then the forced-colors block
      // repaints the border + ink to CanvasText (the focus border is transparent, so it must be checked
      // unfocused). MOTION-AWARE: the border-color fades off transparent back to the idle frame, so poll the
      // border until it leaves alpha 0.
      editor.blur()
      expect(field.matches(':focus-within'), 'the field did not blur').toBe(false)
      await expect
        .poll(() => alphaOf(getComputedStyle(field).borderTopColor), { timeout: 1500 })
        .toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(field).color), 'the field ink vanished under forced-colors').toBeGreaterThan(0)
      expect(
        alphaOf(getComputedStyle(editor, '::before').color),
        'the placeholder vanished under forced-colors',
      ).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset the emulation
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] ADR-0029 A1 — visible inline-validation message (extends ADR-0014)
//      (team-lead's S2 browser smoke: run `npm run test:browser` to verify the message block is truly
//      rendered visible and carries the danger ink, gated by :state(user-invalid) — non-negotiable for
//      a real layout engine since jsdom does not evaluate `display:block` vs `hidden`.)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-text-field — visible inline-validation message (ADR-0029 A1, extends ADR-0014)', () => {
  it('the .ui-text-field-message node appears visible with danger ink ONLY after :state(user-invalid) is active', async () => {
    // A required field that is empty fires `valueMissing` on blur (the user-invalid timing controller
    // arms :state(user-invalid) on the first blur or change — ADR-0014 cl.2c / interaction-states).
    const { field, editor } = mount(`<ui-text-field required ${SIZED}></ui-text-field>`)
    const message = field.querySelector('.ui-text-field-message') as HTMLElement

    // BEFORE interaction: message is `hidden` and produces no layout box.
    expect(message.hidden, 'message node should start hidden before any interaction').toBe(true)
    expect(getComputedStyle(message).display, 'message node should be non-rendered before user-invalid').toBe('none')

    // USER-INVALID: click then blur triggers the timing controller → :state(user-invalid) added → the
    // CSS rule `display:block` overrides `hidden`'s `display:none`, making the message visible.
    await userEvent.click(editor)
    await userEvent.click(document.body) // blur the field — triggers the user-invalid controller
    await field.updateComplete

    expect(field.matches(':state(user-invalid)'), ':state(user-invalid) was not armed on blur').toBe(true)
    expect(message.hidden, 'message.hidden was not toggled false by the user-invalid effect').toBe(false)
    // CSS `display:block` + the node being un-hidden means the node produces a layout box.
    expect(getComputedStyle(message).display, ':state(user-invalid) did not give the message display:block').toBe('block')
    // the message carries the validation message text (set by text-field.ts from formValidity().message)
    expect(message.textContent?.length, 'message node has no text content under user-invalid').toBeGreaterThan(0)
    // danger ink: the `color` property resolves to a non-transparent colour via --ui-text-field-message-ink → --md-sys-color-danger-on-surface-variant
    expect(alphaOf(getComputedStyle(message).color), 'message ink is transparent — danger colour not applied').toBeGreaterThan(0)

    // RECOVERY: filling the field should clear user-invalid and hide the message again.
    await userEvent.click(editor)
    await userEvent.keyboard('hello')
    await userEvent.click(document.body) // blur to commit
    await field.updateComplete

    expect(field.matches(':state(user-invalid)'), ':state(user-invalid) persists after the field is filled').toBe(false)
    expect(message.hidden, 'message node is still visible after user-invalid cleared').toBe(true)
  })
})
