import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'

// Wave-2 s17 — the CROSS-ENGINE interaction-states + focus-ring + caret smoke (the REALIZE re-score; the
// adversarial real-engine proof of ADR-0008 states / ADR-0009 focus ring / ADR-0012 + geometry-sizing-spec
// §6 BTN-CARET). Sibling to button-geometry.browser.test.ts (s13, the geometry PROOF) — same harness, same
// load-bearing CSS order, runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright
// instances). Where the jsdom css/geometry probes pin the DECLARED rules, this pins what a real engine
// actually PAINTS — the hover/active background flip, the keyboard-only focus outline, and the font-sized
// caret — which jsdom structurally cannot resolve (no @scope, no light-dark(), no :focus-visible heuristic,
// no real layout). It is ANTI-VACUOUS: a state genuinely REPAINTS where the law says it must.
//
// Engine-split policy (the established harness convention, mirrored from the s13 forced-colors leg): drive
// what the engine + the @vitest/browser input API allow in BOTH engines (real `:hover`, real keyboard
// focus); reach the Chromium-only legs (forced-colors emulation) through `cdp()` and assert a WebKit
// BASELINE there. The per-scheme RISK-1 ladder diagnostic resolves the token chain directly (cross-engine,
// no pseudo-state needed) so the light/dark collapse is provable identically in both engines.
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet, then the self-defining family barrel. Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

// ── mount/cleanup ────────────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; btn: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, btn: wrap.querySelector('ui-button') as HTMLElement }
}
afterEach(async () => {
  await userEvent.unhover(document.body) // drop any held hover so it cannot bleed into the next test
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const bg = (el: HTMLElement): string => getComputedStyle(el).backgroundColor // serialized used colour
const fontPx = (el: HTMLElement): number => px(getComputedStyle(el).fontSize)
const frameHeight = (el: HTMLElement): number => px(getComputedStyle(el).blockSize)

/** Alpha of a computed colour — 0 ⇒ the paint has VANISHED (a bare system keyword with no rgb() is opaque). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/**
 * Resolve a `--ui-button-*` colour token to its serialized used colour UNDER a chosen `color-scheme` —
 * without entering any pseudo-state. A throwaway probe span (a child of the host, so it inherits the host's
 * `--ui-button-*` chain) sets its own `color-scheme`, so `light-dark()` inside the token resolves to that
 * branch on the probe. This is the cross-engine way to read the per-scheme ladder step (RISK-1).
 */
const resolveToken = (host: HTMLElement, tokenVar: string, scheme: 'light' | 'dark'): string => {
  const probe = document.createElement('span')
  probe.style.colorScheme = scheme
  probe.style.background = `var(${tokenVar})`
  host.append(probe)
  const c = bg(probe)
  probe.remove()
  return c
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** Await N real animation frames — used to let the `:state(ready)` rAF (button.ts) arm the motion gate. */
const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
const nextFrames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await nextFrame()
}

const VARIANTS = ['solid', 'soft', 'ghost'] as const

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] Per-variant interaction states — the REAL hover repaint (ADR-0008)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-button states — per-variant :hover repaint (ADR-0008, both engines)', () => {
  for (const variant of VARIANTS) {
    it(`[variant=${variant}] :hover repaints background to --ui-button-bg-hover (≠ idle)`, async () => {
      const { btn } = mount(`<ui-button variant="${variant}">Label</ui-button>`)
      const idle = bg(btn)
      // headless engines default to a LIGHT page (prefers-color-scheme: light) → the live colours resolve on
      // the light branch; baseline-check that the idle paint IS the resolved light idle token (the @scope rule
      // truly drives `background`, not a UA default), so the change assertion below cannot be vacuous.
      expect(idle, `[${variant}] idle bg should be the resolved --ui-button-bg`).toBe(
        resolveToken(btn, '--ui-button-bg', 'light'),
      )

      const wantHover = resolveToken(btn, '--ui-button-bg-hover', 'light')
      await userEvent.hover(btn)
      // MOTION-AWARE read: once `:state(ready)` is armed, the hover repaint FADES over --ui-motion-fast
      // (300ms), so a bare getComputedStyle right after hover would read a MID-FADE colour. Poll until the
      // background SETTLES on the exact hover token — the anti-vacuous proof the `:scope:hover { background:
      // var(--ui-button-bg-hover) }` wiring genuinely repaints (not just that two tokens differ), read at the
      // settled value (not an intermediate). The [5] Motion block proves the fade itself is real + gated.
      await expect.poll(() => bg(btn), { timeout: 1500 }).toBe(wantHover)
      expect(bg(btn), `[${variant}] :hover did not change the painted background`).not.toBe(idle)
      await userEvent.unhover(btn)
    })
  }
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] RISK-1 (RESOLVED) — the per-scheme solid idle→hover→active ladder is three distinct steps
// ════════════════════════════════════════════════════════════════════════════════════════════════════
//
// The tok-states amendment (ADR-0008's foreseen path) gave the solid fill DEDICATED --md-sys-color-primary-hover/
// -active roles instead of the --md-sys-color-primary-dim/-high pairing. Source now: solid `-bg-hover`=
// `--md-sys-color-primary-hover`, `-bg-active`=`--md-sys-color-primary-active`. They resolve to a real three-step ladder in BOTH
// schemes — LIGHT 550 → 650 → 750, DARK 450 → 400 → 350 — so idle ≠ hover ≠ active everywhere. The earlier
// collapse (LIGHT hover==active, both light-dark()-ing onto --md-sys-color-primary-650) is GONE. This probe resolves the
// chain per scheme and proves the full three-step ladder empirically in BOTH engines (the REALIZE leg of
// ADR-0008): a pressed solid button now reads distinct from a hovered one in light too.
//
// These reads are TRANSITION-IMMUNE by construction: `resolveToken` measures a throwaway probe span that is
// not a `ui-button` and never enters `:state(ready)`, so its background is the statically-resolved token —
// never a mid-fade value. The hover/active diagnosis is the SETTLED ladder colour, not an intermediate.

describe('ui-button states — RISK-1 solid idle→hover→active ladder per color-scheme (both engines)', () => {
  it('DARK: solid idle → hover → active are three DISTINCT ladder steps', () => {
    const { btn } = mount('<ui-button variant="solid">Label</ui-button>')
    const idle = resolveToken(btn, '--ui-button-bg', 'dark')
    const hover = resolveToken(btn, '--ui-button-bg-hover', 'dark')
    const active = resolveToken(btn, '--ui-button-bg-active', 'dark')
    // the REALIZE requirement: in dark the three states are genuinely three colours (real ladder separation).
    expect(hover, `dark solid hover==active (ladder collapsed in dark): ${hover}`).not.toBe(active)
    expect(hover, 'dark idle did not lift on hover').not.toBe(idle)
    expect(active, 'dark idle did not lift on active').not.toBe(idle)
  })

  it('LIGHT: solid idle → hover → active are three DISTINCT ladder steps (RISK-1 collapse FIXED — tok-states)', () => {
    const { btn } = mount('<ui-button variant="solid">Label</ui-button>')
    const idle = resolveToken(btn, '--ui-button-bg', 'light')
    const hover = resolveToken(btn, '--ui-button-bg-hover', 'light')
    const active = resolveToken(btn, '--ui-button-bg-active', 'light')
    // both states lift off idle (550 → 650 / 750) — the control reacts in light.
    expect(hover, 'light idle did not lift on hover').not.toBe(idle)
    expect(active, 'light idle did not lift on active').not.toBe(idle)
    // …and hover ≠ active now: the dedicated --md-sys-color-primary-hover/-active roles (650 vs 750) split the former
    // --md-sys-color-primary-650 collapse, so a pressed solid button reads distinct from a hovered one in LIGHT too. This
    // is the flipped RISK-1 tripwire (was the KNOWN escalation; the tok-states ladder resolved it) — if a
    // regression re-collapses these onto one step, this assertion fails RED.
    expect(hover, 'light solid hover==active — the RISK-1 --md-sys-color-primary-650 collapse has regressed').not.toBe(active)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Focus ring — keyboard-only outline, forced-colors survival, layout-neutral (ADR-0009)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

const ringDrawn = (el: HTMLElement): boolean => {
  const cs = getComputedStyle(el)
  return cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0 && alphaOf(cs.outlineColor) > 0
}

describe('ui-button focus ring (ADR-0009, both engines)', () => {
  it('KEYBOARD focus (Tab) draws the --md-sys-color-focus-ring outline; the geometry is layout-NEUTRAL', async () => {
    const { btn } = mount('<ui-button>Label</ui-button>') // tabbable trait → tabindex=0 on connect
    const beforeH = frameHeight(btn)
    const beforeW = btn.getBoundingClientRect().width

    await userEvent.tab() // real Tab → keyboard modality → :focus-visible matches
    expect(document.activeElement, 'Tab did not land on the button').toBe(btn)

    const cs = getComputedStyle(btn)
    expect(cs.outlineStyle, 'no focus outline style on keyboard focus').toBe('solid')
    expect(px(cs.outlineWidth), 'focus outline width is not the 2px ring').toBeCloseTo(2, 0)
    expect(alphaOf(cs.outlineColor), 'focus ring colour vanished').toBeGreaterThan(0)

    // ADR-0009 layout-neutral claim: the outline does NOT perturb box geometry (it is painted outside the box).
    expect(frameHeight(btn), 'focus ring changed the frame height').toBeCloseTo(beforeH, 1)
    expect(btn.getBoundingClientRect().width, 'focus ring changed the frame width').toBeCloseTo(beforeW, 1)
  })

  it('MOUSE click does NOT draw the ring (:focus-visible keyboard-only contract)', async () => {
    const { btn } = mount('<ui-button>Label</ui-button>')
    await userEvent.click(btn) // pointer modality → :focus-visible must NOT match
    expect(document.activeElement, 'click did not focus the button').toBe(btn)
    // The keyboard-only contract: a mouse click focuses but draws no ring. Engine heuristics for
    // :focus-visible on a non-native tabindex host can differ — report per engine if one paints a ring.
    expect(ringDrawn(btn), `${server.browser}: a mouse click drew the focus ring (:focus-visible matched on pointer)`).toBe(false)
  })

  it('forced-colors keeps the keyboard ring — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const { btn } = mount('<ui-button>Label</ui-button>')
    await userEvent.tab()
    expect(document.activeElement, 'Tab did not land on the button').toBe(btn)
    // baseline (BOTH engines): the keyboard ring is drawn in normal mode.
    expect(ringDrawn(btn), 'no keyboard ring in normal mode').toBe(true)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented split) — assert we are genuinely NOT
      // in forced-colors (so the Chromium proof below is not silently faked) and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      // the ring SURVIVES forced-colors: `--md-sys-color-focus-ring → Highlight` keeps a visible outline (the WHCM ring is
      // free — the outline still paints, resolved to the system focus colour). WebKit's rounded-outline-on-pill
      // caveat is out of scope — a VISIBLE ring is the requirement, not perfect pill rounding.
      expect(ringDrawn(btn), 'the focus ring vanished under forced-colors').toBe(true)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] BTN-CARET — the trailing caret renders at FONT, not icon size (ADR-0012 / §6, RISK-3)
// ════════════════════════════════════════════════════════════════════════════════════════════════════
//
// The law (geometry-sizing-spec §4.1/§4.6, probe BTN-CARET): a trailing `data-role="caret"` is an INLINE
// AFFORDANCE sized `= font` (--ui-button-glyph), centered in the icon-sized CELL, landing ½(h−font) from the
// edge — while a `data-role="icon"` content glyph FILLS the icon-sized cell. The cell stays icon-sized for
// BOTH roles (position places, role sizes). The named bug class is a caret rendered at --ui-ind (icon size).
// We measure the GLYPH CONTENT box (cell border-box minus its centering padding), NOT the cell border-box.

const contentInline = (cell: HTMLElement): number => {
  const cs = getComputedStyle(cell)
  return cell.getBoundingClientRect().width - px(cs.paddingInlineStart) - px(cs.paddingInlineEnd)
}

describe('ui-button BTN-CARET — caret = font, icon = icon (ADR-0012 §6, both engines)', () => {
  it('caret(content) ≈ font < icon(content) ≈ box-icon ≤ box; the caret centers at ½(h−font)', () => {
    // one button carrying BOTH roles: a leading content icon + a trailing caret affordance.
    const { btn } = mount(
      '<ui-button><span slot="leading" data-role="icon">●</span>Label<svg slot="trailing" data-role="caret"></svg></ui-button>',
    )
    const icon = btn.querySelector('[data-role="icon"]') as HTMLElement
    const caret = btn.querySelector('[data-role="caret"]') as HTMLElement

    const font = fontPx(btn) //              md font = 14
    const box = frameHeight(btn) //          md frame (border-box height) = 28
    const iconCell = caret.getBoundingClientRect().width // the cell border-box, icon-sized = --ui-button-icon = 18
    const caretContent = contentInline(caret) // glyph content box = cell − centering pad = font
    const iconContent = contentInline(icon) //   content icon fills its cell (pad 0) = icon

    // the cell is icon-sized for BOTH roles (placement); the icon glyph fills it; the caret glyph is font-sized.
    expect(iconContent, 'content icon did not fill its icon-sized cell').toBeCloseTo(iconCell, 0)
    expect(caretContent, 'caret content box is not font-sized (the named --ui-ind oversize bug)').toBeCloseTo(font, 0)
    // the ordering law: 0 < caret(=font) < icon ≤ box.
    expect(caretContent, 'caret content box is not positive').toBeGreaterThan(0)
    expect(caretContent, 'caret is not strictly smaller than the icon').toBeLessThan(iconContent)
    expect(font, 'font is not strictly smaller than the icon cell').toBeLessThan(iconCell)
    expect(iconCell, 'the icon cell exceeds the box height').toBeLessThanOrEqual(box + 0.5)

    // centering: the caret glyph is inset ½(icon−font) within its icon-sized cell (symmetric), so it lands the
    // EMERGENT ½(h−font) from the host's trailing edge = host pad-end ½(h−icon) + the cell's own ½(icon−font).
    const cellCs = getComputedStyle(caret)
    const cellPadStart = px(cellCs.paddingInlineStart)
    const cellPadEnd = px(cellCs.paddingInlineEnd)
    expect(cellPadStart, 'caret is not centered in its cell (asymmetric inset)').toBeCloseTo(cellPadEnd, 1)
    expect(cellPadEnd, 'caret cell inset is not ½(icon−font)').toBeCloseTo((iconCell - font) / 2, 1)

    const hostPadEnd = px(getComputedStyle(btn).paddingInlineEnd) // [label│trailing] trailing slot edge = ½(h−icon)
    expect(hostPadEnd + cellPadEnd, 'caret does not land ½(h−font) from the host edge').toBeCloseTo((box - font) / 2, 1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] Motion — the gated :state(ready) state-paint transition (interaction-states standard)
// ════════════════════════════════════════════════════════════════════════════════════════════════════
//
// button.css transitions ONLY the state-PAINT properties (background-color · color · border-color) over
// --ui-motion-fast, behind `:scope:state(ready)`; button.ts arms `ready` ONE FRAME PAST first paint (rAF in
// connected()). The intent: the upgrade/first paint SNAPS to its colour (no first-render fade-in), and only
// SUBSEQUENT state changes animate. Geometry + the focus outline are NEVER transitioned (they snap); reduced
// motion zeroes it. jsdom cannot evaluate `:state(ready)`/the CustomStateSet at all — this is the cross-engine
// proof. (--ui-motion-fast is read empirically, not hard-coded — it is 300ms in the shipped dimensions.css.)

const transDurMs = (el: HTMLElement): number => px(getComputedStyle(el).transitionDuration) * 1000

/**
 * Await every `transitionrun` event fired on `el` from ONE style recalc — a DETERMINISTIC proof that a CSS
 * transition actually started, unlike sampling `getAnimations()`/`getComputedStyle` synchronously right
 * after a mutation: the CSS Transitions spec does not guarantee the UA has begun the transition by the time
 * script resumes (starting a transition is a queued "update the rendering" step, not a synchronous side
 * effect of the style write) — under parallel full-suite load that step can lag past the synchronous read,
 * which is exactly the ~40% flake this replaces. Collects EVERY property that starts transitioning from the
 * same recalc (a colour change can transition several paint props at once) by resetting a short settle-timer
 * on each event and resolving once no further event arrives within it; rejects with a legible message if
 * nothing fires within `timeoutMs` (well under the suite's default per-test timeout).
 */
function awaitTransitionRuns(el: HTMLElement, timeoutMs = 2000): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const props: string[] = []
    let settle: ReturnType<typeof setTimeout> | undefined
    const cleanup = (): void => {
      clearTimeout(bail)
      if (settle) clearTimeout(settle)
      el.removeEventListener('transitionrun', onRun)
    }
    const onRun = (e: Event): void => {
      props.push((e as TransitionEvent).propertyName)
      if (settle) clearTimeout(settle)
      settle = setTimeout(() => {
        cleanup()
        resolve(props)
      }, 50) // batches near-simultaneous transitionrun events from the same recalc
    }
    const bail = setTimeout(() => {
      cleanup()
      reject(new Error(`no transitionrun fired on ${el.tagName} within ${timeoutMs}ms`))
    }, timeoutMs)
    el.addEventListener('transitionrun', onRun)
  })
}

describe('ui-button motion — gated :state(ready) paint transition (both engines)', () => {
  it('first paint SNAPS (no transition pre-ready), then :state(ready) ARMS the transition', async () => {
    const { btn } = mount('<ui-button variant="solid">Label</ui-button>')
    // SYNCHRONOUSLY after mount, before the rAF fires: no transition is armed → the control is at its idle
    // colour instantly (the first-paint snap — never a fade-in from a default/transparent).
    expect(transDurMs(btn), 'a transition was armed at first paint (would fade-in on load)').toBe(0)
    expect(bg(btn), 'idle colour is not present instantly on load (it faded in)').toBe(
      resolveToken(btn, '--ui-button-bg', 'light'),
    )
    // one frame past first paint, button.ts adds the `ready` custom state → the transition arms.
    await nextFrames(2)
    expect(transDurMs(btn), ':state(ready) did not arm the transition').toBeGreaterThan(0)
  })

  it('once armed, a colour change ANIMATES a paint property — NOT geometry or the outline', async () => {
    const { btn } = mount('<ui-button variant="solid">Label</ui-button>')

    // BEFORE ready: a colour change does NOT spawn a running transition (the pre-ready snap), proven via the
    // Web Animations view of CSS transitions — getAnimations() stays empty.
    btn.setAttribute('variant', 'soft')
    void getComputedStyle(btn).backgroundColor // force a style flush so any transition would have started
    expect(btn.getAnimations().length, 'a colour change animated BEFORE :state(ready)').toBe(0)

    btn.setAttribute('variant', 'solid') // reset, then arm
    await nextFrames(2)
    expect(transDurMs(btn), 'transition not armed after :state(ready)').toBeGreaterThan(0)

    // AFTER ready: the same colour change now spawns a running CSS transition on a PAINT property — proven by
    // the `transitionrun` EVENT (fires deterministically once the UA starts the transition), not a
    // getAnimations()/getComputedStyle sample taken at an arbitrary instant right after the mutation (the
    // race that flaked ~40% under parallel-suite load — see awaitTransitionRuns above).
    const runs = awaitTransitionRuns(btn)
    btn.setAttribute('variant', 'soft')
    const animatedProps = await runs
    expect(animatedProps.length, 'a colour change did NOT animate after :state(ready)').toBeGreaterThan(0)
    expect(
      animatedProps.some((p) => p === 'background-color' || p === 'color' || p === 'border-color'),
      'the running transition is not a state-paint property',
    ).toBe(true)
    // the standard: geometry + the focus ring SNAP — they must never appear in the transition list.
    const declared = getComputedStyle(btn).transitionProperty
    expect(declared, 'outline is transitioned (the focus ring must snap)').not.toContain('outline')
    expect(declared, 'block-size is transitioned (geometry must snap)').not.toContain('block-size')
    expect(animatedProps, 'the outline is animating (the focus ring must snap)').not.toContain('outline')
  })

  it('reduced-motion ZEROES the transition — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const { btn } = mount('<ui-button>Label</ui-button>')
    await nextFrames(2) // arm :state(ready)
    expect(transDurMs(btn), 'transition not armed in normal mode').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP media emulation (the documented split) — assert we are genuinely NOT in
      // reduced-motion (so the Chromium proof is not silently faked), and stop.
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
      // the @media (prefers-reduced-motion: reduce) block sets `transition: none` even with `:state(ready)`.
      expect(transDurMs(btn), 'reduced-motion did not zero the state transition').toBe(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
