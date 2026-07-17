import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
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
//  [1b] TKT-0062 — the filled/container state law genuinely repaints in a REAL engine, not just structurally
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-text-field — the TKT-0062 filled/container state law (real repaint, both engines)', () => {
  it('empty+idle vs typed+idle repaint background AND the VISIBLE editor ink together (not just border, unlike the old law)', async () => {
    // code-reviewer HIGH finding: reading `field.color` (the host) alone is vacuous — the editor part
    // carries its OWN color declaration reading the same token, so a state rule that only repaints the
    // host's `color` property (not the underlying token) never reaches the visible typed text. Read the
    // EDITOR's own computed color — the element the user actually sees text in — not just the host.
    const { field, editor } = mount(`<ui-text-field ${SIZED}></ui-text-field>`)
    const emptyBg = getComputedStyle(field).backgroundColor
    const emptyInk = getComputedStyle(editor).color

    await userEvent.click(editor)
    await userEvent.keyboard('filled now')
    await field.updateComplete
    editor.blur() // drop focus so the FILLED (idle) row paints, not the focus row
    await expect.poll(() => field.matches(':focus-within')).toBe(false)
    await new Promise((r) => setTimeout(r, 250)) // past --md-sys-motion-duration-fast — let the repaint settle

    const filledBg = getComputedStyle(field).backgroundColor
    const filledInk = getComputedStyle(editor).color
    expect(filledBg, 'the background did not repaint between empty and filled').not.toBe(emptyBg)
    expect(filledInk, 'the VISIBLE editor ink did not repaint between empty and filled').not.toBe(emptyInk)
  })

  it('focus wins over filled: a focused-AND-filled field shows the FOCUS row, not the filled row', async () => {
    const { field, editor } = mount(`<ui-text-field ${SIZED}></ui-text-field>`)
    await userEvent.click(editor)
    await userEvent.keyboard('filled and focused')
    await field.updateComplete
    // still focused here — the mutual-exclusion CSS (filled excludes :focus-within) means the FOCUS
    // background/ink tokens must be what's painted, not the filled ones, even though the field is
    // ALSO filled.
    expect(field.matches(':focus-within'), 'the field unexpectedly lost focus').toBe(true)
    await expect
      .poll(() => alphaOf(getComputedStyle(field).borderTopColor), { timeout: 1500 })
      .toBe(0) // the focus row's border is transparent (same as the idle/filled rows — proven by the ring test)
    // anti-vacuous: filled and focus DO differ on ink (on-surface-variant vs on-surface) — if this ever
    // becomes false (a token edit collapses the two roles), this test would start silently passing for
    // the wrong reason, so assert the values actually differ first. MOTION-AWARE: `color` is one of the
    // transitioned state-paint properties (:state(ready)) — read it via poll-until-settled on BOTH sides,
    // never a synchronous read right after the state change (a live timing bug this test itself hit
    // while being authored: a synchronous read caught the color mid-fade, still showing the PRIOR value).
    // code-reviewer HIGH finding: read the EDITOR's own computed color, not the host's — the editor
    // carries its own color declaration reading the ink token directly, so it's the element that
    // actually proves the visible typed text repaints, not just the host frame.
    editor.blur()
    await expect.poll(() => field.matches(':focus-within')).toBe(false)
    await new Promise((r) => setTimeout(r, 250)) // past --md-sys-motion-duration-fast — let the blur-triggered fade settle
    const filledInk = getComputedStyle(editor).color
    editor.focus()
    await expect.poll(() => field.matches(':focus-within')).toBe(true)
    await expect
      .poll(() => getComputedStyle(editor).color, { timeout: 1500 })
      .not.toBe(filledInk)
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
    // read: once :state(ready) is armed the border-color FADES to transparent over --md-sys-motion-duration-fast, so poll
    // until it settles to alpha 0 (rgba(0,0,0,0)) — no second blue frame is painted.
    await expect
      .poll(() => alphaOf(getComputedStyle(field).borderTopColor), { timeout: 1500 })
      .toBe(0)

    // the ring lives on the host, never the editor child (the editor sets outline:none).
    expect(getComputedStyle(editor).outlineStyle, 'the editor child drew its own outline').toBe('none')
    // the ring width is the shared 2px fleet ring (read from --md-sys-state-focus-ring-width).
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
  it('the :focus-within ring survives forced-colors AND the idle ink/placeholder do not vanish; a border APPEARS under forced-colors where light mode paints none', async () => {
    // an empty, placeholdered field so the [data-empty]::before placeholder is actually generated.
    const { field, editor } = mount(`<ui-text-field placeholder="Search…" ${SIZED}></ui-text-field>`)

    // baseline (BOTH engines, normal mode): the IDLE (unfocused, unhovered) field's BORDER is
    // TRANSPARENT by design under TKT-0062's filled/container state law — border is visible only on
    // :hover now (the light-mode exception in that table); ink + placeholder stay real, visible colours
    // (the "default" ink role) — so the forced-colors ink/placeholder assertions below still cannot be
    // vacuous. The border's own forced-colors proof (below) instead checks the STRONGER claim that a
    // border APPEARS under forced-colors where light mode painted none at all.
    expect(alphaOf(getComputedStyle(field).borderTopColor), 'idle border unexpectedly visible in normal mode (TKT-0062: default border is transparent)').toBe(0)
    expect(alphaOf(getComputedStyle(field).color), 'ink invisible in normal mode').toBeGreaterThan(0)
    expect(
      alphaOf(getComputedStyle(editor, '::before').color),
      'placeholder ink invisible in normal mode',
    ).toBeGreaterThan(0)

    // focus draws the host ring AND steps the field border TRANSPARENT (the ring is the sole indicator — no
    // double border; ADR-0014 dev#1). MOTION-AWARE: the border-color FADES to transparent over --md-sys-motion-duration-fast
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

      // the IDLE ink + placeholder do NOT vanish, AND a border APPEARS (TKT-0062: it painted NONE in
      // light-mode idle, per the baseline assertion above) — blur to the idle frame, then the
      // forced-colors block unconditionally repaints border-color to CanvasText, overriding the
      // transparent light-mode token. MOTION-AWARE: poll until the border settles off alpha 0.
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
//  TKT-0057 — disabling a focused editor: Chromium blurs it, WebKit does not (root-caused, ratified)
// ════════════════════════════════════════════════════════════════════════════════════════════════════
//
// ROOT CAUSE (TKT-0057): a `disabled` NATIVE form control cannot be focused, and disabling an
// already-focused native control blurs it — this is the platform's own long-established, consistently
// cross-engine convention for `disabled` form controls (native `<input disabled>`/`<button disabled>`
// parity; documented widely, e.g. https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/disabled,
// and the exact behavioral gap jsdom itself was cited as diverging from in
// https://github.com/jsdom/jsdom/issues/2931 — REAL browsers blur, jsdom historically did not). This
// element is a contenteditable div standing in for a native input (ADR-0014/0017), not a real form
// control with its own dedicated `disabled` IDL attribute — its "disabled" transition instead removes
// `contenteditable`/`tabindex`, which is how the fleet SIMULATES the native disabled-cannot-be-focused
// contract. Chromium re-evaluates the currently-focused element's computed focusability the moment that
// DOM mutation lands and blurs it — MATCHING native disabled-control parity, not violating it. WebKit
// does not eagerly re-run that check for a contenteditable region losing focusability this way (an
// engine implementation gap for contenteditable specifically — contenteditable has no dedicated native
// "disabled" IDL attribute the way `<input>`/`<button>` do, so there is no single spec clause mandating
// either engine's behavior here the way there is for native controls).
//
// RATIFIED (TKT-0057 Acceptance fork (b)): Chromium's behavior is the one that matches genuine native
// `<input disabled>` parity — this fleet's OWN stated design intent ("focus survives disabling") was the
// actual mismatch, not Chromium. No code fix is built: forcing focus to remain on a now-uneditable
// region would fight the platform's own native-parity convention and risks new confusion (a screen
// reader user landing on an element that LOOKS focused but accepts no input). WebKit's focus retention
// here is the outlier, not a target to replicate.
describe('ui-text-field — TKT-0057: disabling a focused editor — Chromium blurs it (native disabled-parity); WebKit does not', () => {
  it('the engine split is real and reproducible at the component\'s own level, not just through a composed consumer', async () => {
    const { field, editor } = mount(`<ui-text-field ${SIZED}></ui-text-field>`)

    await userEvent.click(editor)
    expect(editor.contains(document.activeElement) || document.activeElement === editor, 'the editor did not take focus in a real engine').toBe(true)

    field.disabled = true
    await field.updateComplete

    if (server.browser === 'chromium') {
      expect(document.activeElement === editor, 'TKT-0057 behavior shifted — Chromium no longer blurs on disable (update this test + the ticket)').toBe(false)
    } else {
      expect(document.activeElement === editor, 'disabling unexpectedly dropped focus in a non-Chromium engine').toBe(true)
    }

    field.disabled = false
    await field.updateComplete
    expect(document.activeElement === editor, 'the post-re-enable focus state shifted — update this test + TKT-0057').toBe(
      server.browser === 'chromium' ? false : true,
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] ADR-0029 A1 — visible inline-validation message (extends ADR-0014)
//      (team-lead's S2 browser smoke: run `npm run test:browser` to verify the message block is truly
//      rendered visible and carries the danger ink, gated by :state(user-invalid) — non-negotiable for
//      a real layout engine since jsdom does not evaluate `display:block` vs `hidden`.)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] TKT-0023 — the unfocused-write canonical resync, under REAL focus/blur (both engines)
//      (jsdom drives this via synthetic focus/blur dispatch — text-field.test.ts / value-codec.test.ts.
//      This is the real-engine proof: genuine userEvent.click() focus transitions, a real <form> +
//      FormData for the FACE form-value boundary — the focus-sensitive path the ticket calls out.)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-text-field — TKT-0023 unfocused-write resync under REAL focus (both engines)', () => {
  it('an unfocused programmatic write reaches the real FormData value — no blur, no prior focus at all', async () => {
    const { field } = mount('<form><ui-text-field type="number" name="amount"></ui-text-field></form>')
    const form = field.closest('form') as HTMLFormElement

    ;(field as unknown as { value: string }).value = '42' // programmatic — the editor is never focused
    await field.updateComplete

    expect(new FormData(form).get('amount'), 'the unfocused write did not reach the FACE form value').toBe('42')
  })

  it('a mid-edit programmatic write (REAL focus) defers to the next REAL blur, then catches up', async () => {
    const { field, editor } = mount(
      `<form><ui-text-field type="number" name="amount" ${SIZED}></ui-text-field></form>`,
    )
    const form = field.closest('form') as HTMLFormElement

    // establish a committed baseline via a real focus→type→blur cycle.
    await userEvent.click(editor)
    await userEvent.keyboard('5')
    await userEvent.click(document.body) // real blur
    await field.updateComplete
    expect(new FormData(form).get('amount'), 'the baseline commit did not reach FormData').toBe('5')

    // re-focus (REAL), then a programmatic write arrives mid-edit — canonical must NOT resync yet.
    await userEvent.click(editor)
    ;(field as unknown as { value: string }).value = '77'
    await field.updateComplete
    expect(new FormData(form).get('amount'), 'a mid-edit programmatic write resynced canonical early').toBe('5')

    // the real blur that follows commits the documented semantic: canonical catches up.
    await userEvent.click(document.body)
    await field.updateComplete
    expect(new FormData(form).get('amount'), 'canonical did not catch up on the following real blur').toBe('77')
  })
})

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
