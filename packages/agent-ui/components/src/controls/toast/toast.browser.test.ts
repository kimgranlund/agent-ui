import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UIToastElement } from './toast.ts'

// toast.browser.test.ts — the cross-engine browser-truth smoke for ui-toast (feed-family.lld.md §10 ·
// SPEC-N2: jsdom is blind to real timers, WHCM, and painted geometry). Covers:
//   [1] WHOLE-SHAPE — a populated toast in an unstyled flex row paints a real, non-collapsed box
//   [2] Focus neutrality — document.activeElement is UNCHANGED across a show() (never steals focus)
//   [3] Tab-order reachability — the action/close ui-button parts are reachable via real Tab
//   [4] Real-duration expiry — a real setTimeout auto-dismisses at `duration`
//   [5] Real pause-on-hover — a real userEvent.hover pauses the countdown past its raw duration
//   [6] forced-colors — the card border survives WHCM (Chromium via CDP; WebKit baseline)
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles FIRST, then the button/icon
// sheets (the toast's own child parts), then the toast sheet, then the self-defining modules.
// Imported DIRECTLY (relative), NOT via the component-styles barrel (that's LLD-C11, a later wave).
import '@agent-ui/components/foundation-styles.css'
import '../button/button.css'
import '../icon/icon.css'
import './toast.css'
import '../button/button.ts'
import '../icon/icon.ts'
import './toast.ts'

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ── mount/cleanup ────────────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

/** Mount a ui-toast into a realistic doc-specimen container (a display:flex row — the
 *  test-the-whole-shape law). */
function mount(markup: string): { wrap: HTMLElement; el: UIToastElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.style.padding = '20px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-toast') as UIToastElement
  return { wrap, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) mounted.pop()?.remove()
})

const waitMs = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ── [1] whole-shape ──────────────────────────────────────────────────────────────────────────────

describe('ui-toast — whole-shape: a populated card paints a real, non-collapsed box (test-the-whole-shape)', () => {
  it('renders a non-zero box with the fixed 20em inline-size (not collapsed in a flex row)', () => {
    const { el } = mount('<ui-toast duration="0">File uploaded.</ui-toast>')
    const rect = el.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
    // 20em at the default 16px root font — allow engine sub-pixel rounding slack.
    expect(rect.width).toBeCloseTo(320, -1)
  })

  it('the message, action, and close parts all occupy real, non-zero areas', () => {
    const { el } = mount('<ui-toast duration="0" action="Undo">Something happened.</ui-toast>')
    for (const part of ['message', 'action', 'close']) {
      const node = el.querySelector(`[data-part="${part}"]`) as HTMLElement
      const rect = node.getBoundingClientRect()
      expect(rect.width, `[data-part="${part}"] has zero width`).toBeGreaterThan(0)
      expect(rect.height, `[data-part="${part}"] has zero height`).toBeGreaterThan(0)
    }
  })
})

// ── [2] focus neutrality + [3] tab-order reachability ───────────────────────────────────────────

describe('ui-toast — never takes focus on show; affordances are reachable via normal Tab order', () => {
  it('document.activeElement is UNCHANGED across a show() (append into the DOM)', () => {
    const before = document.activeElement
    const { el } = mount('<ui-toast duration="0" action="Undo">Something happened.</ui-toast>')
    expect(document.activeElement).toBe(before)
    void el
  })

  it('Tab reaches the action button, then the close button, in document order', async () => {
    const anchor = document.createElement('button')
    anchor.textContent = 'anchor'
    document.body.append(anchor)
    mounted.push(anchor)
    const { el } = mount('<ui-toast duration="0" action="Undo">Something happened.</ui-toast>')
    const actionBtn = el.querySelector('[data-part="action"]') as HTMLElement
    const closeBtn = el.querySelector('[data-part="close"]') as HTMLElement

    anchor.focus()
    expect(document.activeElement).toBe(anchor)
    await userEvent.tab()
    expect(document.activeElement).toBe(actionBtn)
    await userEvent.tab()
    expect(document.activeElement).toBe(closeBtn)
  })
})

// ── [4] real-duration expiry + [5] real pause-on-hover ──────────────────────────────────────────

describe('ui-toast — real-duration auto-dismiss + pause-on-hover (real timers, real pointer events)', () => {
  it('auto-dismisses ~duration ms after connect (real setTimeout)', async () => {
    const { el } = mount('<ui-toast duration="150">bye</ui-toast>')
    let closed = false
    el.addEventListener('close', () => { closed = true })
    await waitMs(80)
    expect(closed).toBe(false)
    await waitMs(150)
    expect(closed).toBe(true)
    expect(el.isConnected).toBe(false)
  })

  it('a real hover pauses the countdown — the toast survives well past its raw duration while hovered', async () => {
    // A generous duration + an early hover — Playwright's own hover() actionability checks can take a
    // couple hundred ms on a cold context, so the raw countdown must have plenty of headroom left when
    // hover() resolves (a short duration here previously raced hover() itself, closing the toast out
    // from under it).
    const { el } = mount('<ui-toast duration="1500">bye</ui-toast>')
    let closed = false
    el.addEventListener('close', () => { closed = true })
    await userEvent.hover(el) // hover immediately — well before the 1500ms countdown could expire
    await waitMs(2000) // far past the raw 1500ms duration — paused, must not have closed
    expect(closed).toBe(false)
    await userEvent.unhover(el)
    await waitMs(1700) // past the remaining ~1500ms
    expect(closed).toBe(true)
  })
})

// ── [6] forced-colors ────────────────────────────────────────────────────────────────────────────

describe('ui-toast — forced colors (the border carries the card edge once the box-shadow vanishes)', () => {
  it('the card border survives under forced-colors — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const { el } = mount('<ui-toast duration="0">bye</ui-toast>')

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const borderColor = getComputedStyle(el).borderTopColor
      expect(borderColor, 'the card border vanished under forced-colors').not.toBe('rgba(0, 0, 0, 0)')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
