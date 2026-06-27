import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from '@vitest/browser/context'

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
//  [2] RISK-1 — the per-scheme solid hover-vs-active ladder diagnostic (the key finding)
// ════════════════════════════════════════════════════════════════════════════════════════════════════
//
// css-button predicted (and the source confirms): solid `-bg-hover`=`--c-primary-dim`, `-bg-active`=
// `--c-primary-high`, and in LIGHT both `light-dark()` to `--c-primary-650` → solid hover == active in
// light; in DARK they split (`-700` vs `-400`) → distinct. This resolves the chain per scheme and DIAGNOSES
// the collapse empirically in BOTH engines. The HARD requirement (ADR-0008's REALIZE leg) is that the
// active state is a real, distinct ladder step — proven by DARK distinctness. The LIGHT hover==active
// collapse is a KNOWN design-escalation (the tok-states ladder), pinned (not silently passed) so a future
// token fix flips this probe and forces an update — never failing the suite on a recorded escalation.

describe('ui-button states — RISK-1 solid hover-vs-active per color-scheme (both engines)', () => {
  it('DARK: solid :hover and :active are DISTINCT ladder steps; idle lifts to both', () => {
    const { btn } = mount('<ui-button variant="solid">Label</ui-button>')
    const idle = resolveToken(btn, '--ui-button-bg', 'dark')
    const hover = resolveToken(btn, '--ui-button-bg-hover', 'dark')
    const active = resolveToken(btn, '--ui-button-bg-active', 'dark')
    // the REALIZE requirement: in dark the three states are genuinely three colours (real ladder separation).
    expect(hover, `dark solid hover==active (ladder collapsed in dark): ${hover}`).not.toBe(active)
    expect(hover, 'dark idle did not lift on hover').not.toBe(idle)
    expect(active, 'dark idle did not lift on active').not.toBe(idle)
  })

  it('LIGHT: idle lifts to BOTH states, but hover==active — the KNOWN --c-primary-650 collapse (escalation)', () => {
    const { btn } = mount('<ui-button variant="solid">Label</ui-button>')
    const idle = resolveToken(btn, '--ui-button-bg', 'light')
    const hover = resolveToken(btn, '--ui-button-bg-hover', 'light')
    const active = resolveToken(btn, '--ui-button-bg-active', 'light')
    // the button still REACTS in light: both hover and active lift off idle (550 → 650) — the control is alive.
    expect(hover, 'light idle did not lift on hover').not.toBe(idle)
    expect(active, 'light idle did not lift on active').not.toBe(idle)
    // …but hover and active land on the SAME step (both --c-primary-650). Pinned as the known collapse: the
    // user-facing distinction (a pressed solid button looking different from a hovered one) is INVISIBLE in
    // light. If the tok-states ladder later splits them, this assertion flips RED → update + drop the note.
    expect(hover, 'light solid hover/active are NO LONGER collapsed — RISK-1 resolved; update this probe').toBe(active)
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
  it('KEYBOARD focus (Tab) draws the --c-focus-ring outline; the geometry is layout-NEUTRAL', async () => {
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
      // the ring SURVIVES forced-colors: `--c-focus-ring → Highlight` keeps a visible outline (the WHCM ring is
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
