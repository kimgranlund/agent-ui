import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from '@vitest/browser/context'

// s11 (geometry leg) — the CROSS-ENGINE geometry smoke for ui-text-field (decomp g4-g6 node s11). Where the
// jsdom text-field-geometry.test.ts (s9) pins the DECLARED calc()s, this pins the RENDERED px a real engine
// resolves — and it is ANTI-VACUOUS: it asserts the px genuinely CHANGE where the sizing law says they must
// (across [size] and [scale]), not a vacuous equal-to-self. Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts → the two playwright instances). Sibling to button-geometry.browser.test.ts (G5
// s13) — same harness, same load-bearing CSS order.
//
// The laws under proof (references/geometry.md — the field is a Control-class component, ADR-0014):
//   • FRAME ∝ height — the host block-size rides [size] and [scale] (--ui-scale).
//   • EDITOR FONT ∝ font — the contenteditable editor's font rides the same [size]/[scale] ramp.
//   • VALUE EDGE = h/2 — the value-side inline pad is half the frame height (the per-edge formula); a leading
//     adornment's slot edge is ½(h − icon). Proven on BOTH the bare and the leading-icon variants.
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet (text-field's :where() token block + @scope geometry), then the self-defining
// family barrel (registers ui-text-field). Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

// Minimal CDP session interface for forced-colors emulation (Chromium only — WebKit has no CDP emulation).
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ── markup: the two variants the smoke proves in parallel (the editor is control-injected on connect) ───
const BARE = '<ui-text-field></ui-text-field>' //                                       slotless — value edge h/2 both sides
const ICON = '<ui-text-field><span slot="leading" data-role="icon">●</span></ui-text-field>' // leading slot edge ½(h−icon)

// ── mount/cleanup: each field rides a wrapper carrying the [scale] ancestor attribute (dimensions.css keys
// off bare `[scale="…"]`; the custom props inherit down to the host). ──────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; field: HTMLElement; editor: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const field = wrap.querySelector('ui-text-field') as HTMLElement
  const editor = field.querySelector('[data-part="editor"]') as HTMLElement // created on connect (append above)
  return { wrap, field, editor }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

// ── computed-px reads (a real engine resolves the --ui-text-field-* token chain to used lengths) ────────
const px = (v: string): number => Number.parseFloat(v)
const frameHeight = (field: HTMLElement): number => px(getComputedStyle(field).blockSize) // the vertical lever
const fontPx = (el: HTMLElement): number => px(getComputedStyle(el).fontSize)
const padStartPx = (field: HTMLElement): number => px(getComputedStyle(field).paddingInlineStart)
const padEndPx = (field: HTMLElement): number => px(getComputedStyle(field).paddingInlineEnd)

const allDistinct = (xs: number[]): boolean => new Set(xs.map((x) => x.toFixed(2))).size === xs.length
const allEqual = (xs: number[]): boolean => new Set(xs.map((x) => x.toFixed(2))).size === 1

describe('ui-text-field cross-engine geometry smoke (s11, both engines)', () => {
  it('[size] sm→md→lg CHANGES the frame height + the editor font px — on BOTH the bare and leading-icon variants', () => {
    for (const markup of [BARE, ICON]) {
      const { field, editor } = mount(markup)
      const heights: number[] = []
      const fonts: number[] = []
      for (const size of ['sm', 'md', 'lg'] as const) {
        field.setAttribute('size', size)
        heights.push(frameHeight(field))
        fonts.push(fontPx(editor)) // the editor font rides --ui-text-field-font (the centre value cell)
      }
      // the control-band ramp @ scale 1 (geometry-sizing-spec §1): height 24·28·36, font 13·14·16.
      expect(heights[0]).toBeCloseTo(24, 0)
      expect(heights[1]).toBeCloseTo(28, 0)
      expect(heights[2]).toBeCloseTo(36, 0)
      expect(fonts[0]).toBeCloseTo(13, 0)
      expect(fonts[1]).toBeCloseTo(14, 0)
      expect(fonts[2]).toBeCloseTo(16, 0)
      // anti-vacuous: the three steps are genuinely DISTINCT px — the [size] lever truly moved the frame + font.
      expect(allDistinct(heights), `heights did not change across [size]: ${heights.join()}`).toBe(true)
      expect(allDistinct(fonts), `editor fonts did not change across [size]: ${fonts.join()}`).toBe(true)
    }
  })

  it('[scale] ui-sm→content-lg CHANGES the frame height + the editor font px — on BOTH variants (ADR-0038 explicit §1-row lookup)', () => {
    // Kim's explicit (scale × size) table (ADR-0038 clause 1): each cell is one §1 row; no multiplier.
    // md column sampled at 3 tiers: ui-sm→24 (row 24→f13), ui-md→28 (row 28→f14, default), content-lg→48 (row 48→f18).
    // The OLD multiplier heights (24.5, 49) are gone — Kim's §1 rows are exact integers.
    // Editor font = §1-SET integers from the explicit font table (also ADR-0038; unchanged for these three tiers).
    for (const markup of [BARE, ICON]) {
      const { wrap, field, editor } = mount(markup) // size stays md (default)
      const heights: number[] = []
      const fonts: number[] = []
      for (const scale of ['ui-sm', 'ui-md', 'content-lg'] as const) {
        wrap.setAttribute('scale', scale)
        heights.push(frameHeight(field))
        fonts.push(fontPx(editor))
      }
      // ADR-0038 md column: ui-sm→24, ui-md→28, content-lg→48 (§1 rows, exact integers — no multiplier decimals)
      expect(heights[0]).toBeCloseTo(24, 1)  // was 24.5 (28×0.875 multiplier) — Kim's §1 row 24
      expect(heights[1]).toBeCloseTo(28, 1)
      expect(heights[2]).toBeCloseTo(48, 1)  // was 49 (28×1.75 multiplier) — Kim's §1 row 48
      // Editor font — §1-SET integers (unchanged for these three tiers: 13·14·18)
      expect(fonts[0]).toBeCloseTo(13, 0)
      expect(fonts[1]).toBeCloseTo(14, 0)
      expect(fonts[2]).toBeCloseTo(18, 0)
      // anti-vacuous: all three sampled tiers produce distinct heights and fonts
      expect(allDistinct(heights), `heights did not change across [scale]: ${heights.join()}`).toBe(true)
      expect(allDistinct(fonts), `editor fonts did not change across [scale]: ${fonts.join()}`).toBe(true)
    }
  })

  it('BARE: the value edge == h/2 on BOTH inline sides (the slotless value-edge formula)', () => {
    const { field } = mount(BARE) // md frame @ scale 1 → h = 28, value edge = 14 each side
    const h = frameHeight(field)
    expect(padStartPx(field), 'leading value edge is not h/2').toBeCloseTo(h / 2, 1)
    expect(padEndPx(field), 'trailing value edge is not h/2').toBeCloseTo(h / 2, 1)
    // anti-vacuous: the edge tracks the frame — it really is half of a positive frame height.
    expect(h, 'frame height is not a positive px').toBeGreaterThan(0)
  })

  it('LEADING-ICON: the trailing value edge == h/2 and the leading slot edge == ½(h−icon); 0 < icon ≤ box', () => {
    // icon = var(--ui-icon-md) = 18px at default scale (ADR-0038 / ADR-0035 conformance: text-field now reads
    // the shared --ui-icon-* table, dropping the old calc(18px * var(--ui-scale)) local formula).
    const { field } = mount(ICON) // md @ scale 1 → h = 28, icon = 18, slot edge = ½(28−18) = 5, value edge = 14
    const leadingCell = field.querySelector('[slot="leading"]') as HTMLElement
    const h = frameHeight(field)
    const icon = leadingCell.getBoundingClientRect().width // the icon-sized slot cell (--ui-text-field-icon)

    expect(padEndPx(field), 'trailing value edge is not h/2').toBeCloseTo(h / 2, 1)
    expect(padStartPx(field), 'leading slot edge is not ½(h−icon)').toBeCloseTo((h - icon) / 2, 1)
    // the icon ramp law: 0 < icon ≤ box (the cell never exceeds the frame).
    expect(icon, 'icon cell is not a positive px').toBeGreaterThan(0)
    expect(icon, 'the icon cell exceeds the box height').toBeLessThanOrEqual(h + 0.5)
    // anti-vacuous: the two edges are genuinely DIFFERENT px (the slot edge is smaller than the value edge),
    // so the per-edge ½(h−icon) vs h/2 split is real — not both collapsing onto one pad.
    expect(padStartPx(field), 'the slot edge did not differ from the value edge (per-edge formula collapsed)').toBeLessThan(
      padEndPx(field),
    )
  })

  // ── ADR-0021: the entry-control min-inline-size floor (native <input size> parity) ──────────────────────
  it('BARE+unsized: carries the min-inline-size typing-width floor — offsetWidth ≥ the resolved ~20ch, NOT the ~0 collapse', () => {
    const { field } = mount(BARE) // no [size], empty — the exact case the s11 smoke caught collapsing the 1fr editor cell
    const floorPx = px(getComputedStyle(field).minInlineSize) // 20ch resolves to an absolute px on a real engine
    // the floor resolved to a real, substantial typing width (native <input size> parity), not a zero/symbolic value.
    expect(floorPx, 'the --ui-text-field-min-inline-size floor did not resolve to a positive px').toBeGreaterThan(0)
    // the bare field's box is held open to AT LEAST the floor — a real pointer can land on it.
    const withFloor = field.offsetWidth
    expect(withFloor, 'the bare field is narrower than its min-inline-size floor').toBeGreaterThanOrEqual(Math.floor(floorPx))
    // NON-VACUOUS — the floor is load-bearing: REMOVE it (host min-inline-size → 0) and the unsized 1fr editor
    // collapses the box back to just its frame chrome, far below the floor (the ~0 typing sliver this fixes). So
    // the assertion above is not vacuously true of any field — it FAILS if the floor is gone.
    field.style.minInlineSize = '0'
    const withoutFloor = field.offsetWidth
    expect(withoutFloor, 'removing the floor did NOT shrink the field below the floor — the floor is not load-bearing').toBeLessThan(
      floorPx,
    )
    expect(withFloor - withoutFloor, 'the floor did not meaningfully widen the bare field').toBeGreaterThan(20)
  })

  // ── ADR-0006 / geometry.md: [density] rides the rhythm (the slot↔editor gap), NEVER the frame (C6 polish) ──
  it('[density] compact→spacious CHANGES the adornment↔editor column-gap (--ui-text-field-gap); the BARE frame is INVARIANT', () => {
    // density multiplies the ONE rhythm quantity (the slot↔editor column-gap) on the leading-icon grid, while the
    // frame (block-size + the h/2 value edges) holds — the sharp ADR-0006 split, mirrored from the button smoke.
    const icon = mount(ICON) // size stays md (default); the `auto 1fr` grid carries the column-gap
    const gaps: number[] = []
    for (const density of ['compact', 'comfortable', 'spacious'] as const) {
      icon.wrap.setAttribute('density', density)
      gaps.push(px(getComputedStyle(icon.field).columnGap)) // the slot↔editor rhythm
    }
    // gap_md = font_md / 2 × --ui-density = 7 × {0.5, 1, 1.5} @ scale 1 (the one density-bearing quantity).
    expect(gaps[0]).toBeCloseTo(3.5, 1)
    expect(gaps[1]).toBeCloseTo(7, 1)
    expect(gaps[2]).toBeCloseTo(10.5, 1)
    // anti-vacuous: the three gaps are genuinely DISTINCT px — [density] truly moved the rhythm.
    expect(allDistinct(gaps), `the column-gap did not change across [density]: ${gaps.join()}`).toBe(true)

    // the COMPLEMENTARY invariant: density rides the gap ONLY — the BARE field's frame must NOT move (geometry.md).
    const bare = mount(BARE)
    const heights: number[] = []
    const valueEdges: number[] = []
    for (const density of ['compact', 'comfortable', 'spacious'] as const) {
      bare.wrap.setAttribute('density', density)
      heights.push(frameHeight(bare.field))
      valueEdges.push(padStartPx(bare.field))
    }
    expect(allEqual(heights), `[density] moved the bare frame height: ${heights.join()}`).toBe(true)
    expect(allEqual(valueEdges), `[density] moved the bare h/2 value edge: ${valueEdges.join()}`).toBe(true)
  })

  // ── ADR-0036: single-line control line-height = font (the editor cell) ─────────────────────────────────
  it('ADR-0036 line-height = font: computed line-height on the editor equals the editor font-size', () => {
    // ADR-0036 law: the editor (`[data-part=editor]`) sets line-height: var(--ui-control-line-height) = 1
    // (declared in text-field.css, consuming the fleet token from dimensions.css). The line box collapses to
    // the em height and the host grid centers it — no phantom inherited leading from an ancestor body (1.5).
    // AC1 proof: computed line-height px == computed editor font-size px. Sampled at two sizes for anti-vacuity.
    const { field: fieldMd, editor: edMd } = mount(BARE)
    fieldMd.setAttribute('size', 'md')
    const fontMd = fontPx(edMd)
    const lhMd = px(getComputedStyle(edMd).lineHeight)
    expect(lhMd, 'editor md line-height is not equal to editor font-size (ADR-0036)').toBeCloseTo(fontMd, 0)

    const { field: fieldSm, editor: edSm } = mount(BARE)
    fieldSm.setAttribute('size', 'sm')
    const fontSm = fontPx(edSm)
    const lhSm = px(getComputedStyle(edSm).lineHeight)
    expect(lhSm, 'editor sm line-height is not equal to editor font-size (ADR-0036)').toBeCloseTo(fontSm, 0)

    // anti-vacuous: the two sizes render different font/line-height
    expect(fontMd, 'md and sm editor fonts must differ so the line-height proof is non-vacuous').not.toBe(fontSm)
  })
})

// ── Wave 3 (ADR-0044): auto-adornment geometry + password masking + reveal + forced-colors ──────────────
// (a) Each auto-adornment cell renders at var(--ui-text-field-font) per [size]×[scale] — EXACT px, anti-
//     vacuous (adornment font genuinely tracks the ramp, not a fixed size-blind value).
// (b) type=password: the editor -webkit-text-security is disc (the password mask).
// (c) The reveal button flips -webkit-text-security to none and back.
// (d) Under forced-colors, forced-color-adjust:none keeps adornment ink visible (Chromium CDP only — WebKit
//     has no CDP emulation support).
// All tests run on BOTH engines; the forced-colors segment is Chromium-only with a WebKit baseline fallback.

describe('ui-text-field Wave-3 auto-adornment geometry + password masking (s11 Wave-3, both engines)', () => {
  it('search type: magnifier + clear-button font-size == --ui-text-field-font across [size] — EXACT px', () => {
    // The magnifier (leading-adornment) and clear-button (inside trailing-adornment) both carry
    // font-size: var(--ui-text-field-font) or inherit it. Proved at all three [size] stops with EXACT
    // integers (sm→13, md→14, lg→16 px at default scale — the §1 ramp from ADR-0038).
    const { field, editor } = mount('<ui-text-field type="search"></ui-text-field>')
    const magnifier = field.querySelector('[data-part="leading-adornment"]') as HTMLElement
    const clearBtn = field.querySelector('[data-part="clear-button"]') as HTMLElement

    for (const [size, expectedFont] of [['sm', 13], ['md', 14], ['lg', 16]] as [string, number][]) {
      field.setAttribute('size', size)
      const ef = fontPx(editor)
      expect(ef, `editor font at size=${size} must be ${expectedFont}px`).toBeCloseTo(expectedFont, 0)
      expect(fontPx(magnifier), `magnifier font at size=${size} must equal editor font`).toBeCloseTo(ef, 0)
      expect(fontPx(clearBtn), `clear-button font at size=${size} must equal editor font`).toBeCloseTo(ef, 0)
    }
    // anti-vacuous: the adornment font GENUINELY CHANGES across sizes (not a fixed, size-blind font)
    field.setAttribute('size', 'sm'); const smF = fontPx(magnifier)
    field.setAttribute('size', 'lg'); const lgF = fontPx(magnifier)
    expect(lgF, 'adornment font did not change between sm and lg (size-blind — font-size: var() not applied)').toBeGreaterThan(smF)
  })

  it('number type: step-up / step-down font-size == --ui-text-field-font at each [size]', () => {
    // The stepper buttons inherit from [data-part="trailing-adornment"] which carries
    // font-size: var(--ui-text-field-font). The button reset rule (font: inherit) passes it through.
    const { field, editor } = mount('<ui-text-field type="number"></ui-text-field>')
    const stepUp = field.querySelector('[data-part="step-up"]') as HTMLElement
    const stepDown = field.querySelector('[data-part="step-down"]') as HTMLElement

    for (const [size, expectedFont] of [['sm', 13], ['md', 14], ['lg', 16]] as [string, number][]) {
      field.setAttribute('size', size)
      const ef = fontPx(editor)
      expect(ef).toBeCloseTo(expectedFont, 0)
      expect(fontPx(stepUp), `step-up font at size=${size} must equal editor font`).toBeCloseTo(ef, 0)
      expect(fontPx(stepDown), `step-down font at size=${size} must equal editor font`).toBeCloseTo(ef, 0)
    }
  })

  it('[scale] content-lg: adornment font tracks the elevated §1-row — EXACT px at md size', () => {
    // ADR-0038 md×content-lg = 18px (explicit §1-row table, not a multiplier). The adornment must
    // track the editor via the shared --ui-text-field-font token at every [scale] tier.
    const { wrap, field, editor } = mount('<ui-text-field type="search"></ui-text-field>')
    const magnifier = field.querySelector('[data-part="leading-adornment"]') as HTMLElement

    wrap.setAttribute('scale', 'content-lg')
    const ef = fontPx(editor)
    expect(ef, 'editor font at content-lg×md must be 18px (ADR-0038 §1-row)').toBeCloseTo(18, 0)
    expect(fontPx(magnifier), 'magnifier font at content-lg×md must track editor (= 18px via --ui-text-field-font)').toBeCloseTo(18, 0)
    // anti-vacuous: the content-lg font (18) is measurably larger than the default (14)
    wrap.removeAttribute('scale')
    const efDefault = fontPx(editor)
    expect(ef, 'content-lg font must exceed the default-scale font').toBeGreaterThan(efDefault)
  })

  it('type=password: the editor -webkit-text-security is disc (the password mask is applied)', () => {
    // The CSS rule :scope[type='password'] > [data-part='editor'] { -webkit-text-security: disc }
    // applies when the reflected type='password' attribute is present on the host.
    const { field, editor } = mount('<ui-text-field type="password" value="secret"></ui-text-field>')
    expect(field.getAttribute('type'), 'type attribute must be reflected on the host').toBe('password')
    const sec = getComputedStyle(editor).getPropertyValue('-webkit-text-security')
    expect(sec, 'editor -webkit-text-security must be disc when type=password').toBe('disc')
  })

  it('reveal button: clicking flips -webkit-text-security disc → none → disc (the :state(revealed) CSS flip)', () => {
    // The reveal button click sets/clears :state(revealed) via internals.states; the CSS
    // :scope[type='password']:state(revealed) > [data-part='editor'] { -webkit-text-security: none }
    // overrides the disc mask so the typed text is visible.
    const { field, editor } = mount('<ui-text-field type="password" value="secret"></ui-text-field>')
    const revealBtn = field.querySelector('[data-part="reveal-button"]') as HTMLElement
    expect(revealBtn, 'reveal button must be present for type=password').not.toBeNull()

    // initial state: masked (disc)
    expect(getComputedStyle(editor).getPropertyValue('-webkit-text-security'), 'initial state must be disc (masked)').toBe('disc')

    // first click → reveal (none)
    revealBtn.click()
    expect(getComputedStyle(editor).getPropertyValue('-webkit-text-security'), 'after reveal click must be none (revealed)').toBe('none')

    // second click → mask again (disc)
    revealBtn.click()
    expect(getComputedStyle(editor).getPropertyValue('-webkit-text-security'), 'after second click must restore disc').toBe('disc')
  })

  // Forced-colors (Chromium CDP only — WebKit has no CDP forced-colors emulation).
  // The CSS @media (forced-colors: active) block sets forced-color-adjust: none on all adornment
  // elements, exempting them from the system forced-color palette so their glyphs remain visible.
  it('forced-colors: adornment elements carry forced-color-adjust: none (Chromium only)', async () => {
    if (server.browser !== 'chromium') {
      // WebKit: assert we are genuinely NOT in forced-colors so the Chromium proof is not faked.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const { field } = mount('<ui-text-field type="search"></ui-text-field>')
    const magnifier = field.querySelector('[data-part="leading-adornment"]') as HTMLElement
    const clearBtn = field.querySelector('[data-part="clear-button"]') as HTMLElement

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'the engine must enter forced-colors').toBe(true)
      // The @media (forced-colors: active) block applies forced-color-adjust: none to adornment elements,
      // exempting them from forced-color override so their glyphs keep their inherited ink.
      const fcaMagnifier = getComputedStyle(magnifier).getPropertyValue('forced-color-adjust').trim()
      const fcaClear = getComputedStyle(clearBtn).getPropertyValue('forced-color-adjust').trim()
      expect(fcaMagnifier, 'magnifier must have forced-color-adjust: none under forced-colors').toBe('none')
      expect(fcaClear, 'clear-button must have forced-color-adjust: none under forced-colors').toBe('none')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // restore
    }
  })
})
