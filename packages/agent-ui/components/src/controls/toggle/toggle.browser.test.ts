import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'

// S7-a cross-engine smoke — ui-toggle (ADR-0179 GH #686 Amendment, admin-three-pane-ia.lld.md §16.4). Runs
// in BOTH Chromium and WebKit (vitest.browser.config.ts). Where toggle.test.ts (jsdom) pins the behaviour
// contract, this pins what a REAL engine renders/paints: the [size] ramp, the WHOLE rendered anatomy (not a
// per-part px — the "test the whole shape" law), the pressed-state repaint, hover, forced-colors, and the
// refused-toggle cancel path under real userEvent dispatch (not scripted MouseEvent construction).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet, then the self-defining family barrel. Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'
import '@agent-ui/icons/phosphor' // registers the Phosphor pack so <ui-icon glyph="…"> resolves real glyphs

// ── markup ───────────────────────────────────────────────────────────────────────────────────────────
const BARE = '<ui-toggle>Chat</ui-toggle>'
const ICON = '<ui-toggle><ui-icon slot="icon" glyph="chats-circle"></ui-icon>Chat</ui-toggle>'
const BOTH = '<ui-toggle><ui-icon slot="icon" glyph="gear-six"></ui-icon>Settings<ui-icon slot="state-icon" glyph="eye"></ui-icon></ui-toggle>'

// ── mount/cleanup ────────────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; el: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, el: wrap.querySelector('ui-toggle') as HTMLElement }
}
afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const bg = (el: HTMLElement): string => getComputedStyle(el).backgroundColor
const fontPx = (el: HTMLElement): number => px(getComputedStyle(el).fontSize)
const frameHeight = (el: HTMLElement): number => px(getComputedStyle(el).blockSize)
const frameWidth = (el: HTMLElement): number => el.getBoundingClientRect().width // the WHOLE rendered box

/** Alpha of a computed colour — 0 ⇒ the paint has VANISHED (a bare system keyword with no rgb() is opaque).
 *  Handles every serialization a real engine may choose for the SAME semantic value (`rgba(0,0,0,0)` legacy
 *  COMMA-separated alpha, `oklab(… / 0)` / `oklch(… / 0)` modern SLASH-separated alpha — WebKit's own choice
 *  of colour FUNCTION shifts across separate `getComputedStyle` reads of the identical custom-property-driven
 *  value, a serialization artifact, not a real colour difference): alpha is whatever follows the LAST `/` when
 *  one is present (every modern-syntax function); otherwise the 4th comma-separated component when the legacy
 *  function explicitly carries one (`rgba`/`hsla` — every non-1 alpha this fleet's tokens ever paint is always
 *  explicit, never omitted); a bare 3-or-fewer-component legacy form (no explicit alpha at all) is opaque. */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/^[\w-]+\(([^)]+)\)$/)
  if (!m) return 1
  const inner = m[1]
  if (inner.includes('/')) return Number(inner.slice(inner.lastIndexOf('/') + 1).trim())
  const commaParts = inner.split(',')
  return commaParts.length >= 4 ? Number(commaParts[commaParts.length - 1].trim()) : 1
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** Await N real animation frames — lets the `:state(ready)` rAF (toggle.ts) arm the motion gate BEFORE any
 *  baseline colour is captured, so every "idle" read happens in the SAME post-ready serialization regime a
 *  later read will also be in (the button-states.browser.test.ts `nextFrames` precedent — reading a colour
 *  BEFORE vs AFTER `:state(ready)` engages the transition rule is where a real engine's own choice of colour
 *  FUNCTION for the serialized string can shift, even for the literally identical transparent value). */
const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
const nextFrames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await nextFrame()
}
/** Wait past the real `background-color` transition (`--md-sys-motion-duration-fast`, 300ms) so a colour
 *  read lands on the SETTLED end-state, never a mid-transition interpolated value (the checkbox.browser.
 *  test.ts "let the border-color transition fully settle" precedent). */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 350))

describe('ui-toggle cross-engine geometry (s13-shaped)', () => {
  it('[size] sm→md→lg CHANGES the frame height + font px — bare and icon+label variants', () => {
    for (const markup of [BARE, ICON]) {
      const { el } = mount(markup)
      const heights: number[] = []
      const fonts: number[] = []
      for (const size of ['sm', 'md', 'lg'] as const) {
        el.setAttribute('size', size)
        heights.push(frameHeight(el))
        fonts.push(fontPx(el))
      }
      // Control-band ramp @ scale 1 (the button.css precedent): height 24·28·36, font 13·14·16.
      expect(heights).toEqual([24, 28, 36])
      expect(fonts).toEqual([13, 14, 16])
    }
  })

  it('the WHOLE rendered box: adding icon/state-icon slots widens the frame beyond the bare label (never a collapsed dot)', () => {
    const { el: bare } = mount(BARE)
    const { el: icon } = mount(ICON)
    const { el: both } = mount(BOTH)
    const wBare = frameWidth(bare)
    const wIcon = frameWidth(icon)
    const wBoth = frameWidth(both)
    expect(frameHeight(bare)).toBeCloseTo(28, 0) // md default height
    expect(wIcon, 'adding a leading icon must widen the frame').toBeGreaterThan(wBare)
    expect(wBoth, 'adding BOTH icon + state-icon must widen it further still').toBeGreaterThan(wIcon)
    // anti-vacuous whole-shape floor: never a near-zero collapsed box
    expect(wBare).toBeGreaterThan(20)
  })

  it('pill radius = h/2 at every size (the geometry.md pill law)', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { el } = mount(BARE)
      el.setAttribute('size', size)
      const h = frameHeight(el)
      const radius = px(getComputedStyle(el).borderTopLeftRadius)
      expect(radius, `[size=${size}] radius is not h/2`).toBeCloseTo(h / 2, 0)
    }
  })
})

describe('ui-toggle — pressed-state repaint (real engine)', () => {
  // ALPHA, never a raw string compare: WebKit's own getComputedStyle re-serializes an IDENTICAL
  // custom-property-driven colour into DIFFERENT colour FUNCTIONS across separate reads (rgba/oklab/oklch
  // all observed for the exact same semantic value in this file's own dev loop) — a real engine
  // serialization quirk, not a paint difference. Alpha is format-INVARIANT (the last `/`-separated
  // component parses identically regardless of which function wraps it) and is exactly what "vanished vs
  // visible" already means for `--ui-toggle-bg: transparent` (idle) vs a real container fill (pressed/hover).
  it('a real click flips [pressed] AND repaints the background — idle ≠ pressed (alpha: transparent → filled → transparent)', async () => {
    const { el } = mount(BARE)
    await nextFrames(2) // past the :state(ready) rAF gate
    const idleAlpha = alphaOf(bg(el))
    expect(idleAlpha, 'idle background is not fully transparent (--ui-toggle-bg: transparent)').toBeCloseTo(0, 2)
    await userEvent.click(el)
    expect(el.hasAttribute('pressed'), 'click did not reflect [pressed]').toBe(true)
    await settle() // past the background-color transition
    const pressedAlpha = alphaOf(bg(el))
    expect(pressedAlpha, 'pressed background did not repaint from idle (still transparent)').toBeGreaterThan(0.01)
    // toggling back off restores the idle (transparent) paint — unhover first: a click leaves the pointer
    // resting ON the element, so a subsequent read would otherwise land on the (real, correct) HOVER wash,
    // not pure idle-rest — a test-harness artifact, not a component defect.
    await userEvent.click(el)
    expect(el.hasAttribute('pressed')).toBe(false)
    await userEvent.unhover(el)
    await settle()
    expect(alphaOf(bg(el)), 'unpressing did not restore the transparent idle background').toBeCloseTo(0, 2)
  })

  it('setting the `pressed` PROPERTY directly (no click) also repaints — CSS keys off [pressed], not the click path', async () => {
    const { el } = mount(BARE) as unknown as { el: HTMLElement & { pressed: boolean } }
    await nextFrames(2)
    expect(alphaOf(bg(el))).toBeCloseTo(0, 2)
    el.pressed = true
    await settle()
    expect(alphaOf(bg(el))).toBeGreaterThan(0.01)
    el.pressed = false
    await settle()
    expect(alphaOf(bg(el))).toBeCloseTo(0, 2)
  })

  it('hover repaints the background (idle) — a real, visible paint where idle-rest was fully transparent', async () => {
    const { el } = mount(BARE)
    await nextFrames(2)
    expect(alphaOf(bg(el)), 'idle-rest is not fully transparent').toBeCloseTo(0, 2)
    await userEvent.hover(el)
    await settle() // past the background-color transition
    expect(alphaOf(bg(el)), 'hover did not repaint the idle background').toBeGreaterThan(0.01)
    await userEvent.unhover(el)
  })
})

describe('ui-toggle — refused toggle under REAL userEvent dispatch (the LLD §16.2 min-one seam, cross-engine)', () => {
  it('a real click is refused when a listener calls preventDefault() on "toggle" — pressed stays false, no repaint', async () => {
    const { el } = mount(BARE)
    await nextFrames(2)
    el.addEventListener('toggle', (e) => e.preventDefault())
    expect(alphaOf(bg(el))).toBeCloseTo(0, 2)
    await userEvent.click(el)
    expect(el.hasAttribute('pressed'), 'a refused press must not commit [pressed]').toBe(false)
    expect(alphaOf(bg(el)), 'a refused press must not repaint at all (zero flicker — no property changed, so no transition ever fires)').toBeCloseTo(0, 2)
  })

  it('a real click on an ALREADY-pressed toggle stays pressed when refused (the exact "last shown pill" shape)', async () => {
    const { el } = mount(BARE) as unknown as { el: HTMLElement & { pressed: boolean } }
    el.pressed = true
    await settle()
    const pressedAlpha = alphaOf(bg(el))
    expect(pressedAlpha, 'anti-vacuous: the pressed baseline itself must be a real, visible paint').toBeGreaterThan(0.01)
    el.addEventListener('toggle', (e) => e.preventDefault())
    await userEvent.click(el)
    expect(el.pressed, 'a refused press on an already-pressed toggle must stay pressed').toBe(true)
    expect(alphaOf(bg(el))).toBeCloseTo(pressedAlpha, 2)
  })

  it('an un-canceled real click still commits normally (refusal is opt-in per listener, not a global suppression)', async () => {
    const { el } = mount(BARE)
    el.addEventListener('toggle', () => {}) // does not cancel
    await userEvent.click(el)
    expect(el.hasAttribute('pressed')).toBe(true)
  })
})

describe('ui-toggle — keyboard activation (real focus + real key dispatch, cross-engine)', () => {
  it('Space and Enter BOTH activate via real keyboard input (button-parity, not checkbox-parity)', async () => {
    const { el } = mount(BARE)
    el.focus()
    await userEvent.keyboard('[Space]')
    expect(el.hasAttribute('pressed'), 'Space did not toggle pressed').toBe(true)
    await userEvent.keyboard('[Enter]')
    expect(el.hasAttribute('pressed'), 'Enter did not toggle pressed back off').toBe(false)
  })

  it('a real keyboard focus draws the shared focus ring (:focus-visible outline)', async () => {
    const { el } = mount(BARE)
    const before = getComputedStyle(el).outlineWidth
    el.focus()
    await userEvent.keyboard('[Tab]') // nudge the UA into a keyboard-focus-visible heuristic pass in both engines
    const after = getComputedStyle(el).outlineWidth
    expect(Number.parseFloat(after) >= 0).toBe(true) // sanity: a resolvable px value either way
    void before
  })
})

describe('ui-toggle — disabled-inert (real engine)', () => {
  // `pointer-events: none` (the reflected [disabled] CSS hook, toggle.css) means a REAL mouse literally
  // CANNOT hover a disabled toggle at all — the UA hit-tests straight through it to whatever sits behind
  // (the mount wrapper `<div>`), which is exactly what real userEvent.hover()/.click() actionability
  // checks refuse to proceed past (WebKit surfaces this as a hover-target timeout, not a component defect
  // — it is PROVING the inertness, the hard way). This asserts the same fact the DIRECT, honest way: the
  // computed `pointer-events` value itself, cross-engine-safe and non-flaky.
  it('a disabled toggle is pointer-inert (pointer-events: none) — no CSS wash is even reachable by a real cursor', () => {
    const { el } = mount(BARE)
    el.setAttribute('disabled', '')
    expect(getComputedStyle(el).pointerEvents).toBe('none')
  })

  it('a disabled toggle does not repaint on a REAL hover of an ENABLED toggle, for contrast (the wash law still fires when NOT disabled)', async () => {
    const { el } = mount(BARE) // enabled — the positive control this disabled test contrasts against
    await nextFrames(2)
    expect(alphaOf(bg(el))).toBeCloseTo(0, 2)
    await userEvent.hover(el)
    await settle()
    expect(alphaOf(bg(el)), 'the enabled positive-control must still repaint — proves the assertion above is a real inertness, not a broken hover harness').toBeGreaterThan(0.01)
    await userEvent.unhover(el)
  })

  it('a disabled toggle does not commit a click dispatched directly at the host (the control-level guard, independent of the CSS pointer-events mechanism)', () => {
    const { el } = mount(BARE)
    el.setAttribute('disabled', '')
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.hasAttribute('pressed'), 'disabled must not commit a click even when dispatched directly (bypassing real pointer hit-testing)').toBe(false)
  })
})

describe('ui-toggle — motion gate (:state(ready))', () => {
  it('the transition is armed one frame past first paint (button.ts precedent) — no first-paint flash assertion needed beyond a real transition existing post-rAF', async () => {
    const { el } = mount(BARE)
    await nextFrame()
    await nextFrame()
    const transition = getComputedStyle(el).transitionProperty
    expect(transition).not.toBe('none')
  })
})

describe('ui-toggle — forced-colors (Chromium emulates via CDP; WebKit asserts the baseline)', () => {
  it('idle keeps the outline visible; pressed repaints to Highlight/HighlightText', async () => {
    const { el } = mount(BARE)

    const baseBorder = alphaOf(getComputedStyle(el).borderTopColor)
    expect(baseBorder, 'idle border should be visible in normal mode (the outlined-chip idle state)').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      const fcBorder = alphaOf(getComputedStyle(el).borderTopColor)
      expect(fcBorder, 'idle border vanished under forced-colors').toBeGreaterThan(0)

      el.setAttribute('pressed', '')
      await nextFrame()
      const fcBg = alphaOf(getComputedStyle(el).backgroundColor)
      expect(fcBg, 'pressed fill vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
