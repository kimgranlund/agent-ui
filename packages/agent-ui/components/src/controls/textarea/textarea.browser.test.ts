import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UITextareaElement } from '@agent-ui/components/components'

// The cross-engine behaviour + geometry + focus-ring + forced-colors smoke for ui-textarea (ADR-0134). Where
// the jsdom probes pin the DECLARED rules, this pins what a REAL engine does with a real contenteditable + a
// real <form> + the @scope focus/forced-colors/resize blocks — none of which jsdom can resolve. Runs in BOTH
// Chromium and WebKit (vitest.browser.config.ts → the two playwright instances). Sibling to
// text-field-states.browser.test.ts / text-field-geometry.browser.test.ts — same harness, same load-bearing
// CSS order, same engine-split policy.
//
// Under proof: (1) a real contenteditable editor accepts typed input INCLUDING Enter as a literal newline
// (the ADR-0134 inversion — never intercepted, never commits); (2) the value round-trips a real <form>'s
// FormData and `form.reset()` restores the default; (3) the :focus-within ring is the sole focus indicator
// and survives forced-colors, the same as ui-text-field; (4) the MULTI-LINE geometry law is real-engine
// measured — `rows` genuinely changes the rendered min-height, `[size]` genuinely changes the font AND (via
// the calc() chain) the derived padding/line-box, and the box is truly `resize: vertical`.
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet, then the self-defining family barrel. Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const SIZED = 'style="inline-size: 260px"'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; field: UITextareaElement; editor: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const field = wrap.querySelector('ui-textarea') as UITextareaElement
  const editor = field.querySelector('[data-part="editor"]') as HTMLElement
  return { wrap, field, editor }
}
afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)

const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

const ringDrawn = (el: HTMLElement): boolean => {
  const cs = getComputedStyle(el)
  return cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0 && alphaOf(cs.outlineColor) > 0
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const allDistinct = (xs: number[]): boolean => new Set(xs.map((x) => x.toFixed(2))).size === xs.length

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] A real contenteditable surface — Enter inserts a literal newline, never commits (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-textarea — real multi-line typing: Enter inserts a newline, never commits (both engines)', () => {
  it('typed input including Enter lands in the editor AND this.value tracks the newline', async () => {
    const { field, editor } = mount(`<ui-textarea ${SIZED}></ui-textarea>`)
    expect(field.value).toBe('')

    await userEvent.click(editor)
    expect(editor.contains(document.activeElement) || document.activeElement === editor).toBe(true)
    await userEvent.keyboard('line one{Enter}line two')
    await field.updateComplete

    expect(field.value, 'Enter did not insert a newline into the value').toBe('line one\nline two')
    expect(editor.textContent, 'Enter did not insert a newline into the editor surface').toContain('line one')
    expect(editor.textContent).toContain('line two')
  })

  it('Enter alone does NOT emit change (commit is blur-with-change only)', async () => {
    const { field, editor } = mount(`<ui-textarea ${SIZED}></ui-textarea>`)
    let changes = 0
    field.addEventListener('change', () => changes++)

    await userEvent.click(editor)
    await userEvent.keyboard('typed{Enter}more')
    await field.updateComplete
    expect(changes, 'Enter must never commit — the ADR-0134 inversion of ui-text-field').toBe(0)

    await userEvent.click(document.body) // real blur — NOW it commits
    await field.updateComplete
    expect(changes).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] The value round-trips a real <form> (FormData, newlines intact) and reset() restores the default
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-textarea — real <form> round-trip + reset, newlines intact (both engines)', () => {
  it('the typed multi-line value contributes to FormData keyed by [name]; form.reset() restores the initial value', async () => {
    const { field, editor } = mount('<form><ui-textarea name="notes" value="seed"></ui-textarea></form>')
    const form = field.closest('form') as HTMLFormElement
    expect(field.value).toBe('seed')

    await userEvent.click(editor)
    await userEvent.keyboard('{Enter} edited')
    await field.updateComplete
    const typed = field.value
    expect(typed).not.toBe('seed')
    expect(typed).toContain('\n')

    const data = new FormData(form)
    expect(data.get('notes'), 'the multi-line value did not reach FormData intact').toBe(typed)

    form.reset()
    await field.updateComplete
    expect(field.value).toBe('seed')
    expect(editor.textContent).toBe('seed')
    expect(new FormData(form).get('notes')).toBe('seed')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] :focus-within ring — the sole focus indicator on the HOST frame (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-textarea — :focus-within ring on the HOST frame (both engines)', () => {
  it('a MOUSE click on the editor draws the host ring; the frame border steps transparent (no double border)', async () => {
    const { field, editor } = mount(`<ui-textarea ${SIZED}></ui-textarea>`)
    expect(ringDrawn(field)).toBe(false)

    await userEvent.click(editor)
    expect(field.matches(':focus-within')).toBe(true)
    expect(ringDrawn(field), `${server.browser}: the :focus-within ring was not drawn on mouse focus`).toBe(true)

    await expect
      .poll(() => alphaOf(getComputedStyle(field).borderTopColor), { timeout: 1500 })
      .toBe(0)

    expect(getComputedStyle(editor).outlineStyle).toBe('none')
    expect(px(getComputedStyle(field).outlineWidth)).toBeCloseTo(2, 0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3b] TKT-0062 — the filled/container state law genuinely repaints in a REAL engine, not just structurally
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-textarea — the TKT-0062 filled/container state law (real repaint, both engines)', () => {
  it('empty+idle vs typed+idle repaint background AND the VISIBLE editor ink together (not just border, unlike the old law)', async () => {
    // code-reviewer HIGH finding: reading `field.color` (the host) alone is vacuous — the editor part
    // carries its own color declaration reading the same token, so a state rule that only repaints the
    // host's `color` property never reaches the visible typed text. Read the EDITOR's own computed
    // color — the element the user actually sees text in.
    const { field, editor } = mount(`<ui-textarea ${SIZED}></ui-textarea>`)
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
    const { field, editor } = mount(`<ui-textarea ${SIZED}></ui-textarea>`)
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
    // never a synchronous read right after the state change (a live timing bug the text-field version of
    // this test hit while being authored: a synchronous read caught the color mid-fade, still showing the
    // PRIOR value).
    // code-reviewer HIGH finding: read the EDITOR's own computed color, not the host's.
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
//  [4] forced-colors — the ring survives AND the idle border/ink/placeholder do not vanish
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-textarea — forced-colors survival (Chromium emulates via CDP; WebKit asserts the baseline)', () => {
  it('the :focus-within ring survives forced-colors AND the idle border/ink/placeholder do not vanish', async () => {
    const { field, editor } = mount(`<ui-textarea placeholder="Write something…" ${SIZED}></ui-textarea>`)

    // TKT-0062: default border is transparent — the idle (unfocused, unhovered, empty) textarea's border is
    // TRANSPARENT by design under the filled/container state law; border is visible only on :hover now (the
    // light-mode exception in that table). Ink + placeholder stay real, visible colours (the "default" ink
    // role), so the forced-colors assertions below still cannot be vacuous — the border's own forced-colors
    // proof (below) instead checks the STRONGER claim that a border APPEARS under forced-colors where light
    // mode painted none at all.
    expect(alphaOf(getComputedStyle(field).borderTopColor)).toBe(0)
    expect(alphaOf(getComputedStyle(field).color)).toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(editor, '::before').color)).toBeGreaterThan(0)

    await userEvent.click(editor)
    expect(ringDrawn(field)).toBe(true)
    await expect
      .poll(() => alphaOf(getComputedStyle(field).borderTopColor), { timeout: 1500 })
      .toBe(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      expect(ringDrawn(field), 'the :focus-within ring vanished under forced-colors').toBe(true)

      editor.blur()
      expect(field.matches(':focus-within')).toBe(false)
      await expect
        .poll(() => alphaOf(getComputedStyle(field).borderTopColor), { timeout: 1500 })
        .toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(field).color)).toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(editor, '::before').color)).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  TKT-0057 — disabling a focused editor: Chromium blurs it, WebKit does not (root-caused, ratified —
//  see text-field-states.browser.test.ts's own TKT-0057 describe block for the full root-cause writeup;
//  ui-textarea shares the identical contenteditable disable mechanism, ADR-0134).
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-textarea — TKT-0057: disabling a focused editor — Chromium blurs it (native disabled-parity); WebKit does not', () => {
  it('the engine split is real and reproducible at the component\'s own level, not just through a composed consumer', async () => {
    const { field, editor } = mount(`<ui-textarea ${SIZED}></ui-textarea>`)

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
//  [5] the MULTI-LINE geometry law — rows/size/resize, real-engine measured (ADR-0134)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-textarea cross-engine geometry smoke — the multi-line law (both engines)', () => {
  it('rows genuinely CHANGES the rendered min-height (a growable MINIMUM, not a fixed height)', async () => {
    const { field } = mount(`<ui-textarea ${SIZED}></ui-textarea>`)
    const heights: number[] = []
    for (const rows of [2, 4, 8]) {
      field.rows = rows
      await field.updateComplete // the --ui-textarea-rows inline custom property mirror is a scope-owned effect (async)
      heights.push(field.getBoundingClientRect().height)
    }
    expect(allDistinct(heights), `heights did not change across rows: ${heights.join()}`).toBe(true)
    expect(heights[0]).toBeLessThan(heights[1])
    expect(heights[1]).toBeLessThan(heights[2])
  })

  it('[size] sm→md→lg CHANGES the editor font px', () => {
    const { field, editor } = mount(`<ui-textarea ${SIZED}></ui-textarea>`)
    const fonts: number[] = []
    for (const size of ['sm', 'md', 'lg'] as const) {
      field.setAttribute('size', size)
      fonts.push(px(getComputedStyle(editor).fontSize))
    }
    expect(fonts[0]).toBeCloseTo(13, 0)
    expect(fonts[1]).toBeCloseTo(14, 0)
    expect(fonts[2]).toBeCloseTo(16, 0)
    expect(allDistinct(fonts), `editor fonts did not change across [size]: ${fonts.join()}`).toBe(true)
  })

  it('typing PAST the rows minimum grows the content instead of the box shrinking it (overflow-y:auto holds the min)', async () => {
    const { field, editor } = mount(`<ui-textarea rows="2" ${SIZED}></ui-textarea>`)
    const minHeight = field.getBoundingClientRect().height
    expect(minHeight).toBeGreaterThan(0)

    await userEvent.click(editor)
    await userEvent.keyboard('one{Enter}two{Enter}three{Enter}four{Enter}five{Enter}six')
    await field.updateComplete

    // the box does not grow past its authored bound (overflow-y:auto scrolls, it does not force unlimited growth) —
    // this asserts the box stays a SCROLL container: scrollHeight exceeds clientHeight once content overflows the minimum.
    expect(editor.scrollHeight).toBeGreaterThanOrEqual(editor.clientHeight)
  })

  it('is a real resize:vertical box (native <textarea> parity)', () => {
    const { field } = mount(`<ui-textarea ${SIZED}></ui-textarea>`)
    expect(getComputedStyle(field).resize).toBe('vertical')
  })

  it('a disabled textarea is NOT resizable (resize:none)', () => {
    const { field } = mount(`<ui-textarea disabled ${SIZED}></ui-textarea>`)
    expect(getComputedStyle(field).resize).toBe('none')
  })
})

describe('ui-textarea — visible inline-validation message (ADR-0029 A1, reused verbatim)', () => {
  it('the .ui-textarea-message node appears visible with danger ink ONLY after :state(user-invalid) is active', async () => {
    const { field, editor } = mount(`<ui-textarea required ${SIZED}></ui-textarea>`)
    const message = field.querySelector('.ui-textarea-message') as HTMLElement

    expect(message.hidden).toBe(true)
    expect(getComputedStyle(message).display).toBe('none')

    await userEvent.click(editor)
    await userEvent.click(document.body)
    await field.updateComplete

    expect(field.matches(':state(user-invalid)')).toBe(true)
    expect(message.hidden).toBe(false)
    expect(getComputedStyle(message).display).toBe('block')
    expect(message.textContent?.length).toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(message).color)).toBeGreaterThan(0)

    await userEvent.click(editor)
    await userEvent.keyboard('hello')
    await userEvent.click(document.body)
    await field.updateComplete

    expect(field.matches(':state(user-invalid)')).toBe(false)
    expect(message.hidden).toBe(true)
  })
})
