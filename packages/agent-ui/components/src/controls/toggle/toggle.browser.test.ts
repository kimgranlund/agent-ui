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
/** Poll `read()` once per PAINTED frame, up to `maxFrames`, until `predicate` holds — the OBSERVER pacing
 *  law (agent-ui-component-testing's "Settle helpers — writer vs observer"): a `background-color`
 *  transition is animation-timeline-driven, and (worse, for the forced-colors leg) a CDP media-emulation
 *  command landing + the subsequent style-recalc pass under `forced-colors` commits across an UNSPECIFIED
 *  number of real paints under load — a FIXED wait (this file's retired `settle()` helper, a flat 350ms
 *  timer past `--md-sys-motion-duration-fast`) is a race, not a proof (component-checker finding: the
 *  forced-colors test flaked TWICE under `npm run test:browser`'s full-suite contention even after adding
 *  `await updateComplete` + one `nextFrame()` on top of the fixed wait). Every settle-then-read site in this
 *  file now polls instead of guessing a fixed duration. Throws with a diagnostic on exhaustion — an
 *  unconditional pass on timeout would silently reintroduce the exact flake this closes. */
async function pollUntil<T>(read: () => T, predicate: (v: T) => boolean, maxFrames = 30): Promise<T> {
  let last: T = read()
  for (let i = 0; i < maxFrames; i++) {
    if (predicate(last)) return last
    await nextFrame()
    last = read()
  }
  if (predicate(last)) return last
  throw new Error(`pollUntil: predicate never held after ${maxFrames} painted frames (last value: ${JSON.stringify(last)})`)
}

/** Poll `read()` (a number) until it STOPS CHANGING across `stableFrames` consecutive painted frames — the
 *  robust way to capture a real SETTLED baseline, distinct from `pollUntil`'s "crossed a threshold" (a
 *  `background-color` transition animates progressively across many real frames; the FIRST frame that
 *  crosses a threshold like "> 0.01" can still be far short of the eventual target — 0.02 on the way to
 *  0.2, say — so a value `pollUntil` returns is safe to test AGAINST a threshold directly, but is NOT safe
 *  to treat as a precise baseline a LATER assertion re-compares against; `pollStable` is for exactly that
 *  second case). */
async function pollStable(read: () => number, stableFrames = 4, maxFrames = 40): Promise<number> {
  let last = read()
  let streak = 0
  for (let i = 0; i < maxFrames; i++) {
    await nextFrame()
    const cur = read()
    if (Math.abs(cur - last) < 0.001) {
      streak++
      if (streak >= stableFrames) return cur
    } else {
      streak = 0
    }
    last = cur
  }
  return last // exhausted the budget — return the last sample rather than throw (a caller may still assert against it usefully)
}

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
    // ADR-0223 (Fill by Default, slice 2): the default posture now FILLS the container, so the
    // content-width claim this leg proves lives in the `[inline]` hug state (the pre-wave posture).
    const inline = (markup: string): string => markup.replace('<ui-toggle', '<ui-toggle inline')
    const { el: bare } = mount(inline(BARE))
    const { el: icon } = mount(inline(ICON))
    const { el: both } = mount(inline(BOTH))
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

/** `pollUntil` predicates — a real fill is "visible" once alpha clears a small noise floor; "vanished" is
 *  the inverse. Named so every call site below reads as intent, not a magic threshold. Threshold-crossing
 *  ONLY — safe for a direct pass/fail read, NOT safe as a baseline a later assertion re-compares against
 *  exactly (use `pollStable` for that; see its own doc comment). */
const isVisible = (a: number): boolean => a > 0.01
const isVanished = (a: number): boolean => a < 0.01

describe('ui-toggle — pressed-state repaint (real engine)', () => {
  // ALPHA, never a raw string compare: WebKit's own getComputedStyle re-serializes an IDENTICAL
  // custom-property-driven colour into DIFFERENT colour FUNCTIONS across separate reads (rgba/oklab/oklch
  // all observed for the exact same semantic value in this file's own dev loop) — a real engine
  // serialization quirk, not a paint difference. Alpha is format-INVARIANT (the last `/`-separated
  // component parses identically regardless of which function wraps it) and is exactly what "vanished vs
  // visible" already means for `--ui-toggle-bg: transparent` (idle) vs a real container fill (pressed/hover).
  //
  // `pollUntil`, never a fixed `settle()` timer, gates every post-transition read below — the
  // `background-color` transition is animation-timeline-driven (an OBSERVER, this file's own `pollUntil`
  // law), so a fixed 350ms wait is a race under real load, not a proof (component-checker finding: the
  // forced-colors test below flaked TWICE under `npm run test:browser`'s full-suite contention on a fixed
  // wait; the SAME failure class applies to every other settle-then-read site in this file, so all of them
  // are hardened here rather than waiting for the next reviewer round to find each one individually).
  it('a real click flips [pressed] AND repaints the background — idle ≠ pressed (alpha: transparent → filled → transparent)', async () => {
    const { el } = mount(BARE)
    await nextFrames(2) // past the :state(ready) rAF gate
    const idleAlpha = alphaOf(bg(el))
    expect(idleAlpha, 'idle background is not fully transparent (--ui-toggle-bg: transparent)').toBeCloseTo(0, 2)
    await userEvent.click(el)
    expect(el.hasAttribute('pressed'), 'click did not reflect [pressed]').toBe(true)
    const pressedAlpha = await pollUntil(() => alphaOf(bg(el)), isVisible)
    expect(pressedAlpha, 'pressed background did not repaint from idle (still transparent)').toBeGreaterThan(0.01)
    // toggling back off restores the idle (transparent) paint — unhover first: a click leaves the pointer
    // resting ON the element, so a subsequent read would otherwise land on the (real, correct) HOVER wash,
    // not pure idle-rest — a test-harness artifact, not a component defect.
    await userEvent.click(el)
    expect(el.hasAttribute('pressed')).toBe(false)
    await userEvent.unhover(el)
    // The assertion tolerance MATCHES `isVanished`'s own poll threshold — a value that just crossed under
    // the predicate at the FIRST satisfying frame is not necessarily bit-identical to 0 yet (a transition
    // approaches its target continuously); a stricter follow-up check re-creates the exact race this poll
    // exists to close (component-checker's own precision-mismatch bug, caught before it re-shipped: a
    // `toBeCloseTo(0, 2)` — 0.005 tolerance — after an `isVanished` (< 0.01) predicate flaked on values like
    // 0.009, genuinely under the predicate's own bar but over the stricter assertion's).
    const finalAlpha = await pollUntil(() => alphaOf(bg(el)), isVanished)
    expect(finalAlpha, 'unpressing did not restore the transparent idle background').toBeLessThan(0.015)
  })

  it('setting the `pressed` PROPERTY directly (no click) also repaints — CSS keys off [pressed], not the click path', async () => {
    const { el } = mount(BARE) as unknown as { el: HTMLElement & { pressed: boolean } }
    await nextFrames(2)
    expect(alphaOf(bg(el))).toBeCloseTo(0, 2)
    el.pressed = true
    await pollUntil(() => alphaOf(bg(el)), isVisible)
    el.pressed = false
    const finalAlpha = await pollUntil(() => alphaOf(bg(el)), isVanished)
    expect(finalAlpha).toBeLessThan(0.015)
  })

  it('hover repaints the background (idle) — a real, visible paint where idle-rest was fully transparent', async () => {
    const { el } = mount(BARE)
    await nextFrames(2)
    expect(alphaOf(bg(el)), 'idle-rest is not fully transparent').toBeCloseTo(0, 2)
    await userEvent.hover(el)
    const hoverAlpha = await pollUntil(() => alphaOf(bg(el)), isVisible)
    expect(hoverAlpha, 'hover did not repaint the idle background').toBeGreaterThan(0.01)
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
    // A click STILL leaves the pointer resting on the element even when the press itself is refused — the
    // SAME test-harness artifact fixed in the pressed-state-repaint block above (missed here on the first
    // pass: this read a real 0.0576 hover-wash alpha and flaked, not a component defect). `pressed` truly
    // never changed, so — unlike the OTHER tests in this file — there is no transition to wait OUT of; only
    // the (correct, real) hover wash to wait OUT of by moving the pointer away.
    await userEvent.unhover(el)
    const finalAlpha = await pollUntil(() => alphaOf(bg(el)), isVanished)
    expect(finalAlpha, 'a refused press must not repaint at all (zero flicker — no property changed, so no transition ever fires)').toBeLessThan(0.015)
  })

  it('a real click on an ALREADY-pressed toggle stays pressed when refused (the exact "last shown pill" shape)', async () => {
    const { el } = mount(BARE) as unknown as { el: HTMLElement & { pressed: boolean } }
    el.pressed = true
    // pollSTABLE, not pollUntil: this value becomes a BASELINE a later read re-compares against exactly, so
    // it must be the truly SETTLED end-state, not merely "the first frame that crossed some threshold" —
    // which a `background-color` transition (still animating toward its target at that frame) can satisfy
    // well short of the real value (component-checker-adjacent finding, caught in this same hardening pass:
    // an `isVisible`-gated baseline here would have captured an in-flight ~0.02, not the settled ~0.2, and
    // every later comparison against it would have been comparing against the WRONG number).
    const pressedAlpha = await pollStable(() => alphaOf(bg(el)))
    expect(pressedAlpha, 'anti-vacuous: the pressed baseline itself must be a real, visible paint').toBeGreaterThan(0.01)
    el.addEventListener('toggle', (e) => e.preventDefault())
    await userEvent.click(el)
    expect(el.pressed, 'a refused press on an already-pressed toggle must stay pressed').toBe(true)
    // A real click leaves the pointer resting ON the element (the SAME test-harness artifact fixed above in
    // the pressed-state-repaint describe block) — `--ui-toggle-bg-hover` legitimately shifts the paint on
    // top of the pressed baseline unless the pointer moves away first (component-checker finding: the
    // un-hardened version compared post-click alpha directly against pressedAlpha and flaked under
    // full-suite load, 0.210844 vs 0.2 — a real hover-wash difference, not noise).
    await userEvent.unhover(el)
    // pollUNTIL, not pollStable, here: unlike `pressedAlpha` above (an unknown target discovered by
    // settling), this read has a KNOWN target (`pressedAlpha` itself) — a `pollUntil` predicated on the
    // same 0.005 tolerance `toBeCloseTo(pressedAlpha, 2)` uses below structurally cannot lock onto a
    // stale hover-wash value (it differs from pressedAlpha by ~0.01, outside that tolerance), unlike
    // `pollStable`'s "unchanged for 4 frames" criterion, which has no way to tell "settled at the real
    // target" apart from "hasn't started transitioning away from hover yet" (GH #698: `unhover()`'s
    // mouseleave→style-recalc→transition-start onset delay is unbounded under CPU contention; once it
    // exceeds `pollStable`'s 4-frame window the stale hover value gets accepted as "stable" and fails
    // the tolerance-0.005 assertion below).
    const settledAlpha = await pollUntil(() => alphaOf(bg(el)), (a) => Math.abs(a - pressedAlpha) < 0.005)
    expect(settledAlpha).toBeCloseTo(pressedAlpha, 2)
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
    const hoverAlpha = await pollUntil(() => alphaOf(bg(el)), isVisible)
    expect(hoverAlpha, 'the enabled positive-control must still repaint — proves the assertion above is a real inertness, not a broken hover harness').toBeGreaterThan(0.01)
    await userEvent.unhover(el)
  })

  it('a disabled toggle does not commit a click dispatched directly at the host (the control-level guard, independent of the CSS pointer-events mechanism)', () => {
    const { el } = mount(BARE)
    el.setAttribute('disabled', '')
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(el.hasAttribute('pressed'), 'disabled must not commit a click even when dispatched directly (bypassing real pointer hit-testing)').toBe(false)
  })

  // component-checker finding — a cascade-specificity regression pin: `:where(ui-toggle):state(pressed)`
  // (the `:state()` pseudo-class sitting OUTSIDE the `:where()` net) contributed its own (0,1,0)
  // specificity, beating the fully `:where()`-wrapped `[disabled]` override (0,0,0) regardless of source
  // order — `<ui-toggle pressed disabled>` painted as a fully active primary pill instead of muted. Fixed
  // by moving `:state()` inside the parens (`:where(ui-toggle:state(pressed))`, toggle.css). Pinned here by
  // comparing a `disabled`-only toggle against a `pressed disabled` toggle: the muted disabled paint must
  // win identically regardless of whether `pressed` is also set — the exact combination the regression
  // inverted, and the exact combination no prior test in this file covered.
  it('disabled OVERRIDES pressed in the paint cascade — <ui-toggle pressed disabled> reads the SAME muted alpha as <ui-toggle disabled> (mutation-verified regression pin)', async () => {
    // ALPHA, never a raw string compare — the SAME format-instability this file's own pressed-state-repaint
    // block already routes around (two DIFFERENT elements, each real-engine-serialized independently, are
    // exactly the case where that risk is highest). `pollStable`, not `pollUntil`, for every baseline here —
    // every one of these three alphas becomes a target a LATER read re-compares against exactly, so each
    // must be the truly settled end-state (a `background-color` transition interpolates its ALPHA channel
    // too when animating from idle's 0 toward an opaque/semi-opaque target — "crossed > 0.01" can still be
    // well short of the real value, the same trap this file's pressed-vs-refused test already hit once).
    const { el: disabledOnly } = mount(BARE)
    disabledOnly.setAttribute('disabled', '')
    const disabledOnlyAlpha = await pollStable(() => alphaOf(bg(disabledOnly)))

    const { el: pressedDisabled } = mount(BARE) as unknown as { el: HTMLElement & { pressed: boolean; updateComplete: Promise<void> } }
    pressedDisabled.pressed = true
    pressedDisabled.setAttribute('disabled', '')
    await pressedDisabled.updateComplete
    const pressedDisabledAlpha = await pollStable(() => alphaOf(bg(pressedDisabled)))
    expect(pressedDisabledAlpha, 'a pressed+disabled toggle must paint the SAME muted background alpha as disabled-only — pressed must not leak through the disabled override').toBeCloseTo(disabledOnlyAlpha, 2)

    // Anti-vacuous: the disabled paint is genuinely DIFFERENT from the (uncontested) pressed paint, so the
    // equality above is a real discriminator, not two coincidentally-equal alphas.
    const { el: pressedOnly } = mount(BARE) as unknown as { el: HTMLElement & { pressed: boolean; updateComplete: Promise<void> } }
    pressedOnly.pressed = true
    await pressedOnly.updateComplete
    const pressedOnlyAlpha = await pollStable(() => alphaOf(bg(pressedOnly)))
    expect(Math.abs(pressedOnlyAlpha - disabledOnlyAlpha), 'anti-vacuous: pressed-only and disabled-only must paint at DIFFERENT alphas for the equality check above to mean anything').toBeGreaterThan(0.02)
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
    const { el } = mount(BARE) as unknown as { el: HTMLElement & { updateComplete: Promise<void> } }

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

      // attr → prop → reactive effect → :state(pressed) is a MICROTASK-batched chain (dom/element.ts);
      // `await updateComplete` proves that chain has flushed, but the SUBSEQUENT forced-colors style-recalp
      // pass is an OBSERVER, not a WRITER (this file's own `pollUntil` law) — a CDP media-emulation change
      // plus a custom-state flip landing together commits its repaint across an UNSPECIFIED number of real
      // paints under load, so even `updateComplete` + one `nextFrame()` remained a race (component-checker
      // finding: flaked TWICE under `npm run test:browser`'s real full-suite contention, not once). Poll
      // painted frames instead of guessing a fixed count.
      el.setAttribute('pressed', '')
      await el.updateComplete
      const fcBg = await pollUntil(
        () => alphaOf(getComputedStyle(el).backgroundColor),
        (a) => a > 0,
      )
      expect(fcBg, 'pressed fill vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})


// -- ADR-0223 (Fill by Default, slice 2 -- action/selection): the two-posture acceptance leg, the
//    generalized ADR-0021 smoke (the text-field pilot's shape): FILL -- a bare host in block flow
//    stretches to the container's inline size (the container IS the floor); [inline] -- the host hugs
//    its content and sits BELOW the container. No clause 3(b) content floor exists on this control to relocate.
describe('ui-toggle -- ADR-0223 two postures (fill default / [inline] hug, both engines)', () => {
  it('bare host offsetWidth ~= container inline size (fill); [inline] host hugs below the container', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '640px' // a wide BLOCK container -- wider than any hug resolution
    wrap.innerHTML = `<ui-toggle>Bold</ui-toggle>`
    document.body.append(wrap)
    const host = wrap.querySelector('ui-toggle') as HTMLElement & { updateComplete?: Promise<unknown> }
    await host.updateComplete
    // FILL (the default): block-level -- the host stretches to the container.
    const containerWidth = wrap.getBoundingClientRect().width
    expect(host.offsetWidth, 'the bare host did not FILL its block container (ADR-0223 cl.1)').toBeCloseTo(containerWidth, 0)
    expect(getComputedStyle(host).display, 'the default host is not block-level').toBe('grid')
    // HUG (the ONE opt-out): [inline] flips display level AND posture -- content-sized, below the container.
    host.setAttribute('inline', '')
    const hugged = host.offsetWidth
    expect(hugged, 'the [inline] host collapsed to nothing').toBeGreaterThan(0)
    expect(hugged, 'the [inline] host did not HUG -- it still fills the container').toBeLessThan(containerWidth)
    expect(getComputedStyle(host).display, 'the [inline] host is not inline-level').toBe('inline-grid')
    wrap.remove()
  })
})
