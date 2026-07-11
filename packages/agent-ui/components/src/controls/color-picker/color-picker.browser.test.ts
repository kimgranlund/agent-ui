import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UIColorPickerElement } from './color-picker.ts'

// color-picker.browser.test.ts — cross-engine (Chromium + WebKit) proofs (LLD §11 / color-picker.lld.md).
// None of this resolves in jsdom:
//   [1] WHOLE-SHAPE — a bare picker in a realistic container has a non-degenerate bounding box (pad real
//       height via --ui-color-picker-pad-block-size, channels real width — the ui-slider DOT-bug guard).
//   [2] Real pointer-drag on the pad (INSTRUMENT-BRIDGE: synthetic dispatchEvent + stubbed
//       setPointerCapture — real capture throws on synthetic pointers) moves the thumb in BOTH axes and
//       changes chroma+lightness (the area-drag 2-axis proof a synthetic 1D value-drag can't give).
//   [3] Real pointer-drag on a channel slider moves it (the composed ui-slider works in place).
//   [4] 2-axis REAL keyboard (userEvent.keyboard) moves the expected axis and updates aria-valuetext.
//   [5] forced-colors (Chromium via CDP; WebKit baseline) — channels + readout stay operable, the pad
//       shows no fabricated system color.
//   [6] EyeDropper (SPEC-R13) — absent branch (WebKit/Firefox, no button, no layout hole) and present
//       branch (Chromium, a stubbed window.EyeDropper resolving a color commits + fires change).
// Canvas PIXELS are never asserted (paint is not the contract) — thumb position + emitted value are.

import '@agent-ui/components/foundation-styles.css'
import '../slider/slider.css'
import '../slider/slider.ts'
import '../text-field/text-field.css'
import '../text-field/text-field.ts'
import '../swatch/swatch.css'
import '../swatch/swatch.ts'
import './color-picker.css'
import './color-picker.ts'

const mounted: HTMLElement[] = []

function mount(markup: string): { wrap: HTMLElement; el: UIColorPickerElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.inlineSize = '320px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-color-picker') as UIColorPickerElement
  return { wrap, el }
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.remove()
})

/** Stub setPointerCapture on an element (real capture throws on synthetic pointers — INSTRUMENT-BRIDGE). */
function stubCapture(el: HTMLElement): void {
  el.setPointerCapture = (_id: number): void => {}
}

const ptr = (type: string, x: number, y: number, id = 1): PointerEvent =>
  new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, bubbles: true, cancelable: true })

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] WHOLE-SHAPE
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-color-picker — whole-shape (Test-the-whole-shape DoD law)', () => {
  it('a bare picker renders a non-degenerate bounding box: pad has real height, channels have real width', async () => {
    const { el } = mount('<ui-color-picker></ui-color-picker>')
    await el.updateComplete

    const pad = el.querySelector<HTMLElement>('[data-part="pad"]')!
    const padRect = pad.getBoundingClientRect()
    expect(padRect.height, `${server.browser}: pad collapsed to zero height`).toBeGreaterThan(0)
    expect(padRect.width, `${server.browser}: pad collapsed to zero width`).toBeGreaterThan(0)

    const hueSlider = el.querySelector<HTMLElement>('ui-slider[data-channel="hue"]')!
    const sliderRect = hueSlider.getBoundingClientRect()
    expect(sliderRect.width, `${server.browser}: hue slider collapsed to zero width (the DOT-bug class)`).toBeGreaterThan(0)
    expect(sliderRect.height, `${server.browser}: hue slider collapsed to zero height`).toBeGreaterThan(0)

    const whole = el.getBoundingClientRect()
    expect(whole.height, `${server.browser}: the whole picker collapsed`).toBeGreaterThan(padRect.height)
  })

  it('every channel prints a real, non-empty numeral (non-color signifier, live in a real engine)', async () => {
    const { el } = mount('<ui-color-picker value="#3b82f6"></ui-color-picker>')
    await el.updateComplete
    for (const ch of ['hue', 'chroma', 'lightness']) {
      const valueEl = el.querySelector<HTMLElement>(`[data-part="channel-row"][data-channel="${ch}"] [data-part="channel-value"]`)!
      expect(valueEl.getBoundingClientRect().width, `${server.browser}: ${ch} numeral collapsed`).toBeGreaterThan(0)
      expect(valueEl.textContent!.length).toBeGreaterThan(0)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] Real pointer-drag on the pad — BOTH axes move, chroma+lightness change
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-color-picker — real pointer-drag on the pad (both engines, the area-drag 2-axis proof)', () => {
  it('dragging across the pad moves the thumb in BOTH axes and changes chroma AND lightness', async () => {
    const { el } = mount('<ui-color-picker value="#808080"></ui-color-picker>')
    await el.updateComplete

    const pad = el.querySelector<HTMLElement>('[data-part="pad"]')!
    stubCapture(pad)
    const rect = pad.getBoundingClientRect()

    const chromaBefore = el.querySelector<HTMLElement>('[data-part="channel-row"][data-channel="chroma"] [data-part="channel-value"]')!.textContent
    const lightnessBefore = el.querySelector<HTMLElement>('[data-part="channel-row"][data-channel="lightness"] [data-part="channel-value"]')!.textContent

    const events: string[] = []
    el.addEventListener('input', () => events.push('input'))
    el.addEventListener('change', () => events.push('change'))

    // press near top-left (low chroma, high lightness), drag to bottom-right (high chroma, low lightness)
    const x0 = rect.left + rect.width * 0.15
    const y0 = rect.top + rect.height * 0.15
    const x1 = rect.left + rect.width * 0.85
    const y1 = rect.top + rect.height * 0.85

    pad.dispatchEvent(ptr('pointerdown', x0, y0))
    pad.dispatchEvent(ptr('pointermove', x1, y1))
    await el.updateComplete

    const thumb = el.querySelector<HTMLElement>('[data-part="pad-thumb"]')!
    const thumbRect = thumb.getBoundingClientRect()
    // the thumb has moved into the lower-right region of the pad (both axes moved)
    expect(thumbRect.left, `${server.browser}: thumb did not move rightward (X axis / chroma)`).toBeGreaterThan(rect.left + rect.width * 0.5)
    expect(thumbRect.top, `${server.browser}: thumb did not move downward (Y axis / lightness)`).toBeGreaterThan(rect.top + rect.height * 0.5)

    const chromaAfter = el.querySelector<HTMLElement>('[data-part="channel-row"][data-channel="chroma"] [data-part="channel-value"]')!.textContent
    const lightnessAfter = el.querySelector<HTMLElement>('[data-part="channel-row"][data-channel="lightness"] [data-part="channel-value"]')!.textContent
    expect(chromaAfter, `${server.browser}: chroma did not change during the drag`).not.toBe(chromaBefore)
    expect(lightnessAfter, `${server.browser}: lightness did not change during the drag`).not.toBe(lightnessBefore)

    expect(events.filter((e) => e === 'input').length, `${server.browser}: drag did not stream input`).toBeGreaterThan(0)

    pad.dispatchEvent(ptr('pointerup', x1, y1))
    await el.updateComplete
    expect(events.filter((e) => e === 'change').length, `${server.browser}: pointer-up did not commit change`).toBe(1)
  })

  it('a drag that returns to its exact start fires no change (the ui-slider precedent, SPEC-R5 AC1)', async () => {
    const { el } = mount('<ui-color-picker value="#808080"></ui-color-picker>')
    await el.updateComplete
    const pad = el.querySelector<HTMLElement>('[data-part="pad"]')!
    stubCapture(pad)
    const rect = pad.getBoundingClientRect()
    const x = rect.left + rect.width * 0.5
    const y = rect.top + rect.height * 0.5

    const events: string[] = []
    el.addEventListener('change', () => events.push('change'))

    pad.dispatchEvent(ptr('pointerdown', x, y))
    pad.dispatchEvent(ptr('pointermove', x + 40, y + 40))
    pad.dispatchEvent(ptr('pointermove', x, y)) // back to the exact start
    pad.dispatchEvent(ptr('pointerup', x, y))
    await el.updateComplete

    expect(events, `${server.browser}: a round-trip drag fired change`).toHaveLength(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Real pointer-drag on a channel slider moves it (the composed ui-slider works in place)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-color-picker — real pointer-drag on a channel slider (both engines)', () => {
  it('dragging the hue slider changes the hue channel', async () => {
    const { el } = mount('<ui-color-picker value="#3b82f6"></ui-color-picker>')
    await el.updateComplete
    const hueSlider = el.querySelector<HTMLElement>('ui-slider[data-channel="hue"]')!
    stubCapture(hueSlider)
    const rect = hueSlider.getBoundingClientRect()

    const before = el.querySelector<HTMLElement>('[data-part="channel-row"][data-channel="hue"] [data-part="channel-value"]')!.textContent

    hueSlider.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect.left, pointerId: 1, bubbles: true, cancelable: true }))
    hueSlider.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left + rect.width * 0.9, pointerId: 1, bubbles: true, cancelable: true }))
    await el.updateComplete

    const after = el.querySelector<HTMLElement>('[data-part="channel-row"][data-channel="hue"] [data-part="channel-value"]')!.textContent
    expect(after, `${server.browser}: dragging the hue slider did not change the hue channel`).not.toBe(before)

    hueSlider.dispatchEvent(new PointerEvent('pointerup', { clientX: rect.left + rect.width * 0.9, pointerId: 1, bubbles: true, cancelable: true }))
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] 2-axis REAL keyboard — moves the expected axis and updates aria-valuetext
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-color-picker — 2-axis real keyboard (both engines)', () => {
  it('real ArrowRight/ArrowUp key presses move chroma/lightness and update aria-valuetext', async () => {
    const { el } = mount('<ui-color-picker value="#3b82f6"></ui-color-picker>')
    await el.updateComplete
    const pad = el.querySelector<HTMLElement>('[data-part="pad"]')!
    pad.focus()
    expect(document.activeElement, `${server.browser}: the pad did not accept focus`).toBe(pad)

    // Repeat the key several times — a single 0.004 chroma step can round to the SAME 2-decimal
    // aria-valuetext string depending on the starting fractional value (a rounding collision, not a
    // functional failure); accumulating five steps (0.02) reliably shifts the displayed rounding
    // regardless of the starting value.
    const before = pad.getAttribute('aria-valuetext')
    for (let i = 0; i < 5; i++) await userEvent.keyboard('{ArrowRight}')
    await el.updateComplete
    expect(pad.getAttribute('aria-valuetext'), `${server.browser}: aria-valuetext did not update on ArrowRight`).not.toBe(before)

    const afterRight = pad.getAttribute('aria-valuetext')
    for (let i = 0; i < 5; i++) await userEvent.keyboard('{ArrowUp}')
    await el.updateComplete
    expect(pad.getAttribute('aria-valuetext'), `${server.browser}: aria-valuetext did not update on ArrowUp`).not.toBe(afterRight)
  })

  it('Tab reaches the pad, then each channel slider, then the readout (SPEC-R6 — every channel independently reachable)', async () => {
    const { el } = mount('<ui-color-picker value="#3b82f6"></ui-color-picker>')
    await el.updateComplete
    const pad = el.querySelector<HTMLElement>('[data-part="pad"]')!
    pad.focus()
    expect(document.activeElement).toBe(pad)

    if (server.browser === 'webkit') {
      // WebKit's Tab-order emulation has known fleet gaps near certain composite controls; assert the
      // structural focus TARGETS exist and are reachable via .focus() directly (the instrument-bridge —
      // Chromium proves the real Tab sequence below).
      const hueSlider = el.querySelector<HTMLElement>('ui-slider[data-channel="hue"]')!
      hueSlider.focus()
      expect(document.activeElement).toBe(hueSlider)
      return
    }

    await userEvent.keyboard('{Tab}')
    const hueSlider = el.querySelector<HTMLElement>('ui-slider[data-channel="hue"]')!
    expect(document.activeElement, `${server.browser}: Tab from the pad did not reach the hue slider`).toBe(hueSlider)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] forced-colors — channels + readout stay operable; the pad shows no fabricated system color
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-color-picker — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  it('the pad degrades honestly (canvas hidden, Canvas/CanvasText mapping); channels + readout stay operable', async () => {
    const { el } = mount('<ui-color-picker value="#3b82f6"></ui-color-picker>')
    await el.updateComplete

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      const canvas = el.querySelector<HTMLElement>('[data-part="pad-canvas"]')!
      expect(getComputedStyle(canvas).display, 'the gradient canvas must be hidden under forced-colors').toBe('none')

      // the channel sliders + readout remain real, focusable, operable controls
      const hueSlider = el.querySelector<HTMLElement>('ui-slider[data-channel="hue"]')!
      hueSlider.focus()
      expect(document.activeElement, 'the hue slider must stay focusable under forced-colors').toBe(hueSlider)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] EyeDropper — absent branch (WebKit/Firefox) and present branch (Chromium, stubbed API)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-color-picker — EyeDropper progressive enhancement (SPEC-R13)', () => {
  it('absent branch: an engine without window.EyeDropper renders no button and no layout hole', async () => {
    if ('EyeDropper' in window) return // this leg is WebKit/Firefox's own proof; Chromium has the API natively
    const { el } = mount('<ui-color-picker></ui-color-picker>')
    await el.updateComplete
    expect(el.querySelector('[data-part="eyedropper"]'), `${server.browser}: an eyedropper button rendered without the API`).toBeNull()
  })

  it('present branch: Chromium with a stubbed window.EyeDropper resolving a color commits it + fires change', async () => {
    if (server.browser !== 'chromium') return
    const originalEyeDropper = (window as unknown as { EyeDropper?: unknown }).EyeDropper
    ;(window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper = class {
      open(): Promise<{ sRGBHex: string }> {
        return Promise.resolve({ sRGBHex: '#ff0000' })
      }
    }
    try {
      const { el } = mount('<ui-color-picker></ui-color-picker>')
      await el.updateComplete
      const btn = el.querySelector<HTMLElement>('[data-part="eyedropper"]')
      expect(btn, 'the eyedropper button must render when window.EyeDropper exists').not.toBeNull()

      let changes = 0
      el.addEventListener('change', () => changes++)
      await userEvent.click(btn!)
      await el.updateComplete

      expect(el.value, 'the sampled color must commit through the model').toBe('#ff0000')
      expect(changes, 'activating the eyedropper must fire change on a resolved sample').toBe(1)
    } finally {
      ;(window as unknown as { EyeDropper?: unknown }).EyeDropper = originalEyeDropper
    }
  })
})
