import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import { server, cdp } from 'vitest/browser'

// s11 (geometry leg) — the CROSS-ENGINE geometry smoke for ui-text-field (decomp g4-g6 node s11). Where the
// jsdom text-field-geometry.test.ts (s9) pins the DECLARED calc()s, this pins the RENDERED px a real engine
// resolves — and it is ANTI-VACUOUS: it asserts the px genuinely CHANGE where the sizing law says they must
// (across [size] and [scale]), not a vacuous equal-to-self. Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts → the two playwright instances). Sibling to button-geometry.browser.test.ts (G5
// s13) — same harness, same load-bearing CSS order.
//
// The laws under proof (references/geometry.md — the field is a Control-class component, ADR-0014):
//   • FRAME ∝ height — the host block-size rides [size] and [scale] (--md-sys-scale).
//   • EDITOR FONT ∝ font — the contenteditable editor's font rides the same [size]/[scale] ramp.
//   • VALUE EDGE = h/2 — the value-side inline pad is half the frame height (the per-edge formula); a leading
//     adornment's slot edge is ½(h − icon). Proven on BOTH the bare and the leading-icon variants.
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet (text-field's :where() token block + @scope geometry), then the self-defining
// `all` entry (registers ui-text-field). Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { iconRegistry, type IconName, type IconPack } from '@agent-ui/icons'

// Minimal CDP session interface for forced-colors emulation (Chromium only — WebKit has no CDP emulation).
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ── markup: the two variants the smoke proves in parallel (the editor is control-injected on connect) ───
const BARE = '<ui-text-field></ui-text-field>' //                                       slotless — value edge h/2 both sides
const ICON = '<ui-text-field><span slot="leading" data-role="icon">●</span></ui-text-field>' // leading slot edge ½(h−icon)

// ── mount/cleanup: each field rides a wrapper carrying the [scale] ancestor attribute (dimensions.css keys
// off the region axes data-tier / data-scale (ADR-0245); the custom props inherit down to the host). ────
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

/** The derived control type at the root register per [size] (ADR-0245 cl.7): the editor font at sm / md / lg. */
const FONT_STOPS = (['sm', 'md', 'lg'] as const).map((sz): [string, number] => [sz, resolve('product', 'sm', sz).type.control])

const allDistinct = (xs: number[]): boolean => new Set(xs.map((x) => x.toFixed(2))).size === xs.length

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

        // GH #634 displacement gap: height + font were pinned, but the editor's own VERTICAL position
        // within the frame was never checked — a regression to align-items:flex-start on the field's grid
        // host would top-anchor the editor's line box in the taller frame, undetected. Anti-vacuous: the
        // frame must genuinely exceed the editor's own line-box height for centering to mean anything.
        const fieldRect = field.getBoundingClientRect()
        const editorRect = editor.getBoundingClientRect()
        expect(fieldRect.height - editorRect.height, `[${markup}] size=${size}: no vertical slack between frame and editor line box (anti-vacuous)`).toBeGreaterThan(0.5)
        const gapTop = editorRect.top - fieldRect.top
        const gapBottom = fieldRect.bottom - editorRect.bottom
        expect(Math.abs(gapTop - gapBottom), `[${markup}] size=${size}: editor not vertically centered in the frame`).toBeLessThanOrEqual(1)
      }
      // the derived ramp at the root register (product / sm, ADR-0245 cl.3): height 4n, font = control type.
      const ramp = (['sm', 'md', 'lg'] as const).map((sz) => resolve('product', 'sm', sz))
      expect(heights[0]).toBeCloseTo(ramp[0].h, 0)
      expect(heights[1]).toBeCloseTo(ramp[1].h, 0)
      expect(heights[2]).toBeCloseTo(ramp[2].h, 0)
      expect(fonts[0]).toBeCloseTo(ramp[0].type.control, 0)
      expect(fonts[1]).toBeCloseTo(ramp[1].type.control, 0)
      expect(fonts[2]).toBeCloseTo(ramp[2].type.control, 0)
      // anti-vacuous: the three steps are genuinely DISTINCT px — the [size] lever truly moved the frame + font.
      expect(allDistinct(heights), `heights did not change across [size]: ${heights.join()}`).toBe(true)
      expect(allDistinct(fonts), `editor fonts did not change across [size]: ${fonts.join()}`).toBe(true)
    }
  })

  it('the region register CHANGES the frame height + the editor font px — on BOTH variants (ADR-0245: 4n and n + 6)', () => {
    // The md column at three registers (the old ui-sm, ui-md and content-lg): widget / sm, the root product / sm,
    // and content / lg, read against scale.mjs resolve().
    const REGISTERS = [['widget', 'sm'], ['product', 'sm'], ['content', 'lg']] as const
    for (const markup of [BARE, ICON]) {
      const { wrap, field, editor } = mount(markup) // size stays md (default)
      const heights: number[] = []
      const fonts: number[] = []
      for (const [tier, scale] of REGISTERS) {
        wrap.setAttribute('data-tier', tier)
        wrap.setAttribute('data-scale', scale)
        heights.push(frameHeight(field))
        fonts.push(fontPx(editor))

        // GH #634 displacement gap (scale-ramp twin of the [size] check above): the editor's vertical
        // position within the frame must hold across the scale ramp too, not just the size ramp.
        const fieldRect = field.getBoundingClientRect()
        const editorRect = editor.getBoundingClientRect()
        expect(fieldRect.height - editorRect.height, `[${markup}] scale=${scale}: no vertical slack between frame and editor line box (anti-vacuous)`).toBeGreaterThan(0.5)
        const gapTop = editorRect.top - fieldRect.top
        const gapBottom = fieldRect.bottom - editorRect.bottom
        expect(Math.abs(gapTop - gapBottom), `[${markup}] scale=${scale}: editor not vertically centered in the frame`).toBeLessThanOrEqual(1)
      }
      expect(heights).toEqual(REGISTERS.map(([t, sc]) => resolve(t, sc, 'md').h)) // 24 · 28 · 52
      expect(fonts).toEqual(REGISTERS.map(([t, sc]) => resolve(t, sc, 'md').type.control)) // 12 · 13 · 19
      // anti-vacuous: all three sampled tiers produce distinct heights and fonts
      expect(allDistinct(heights), `heights did not change across [scale]: ${heights.join()}`).toBe(true)
      expect(allDistinct(fonts), `editor fonts did not change across [scale]: ${fonts.join()}`).toBe(true)
    }
  })

  it('BARE: the value edge == n on BOTH inline sides (the slotless value-edge formula, ADR-0245 cl.3 frame padding n)', () => {
    const { field } = mount(BARE) // md frame at the root register → h = 4n = 28, value edge = n = 7 each side
    const h = frameHeight(field)
    const n = resolve('product', 'sm', 'md').n
    expect(padStartPx(field), 'leading value edge is not n').toBeCloseTo(n, 1)
    expect(padEndPx(field), 'trailing value edge is not n').toBeCloseTo(n, 1)
    // anti-vacuous: the edge tracks the frame — it really is half of a positive frame height.
    expect(h, 'frame height is not a positive px').toBeGreaterThan(0)
  })

  it('LEADING-ICON: the trailing value edge == n and the leading slot edge == ½(h−icon) == n; 0 < icon ≤ box', () => {
    // icon = var(--md-sys-icon-md) = 18px at default scale (ADR-0038 / ADR-0035 conformance: text-field now reads
    // the shared --md-sys-icon-* table, dropping the old calc(18px * var(--md-sys-scale)) local formula).
    const { field } = mount(ICON) // md at the root register → h = 28, icon = 2n = 14, slot edge = ½(28−14) = 7 = n, value edge = n
    const leadingCell = field.querySelector('[slot="leading"]') as HTMLElement
    const h = frameHeight(field)
    const icon = leadingCell.getBoundingClientRect().width // the icon-sized slot cell (--ui-text-field-icon)

    const r = resolve('product', 'sm', 'md')
    expect(padEndPx(field), 'trailing value edge is not n').toBeCloseTo(r.n, 1)
    expect(padStartPx(field), 'leading slot edge is not ½(h−icon)').toBeCloseTo((h - icon) / 2, 1)
    expect(icon, 'icon cell is not the derived icon box 2n').toBeCloseTo(r.icon, 1)
    // the icon ramp law: 0 < icon ≤ box (the cell never exceeds the frame).
    expect(icon, 'icon cell is not a positive px').toBeGreaterThan(0)
    expect(icon, 'the icon cell exceeds the box height').toBeLessThanOrEqual(h + 0.5)
    // the derived system makes the two edges one value: ½(4n − 2n) == n, so the slot edge equals the value edge.
    expect(padStartPx(field), 'the slot edge did not equal the value edge (½(h−icon) == n)').toBeCloseTo(padEndPx(field), 1)
  })

  // ── ADR-0223 (Fill by Default, slice-0 pilot) — the two-posture acceptance leg (generalizing the ADR-0021
  //    s11 smoke): FILL — a bare host in block flow stretches to the container's inline size; [inline] — the
  //    host hugs, held open by the relocated ~20ch typing-width floor (clause 3(b)), and sits BELOW the container.
  it('two postures: bare host offsetWidth ≈ container inline size (fill); [inline] host offsetWidth ≥ the ~20ch floor and < container (hug)', () => {
    const { wrap, field } = mount(BARE)
    wrap.style.inlineSize = '640px' // a wide block container — wider than any 20ch resolution
    // FILL (the default): block-level grid — the field stretches to the container; the container IS the floor.
    const containerWidth = wrap.getBoundingClientRect().width
    expect(field.offsetWidth, 'the bare field did not FILL its block container (ADR-0223 cl.1)').toBeCloseTo(containerWidth, 0)
    expect(getComputedStyle(field).display, 'the default host is not block-level grid').toBe('grid')
    // HUG (the ONE opt-out): [inline] flips display level AND posture; the ADR-0021 floor now lives here.
    field.setAttribute('inline', '')
    const floorPx = px(getComputedStyle(field).minInlineSize) // 20ch resolves to an absolute px on a real engine
    expect(floorPx, 'the --ui-text-field-min-inline-size floor did not resolve to a positive px in [inline]').toBeGreaterThan(0)
    const hugged = field.offsetWidth
    expect(hugged, 'the [inline] field is narrower than its min-inline-size floor').toBeGreaterThanOrEqual(Math.floor(floorPx))
    expect(hugged, 'the [inline] field did not HUG — it still fills the container').toBeLessThan(containerWidth)
    expect(getComputedStyle(field).display, 'the [inline] host is not inline-level').toBe('inline-grid')
    // NON-VACUOUS — the hug floor is load-bearing: remove it and the unsized 1fr editor collapses the box to
    // its frame chrome, far below the floor (the ~0 typing sliver ADR-0021 measured; the degenerate hug context
    // is exactly where that collapse lived — which is WHY the floor moved here).
    field.style.minInlineSize = '0'
    const withoutFloor = field.offsetWidth
    expect(withoutFloor, 'removing the [inline] floor did NOT shrink the field below it — the floor is not load-bearing').toBeLessThan(
      floorPx,
    )
    expect(hugged - withoutFloor, 'the floor did not meaningfully widen the hugging field').toBeGreaterThan(20)
  })

  // ── ADR-0006 / geometry.md: [density] rides the rhythm (the slot↔editor gap), NEVER the frame (C6 polish) ──
  it('a region data-scale moves the adornment↔editor distance AND the bare frame together (one n, ADR-0245 Amendment 4)', () => {
    // The [density] axis (gap only) retired into data-scale: n moves the height (4n), the box margin (n) and the
    // editor's label inset (n - c) at once; the column-gap is the control gutter c, so icon to text is c + (n - c) = n.
    const icon = mount(ICON) // size stays md (default); the `auto 1fr` grid carries the column-gap
    const bare = mount(BARE)
    for (const scale of ['sm', 'md', 'lg'] as const) {
      icon.wrap.setAttribute('data-scale', scale)
      bare.wrap.setAttribute('data-scale', scale)
      const r = resolve('product', scale, 'md')
      const editorInset = px(getComputedStyle(icon.field.querySelector('[data-part="editor"]') as HTMLElement).paddingInlineStart)
      expect(px(getComputedStyle(icon.field).columnGap), `column-gap @ ${scale}`).toBeCloseTo(r.control.gutter, 1)
      expect(px(getComputedStyle(icon.field).columnGap) + editorInset, `icon to text @ ${scale}`).toBeCloseTo(r.control.margin, 1)
      expect(frameHeight(bare.field), `bare height @ ${scale}`).toBeCloseTo(r.h, 0)
      expect(padStartPx(bare.field), `bare box margin @ ${scale}`).toBeCloseTo(r.control.margin, 0)
      const bareInset = px(getComputedStyle(bare.field.querySelector('[data-part="editor"]') as HTMLElement).paddingInlineStart)
      expect(padStartPx(bare.field) + bareInset, `bare value edge 2n - c @ ${scale}`).toBeCloseTo(2 * r.n - r.c, 0)
    }
  })

  // ── ADR-0036: single-line control line-height = font (the editor cell) ─────────────────────────────────
  it('ADR-0036 line-height = font: computed line-height on the editor equals the editor font-size', () => {
    // ADR-0036 law: the editor (`[data-part=editor]`) sets line-height: var(--md-sys-control-line-height) = 1
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
    // integers (sm→12, md→13, lg→14 px at the root register, the derived control type).
    const { field, editor } = mount('<ui-text-field type="search"></ui-text-field>')
    const magnifier = field.querySelector('[data-part="leading-adornment"]') as HTMLElement
    const clearBtn = field.querySelector('[data-part="clear-button"]') as HTMLElement

    for (const [size, expectedFont] of FONT_STOPS) {
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

    for (const [size, expectedFont] of FONT_STOPS) {
      field.setAttribute('size', size)
      const ef = fontPx(editor)
      expect(ef).toBeCloseTo(expectedFont, 0)
      expect(fontPx(stepUp), `step-up font at size=${size} must equal editor font`).toBeCloseTo(ef, 0)
      expect(fontPx(stepDown), `step-down font at size=${size} must equal editor font`).toBeCloseTo(ef, 0)
    }
  })

  it('GH #1406: the step buttons render SIDE-BY-SIDE trailing — minus (step-down) left of plus (step-up), same row, square cells', () => {
    // Kim's 2026-08-19 ruling on #1406: the stacked caret column became a trailing − + ROW. Pinned on
    // BOTH numeric-family roles: the bare stepper cell (type=number) and the suffix+steppers numeric
    // cell (type=percent). The pin: minus.x < plus.x (side by side, − left), shared row (vertical
    // centers align), TRAILING (both sit past the editor's inline start), icon-sized square buttons.
    for (const markup of [
      '<ui-text-field type="number"></ui-text-field>',
      '<ui-text-field type="percent"></ui-text-field>',
    ] as const) {
      const { field, editor } = mount(markup)
      const down = (field.querySelector('[data-part="step-down"]') as HTMLElement).getBoundingClientRect()
      const up = (field.querySelector('[data-part="step-up"]') as HTMLElement).getBoundingClientRect()

      // side by side, minus LEFT of plus (no overlap)
      expect(down.right, `[${markup}] step-down must sit fully left of step-up (− + order)`).toBeLessThanOrEqual(up.left + 0.5)
      expect(down.left, `[${markup}] step-down must be left of step-up`).toBeLessThan(up.left)
      // one shared row, not a stack: vertical centers within 1px
      const downCy = down.top + down.height / 2
      const upCy = up.top + up.height / 2
      expect(Math.abs(downCy - upCy), `[${markup}] step buttons must share one row (not stacked)`).toBeLessThanOrEqual(1)
      // trailing: the pair sits at the field's inline END, past the editor's start edge
      const editorBox = editor.getBoundingClientRect()
      expect(down.left, `[${markup}] the stepper pair must TRAIL the editor`).toBeGreaterThan(editorBox.left)
      // square, icon-sized cells (md stepper convention): width == height, positive
      for (const [label, r] of [['step-down', down], ['step-up', up]] as const) {
        expect(r.width, `[${markup}] ${label} collapsed`).toBeGreaterThan(0)
        expect(Math.abs(r.width - r.height), `[${markup}] ${label} must be square`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('a content / lg region: the adornment font tracks the elevated control type — EXACT px at md size', () => {
    // ADR-0245: control type n + 6 at content / lg / md (n 13) = 19px. The adornment must track the editor via
    // the shared --ui-text-field-font token in every region.
    const { wrap, field, editor } = mount('<ui-text-field type="search"></ui-text-field>')
    const magnifier = field.querySelector('[data-part="leading-adornment"]') as HTMLElement

    wrap.setAttribute('data-tier', 'content')
    wrap.setAttribute('data-scale', 'lg')
    const want = resolve('content', 'lg', 'md').type.control
    const ef = fontPx(editor)
    expect(ef, 'editor font at content / lg / md').toBeCloseTo(want, 0)
    expect(fontPx(magnifier), 'magnifier font must track the editor via --ui-text-field-font').toBeCloseTo(want, 0)
    // anti-vacuous: the region font is measurably larger than the root's
    wrap.removeAttribute('data-tier')
    wrap.removeAttribute('data-scale')
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

  it('currency type: leading symbol font-size == --ui-text-field-font at each [size] (§4.6 inline affordance = font)', () => {
    // The currency leading-adornment carries font-size: var(--ui-text-field-font) (same law as the
    // magnifier). Proved at all three [size] stops with EXACT integers (sm→12, md→13, lg→14).
    const { field, editor } = mount('<ui-text-field type="currency"></ui-text-field>')
    const symbol = field.querySelector('[data-part="leading-adornment"][data-role="currency"]') as HTMLElement
    expect(symbol, 'currency leading-adornment must be present').not.toBeNull()

    for (const [size, expectedFont] of FONT_STOPS) {
      field.setAttribute('size', size)
      const ef = fontPx(editor)
      expect(ef, `editor font at size=${size}`).toBeCloseTo(expectedFont, 0)
      expect(fontPx(symbol), `currency symbol font at size=${size} must equal editor font`).toBeCloseTo(ef, 0)
    }
    // anti-vacuous: font GENUINELY CHANGES (not a fixed, size-blind value)
    field.setAttribute('size', 'sm'); const smSym = fontPx(symbol)
    field.setAttribute('size', 'lg'); const lgSym = fontPx(symbol)
    expect(lgSym, 'currency symbol font did not change between sm and lg').toBeGreaterThan(smSym)
  })

  it('unit/percent suffix font-size == --ui-text-field-font at each [size] (§4.6 inline affordance = font)', () => {
    // The [data-part="suffix"] span on unit/percent types carries font-size: var(--ui-text-field-font)
    // (§4.6 of the geometry law: inline affordances are sized to the font, not the icon). Proved on
    // BOTH unit (labelled suffix) and percent ('% ' suffix) at all three [size] stops.
    for (const markup of [
      '<ui-text-field type="unit" unit="kilogram"></ui-text-field>',
      '<ui-text-field type="percent"></ui-text-field>',
    ] as const) {
      const { field, editor } = mount(markup)
      const suffix = field.querySelector('[data-part="suffix"]') as HTMLElement
      expect(suffix, `suffix must be present for ${markup}`).not.toBeNull()

      for (const [size, expectedFont] of FONT_STOPS) {
        field.setAttribute('size', size)
        const ef = fontPx(editor)
        expect(ef, `editor font at size=${size}`).toBeCloseTo(expectedFont, 0)
        expect(fontPx(suffix), `suffix font at size=${size} must equal editor font (§4.6)`).toBeCloseTo(ef, 0)
      }
      // anti-vacuous: the suffix font GENUINELY CHANGES across sizes
      field.setAttribute('size', 'sm'); const smSuf = fontPx(suffix)
      field.setAttribute('size', 'lg'); const lgSuf = fontPx(suffix)
      expect(lgSuf, 'suffix font did not change between sm and lg (size-blind)').toBeGreaterThan(smSuf)
    }
  })

  it('unit/percent fields in a flex row carry a positive bounding width (not a collapsed dot)', () => {
    // The overall shape assertion (per the build-lead DoD). A unit/percent field MUST have a trailing
    // numeric adornment (suffix+steppers in a flex row) AND the field itself must be wider than tall —
    // it is a text input, not a stepper widget. Mounts in the doc-specimen context (display:flex row).
    // Proved for BOTH type=unit AND type=percent — both use [data-role='numeric'] (m3 twin assertion).
    for (const markup of [
      '<ui-text-field type="unit" unit="kilogram"></ui-text-field>',
      '<ui-text-field type="percent"></ui-text-field>',
    ] as const) {
      const wrap = document.createElement('div')
      wrap.style.display = 'flex'
      wrap.style.flexDirection = 'row'
      wrap.innerHTML = markup
      document.body.append(wrap)
      mounted.push(wrap)
      const field = wrap.querySelector('ui-text-field') as HTMLElement
      const box = field.getBoundingClientRect()
      // the field is wider than it is tall (it is a text input with a suffix, not a square widget)
      expect(box.width, `[${markup}] collapsed to zero width in a flex row`).toBeGreaterThan(0)
      expect(box.height, `[${markup}] collapsed to zero height in a flex row`).toBeGreaterThan(0)
      expect(box.width, `[${markup}] is narrower than tall (should be wider than tall, like a text input)`).toBeGreaterThan(box.height)
    }
  })

  it('Phosphor-icon sweep: injected <svg> glyphs (magnifier / clear / steppers) paint at a real, non-collapsed derived icon-box size', () => {
    // setIcon(...) glyphs must themselves render at a real size — not just their containing button/span
    // (the ui-slider "collapsed dot" lesson: a container can pass every bounding-box check while its
    // content renders at 0×0). Each svg is sized to the derived icon box (--ui-text-field-svg, 1em outside a
    // data-tier region; text-field.css).
    const { field: searchField } = mount('<ui-text-field type="search" value="x"></ui-text-field>')
    const magnifier = searchField.querySelector('[data-part="leading-adornment"]') as HTMLElement
    const clearBtn = searchField.querySelector('[data-part="clear-button"]') as HTMLElement
    // The clear-button ITSELF shrink-wraps to its glyph (padding:0, no explicit size) — the real "slot"
    // box the geometry law pins is its parent `[slot='trailing']` cell (icon-sized, text-field.css's
    // slot rule); measuring against the button's own box would be vacuous (box == content, always).
    const clearSlot = clearBtn.closest('[slot="trailing"]') as HTMLElement
    for (const [label, el, slotEl] of [
      ['magnifier', magnifier, magnifier],
      ['clear-button', clearBtn, clearSlot],
    ] as const) {
      const svg = el.querySelector('svg')!
      const r = svg.getBoundingClientRect()
      expect(r.width, `${server.browser}: ${label} svg collapsed to zero width`).toBeGreaterThan(0)
      expect(r.height, `${server.browser}: ${label} svg collapsed to zero height`).toBeGreaterThan(0)
      // the injected svg paints at the derived icon box (2n, ADR-0245 cl.3), not 1em: md at the root register is 14px.
      expect(r.width, `${server.browser}: ${label} svg is not the derived icon box`).toBeCloseTo(resolve('product', 'sm', 'md').icon, 0)

      // GH #634 displacement gap: the svg's own size was pinned, but never its POSITION within the
      // adornment slot — a regression from align-items/justify-content:center to flex-start on the slot
      // would misplace the glyph while size checks stay green. The derived icon box (ADR-0245 cl.3) is the slot cell
      // itself, so the glyph now FILLS it with no slack to slide in (it overflowed or sat loose before): the
      // anti-vacuous floor is that the glyph never overflows its slot, and the gap checks below pin zero offset.
      const slotRect = slotEl.getBoundingClientRect()
      const slack = Math.min(slotRect.width - r.width, slotRect.height - r.height)
      expect(slack, `${server.browser}: ${label} glyph overflows its slot`).toBeGreaterThanOrEqual(-0.5)
      const gapX1 = r.left - slotRect.left
      const gapX2 = slotRect.right - r.right
      const gapY1 = r.top - slotRect.top
      const gapY2 = slotRect.bottom - r.bottom
      expect(Math.abs(gapX1 - gapX2), `${server.browser}: ${label} glyph not horizontally centered in its slot`).toBeLessThanOrEqual(1)
      expect(Math.abs(gapY1 - gapY2), `${server.browser}: ${label} glyph not vertically centered in its slot`).toBeLessThanOrEqual(1)
    }

    const { field: numberField } = mount('<ui-text-field type="number"></ui-text-field>')
    const stepUp = numberField.querySelector('[data-part="step-up"]') as HTMLElement
    const stepDown = numberField.querySelector('[data-part="step-down"]') as HTMLElement
    for (const [label, el] of [['step-up', stepUp], ['step-down', stepDown]] as const) {
      const svg = el.querySelector('svg')!
      const r = svg.getBoundingClientRect()
      expect(r.width, `${server.browser}: ${label} svg collapsed to zero width`).toBeGreaterThan(0)
      expect(r.height, `${server.browser}: ${label} svg collapsed to zero height`).toBeGreaterThan(0)

      // GH #634 displacement gap (stepper twin of the magnifier/clear-button check above).
      const slotRect = el.getBoundingClientRect()
      const gapX1 = r.left - slotRect.left
      const gapX2 = slotRect.right - r.right
      const gapY1 = r.top - slotRect.top
      const gapY2 = slotRect.bottom - r.bottom
      expect(Math.abs(gapX1 - gapX2), `${server.browser}: ${label} glyph not horizontally centered in its slot`).toBeLessThanOrEqual(1)
      expect(Math.abs(gapY1 - gapY2), `${server.browser}: ${label} glyph not vertically centered in its slot`).toBeLessThanOrEqual(1)
    }

    const { field: dateField } = mount('<ui-text-field type="date"></ui-text-field>')
    const calBtn = dateField.querySelector('[data-part="calendar-button"]') as HTMLElement
    const calSvg = calBtn.querySelector('svg')!
    const calR = calSvg.getBoundingClientRect()
    expect(calR.width, `${server.browser}: calendar-button svg collapsed to zero width`).toBeGreaterThan(0)
    expect(calR.height, `${server.browser}: calendar-button svg collapsed to zero height`).toBeGreaterThan(0)

    // GH #634 displacement gap (calendar-button twin) — same shrink-wrap shape as clear-button: measure
    // against the parent `[slot='trailing']` cell, not the button's own box.
    const calSlot = calBtn.closest('[slot="trailing"]') as HTMLElement
    const calSlotRect = calSlot.getBoundingClientRect()
    // The glyph fills the derived icon-box cell (no slack, as above): the floor is that it never overflows.
    const calSlack = Math.min(calSlotRect.width - calR.width, calSlotRect.height - calR.height)
    expect(calSlack, `${server.browser}: calendar-button glyph overflows its slot`).toBeGreaterThanOrEqual(-0.5)
    expect(
      Math.abs((calR.left - calSlotRect.left) - (calSlotRect.right - calR.right)),
      `${server.browser}: calendar-button glyph not horizontally centered in its slot`,
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs((calR.top - calSlotRect.top) - (calSlotRect.bottom - calR.bottom)),
      `${server.browser}: calendar-button glyph not vertically centered in its slot`,
    ).toBeLessThanOrEqual(1)
  })

  it('Phosphor-icon sweep: the password reveal button swaps eye ↔ eye-slash on click, both rendering at a real size', () => {
    // A no-active-pack registry resolves EVERY name to the same empty missingIcon() fallback, which
    // would make eye and eye-slash indistinguishable by content — register a deterministic test pack
    // (same convention as icon-geometry.browser.test.ts) so the swap assertion below actually proves
    // the glyph body changed, not just that a container re-rendered.
    const REVEAL_TEST_PACK: IconPack = {
      id: 'reveal-test-pack',
      viewBox: '0 0 2 2',
      icons: { eye: '<path d="M0 0h1v1z"/>', 'eye-slash': '<path d="M1 1h1v1z"/>' } as Record<IconName, string>,
    }
    iconRegistry.registerPack(REVEAL_TEST_PACK)
    iconRegistry.setActivePack(REVEAL_TEST_PACK.id)

    const { field } = mount('<ui-text-field type="password" value="secret"></ui-text-field>')
    const revealBtn = field.querySelector('[data-part="reveal-button"]') as HTMLElement

    const maskedSvg = revealBtn.querySelector('svg')!
    const maskedR = maskedSvg.getBoundingClientRect()
    const maskedHtml = maskedSvg.innerHTML
    expect(maskedR.width, `${server.browser}: masked-state reveal svg collapsed to zero width`).toBeGreaterThan(0)
    expect(maskedR.height, `${server.browser}: masked-state reveal svg collapsed to zero height`).toBeGreaterThan(0)
    // GH #634 displacement gap (reveal-button twin): position within its slot, masked state.
    const revealSlotRect = revealBtn.getBoundingClientRect()
    expect(
      Math.abs((maskedR.left - revealSlotRect.left) - (revealSlotRect.right - maskedR.right)),
      `${server.browser}: masked-state glyph not horizontally centered in the reveal-button slot`,
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs((maskedR.top - revealSlotRect.top) - (revealSlotRect.bottom - maskedR.bottom)),
      `${server.browser}: masked-state glyph not vertically centered in the reveal-button slot`,
    ).toBeLessThanOrEqual(1)

    revealBtn.click()
    const revealedSvg = revealBtn.querySelector('svg')!
    const revealedR = revealedSvg.getBoundingClientRect()
    expect(revealedR.width, `${server.browser}: revealed-state svg collapsed to zero width`).toBeGreaterThan(0)
    expect(revealedR.height, `${server.browser}: revealed-state svg collapsed to zero height`).toBeGreaterThan(0)
    // Prove the swap actually changed the glyph body, not just re-rendered the same icon
    // (a regression wiring eye-slash into both states would still pass the size checks above).
    expect(revealedSvg.innerHTML, `${server.browser}: reveal-button icon body did not change between masked and revealed states`).not.toBe(maskedHtml)
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

  // Wave 5A — suffix forced-colors (Chromium only): the [data-part="suffix"] span is in the forced-
  // color-adjust: none block so its glyph keeps its inherited colour under system high-contrast.
  it('forced-colors: Wave-5A suffix span carries forced-color-adjust: none (Chromium only)', async () => {
    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const { field } = mount('<ui-text-field type="percent"></ui-text-field>')
    const suffix = field.querySelector('[data-part="suffix"]') as HTMLElement
    expect(suffix, 'percent suffix must be present').not.toBeNull()

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'engine must enter forced-colors').toBe(true)
      const fca = getComputedStyle(suffix).getPropertyValue('forced-color-adjust').trim()
      expect(fca, 'percent suffix must have forced-color-adjust: none under forced-colors').toBe('none')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // restore
    }
  })
})

// ── Wave 5B (ADR-0048): type=date calendar picker + type=time codec — cross-engine browser smoke ─────
//
// These tests prove what jsdom cannot:
//   1. SHAPE — type=date field is not a collapsed dot in a flex row (the calendar button adornment
//      carries min-inline-size just like a text adornment — anti-dot proof).
//   2. OVERLAY — the calendar button opens the popup in the top layer (Popover API) on BOTH engines.
//   3. SELECTION — a calendar `select` dispatch → updates the field value AND closes the popup.
//   4. FOCUS-RESTORE — after overlay close the calendar button has focus (ADR-0045 guarantee).
//   5. CODEC (time) — "14:30" blurs to a localized string on a real ICU stack.
//
// The `@agent-ui/components/all` entry already registers `<ui-calendar>`. The text-field's click handler checks `customElements.get('ui-calendar')` at runtime —
// since the calendar IS already registered, `open()` fires SYNCHRONOUSLY on the first click (the
// dynamic import is skipped). Only the Popover API toggle event needs a task-queue drain:
// all awaits use `setTimeout(r, 0)`, matching select.browser.test.ts lines 192–225.
//
// The first-open follow-up (ADR-0048): `[data-part="calendar-popup"]`/`<ui-calendar>` do not exist in the
// DOM until the calendar-button's first click (`ensureCalendar()` in text-field.ts) — so every test below
// queries `popup`/`calEl` AFTER `calBtn.click()`, not before (a pre-click query would be null).

describe('ui-text-field Wave-5B — type=date calendar picker (s11 Wave-5B, both engines)', () => {
  it('SHAPE: type=date field in a flex row has positive bounding-box and is wider than tall (not a dot)', () => {
    // The whole-shape gestalt: a date field is a text input + calendar button, not a square widget.
    // Under fill-by-default (ADR-0223) the fill posture stretches the field to its flex track; the
    // [inline] hug state carries the relocated ADR-0021 floor (the two-posture leg above proves both).
    const wrap = document.createElement('div')
    wrap.style.display = 'flex'
    wrap.style.flexDirection = 'row'
    wrap.innerHTML = '<ui-text-field type="date"></ui-text-field>'
    document.body.append(wrap)
    mounted.push(wrap)
    const field = wrap.querySelector('ui-text-field') as HTMLElement
    const box = field.getBoundingClientRect()

    expect(box.width, 'type=date field collapsed to zero width in a flex row').toBeGreaterThan(0)
    expect(box.height, 'type=date field collapsed to zero height in a flex row').toBeGreaterThan(0)
    expect(box.width, 'type=date field is narrower than tall — should be a text-input shape').toBeGreaterThan(box.height)
  })

  it('OVERLAY: calendar button click opens the popup in the top layer (:popover-open)', async () => {
    // The `all` entry pre-registers ui-calendar, so the click handler opens synchronously (customElements.get
    // shortcut). One `setTimeout(r, 0)` lets the Popover toggle event (a queued task) settle.
    const { field } = mount('<ui-text-field type="date"></ui-text-field>')
    const calBtn = field.querySelector('[data-part="calendar-button"]') as HTMLElement
    expect(calBtn, 'calendar-button must be present for type=date').not.toBeNull()
    expect(field.querySelector('[data-part="calendar-popup"]'), 'popup must not exist before first open').toBeNull()

    calBtn.click() // first open: builds the popup + <ui-calendar> (ensureCalendar) AND opens synchronously
    const popup = field.querySelector('[data-part="calendar-popup"]') as HTMLElement
    expect(popup, 'calendar-popup must be present after first open').not.toBeNull()
    await new Promise<void>((r) => setTimeout(r, 0)) // let Popover toggle event (queued task) settle

    expect(popup.matches(':popover-open'), 'popup must be in the Popover top layer after button click').toBe(true)
  })

  it('SELECTION: calendar `select` dispatch → updates the field value AND closes the popup', async () => {
    // Verifies the calEl `select` listener: this.value = iso, this.#codec.setCanonical(iso),
    // emit input+change, calendarHandle.close(). The popup must leave the top layer after close.
    const { field } = mount('<ui-text-field type="date"></ui-text-field>')
    const calBtn = field.querySelector('[data-part="calendar-button"]') as HTMLElement

    // Open the popup (ui-calendar pre-registered → synchronous open; one task round for toggle event).
    // First open also BUILDS the popup + <ui-calendar> (ensureCalendar) — query them only after the click.
    calBtn.click()
    const popup = field.querySelector('[data-part="calendar-popup"]') as HTMLElement
    const calEl = popup.querySelector('ui-calendar') as HTMLElement
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(popup.matches(':popover-open'), 'popup must be open before selection').toBe(true)

    // Track events
    const events: string[] = []
    field.addEventListener('input', () => events.push('input'))
    field.addEventListener('change', () => events.push('change'))

    // Simulate calendar commit (what UICalendarElement fires on day click / Enter)
    calEl.dispatchEvent(new CustomEvent('select', { detail: '2024-07-04', bubbles: false }))

    // Field value is updated immediately (synchronous in the listener)
    expect((field as HTMLElement & { value: string }).value, 'field value must be set to the ISO date').toBe('2024-07-04')
    expect(events, 'must emit input then change').toEqual(['input', 'change'])

    // hidePopover() + Popover toggle event settle before the `:popover-open` check
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(popup.matches(':popover-open'), 'popup must leave the top layer after selection').toBe(false)
  })

  it('FOCUS-RESTORE: after overlay close via selection, focus returns to the calendar button (ADR-0045)', async () => {
    // ADR-0045 / overlay.ts: restoreFocus() targets the `anchor` element (the calendar button).
    // After a calendar pick, the overlay's close() calls restoreFocus() → button.focus().
    //
    // WebKit does not focus a <button> on click — pre-focus explicitly so the anchor is well-defined
    // as the focus target regardless of engine (matching the select.browser.test.ts pattern, line 183).
    const { field } = mount('<ui-text-field type="date"></ui-text-field>')
    const calBtn = field.querySelector('[data-part="calendar-button"]') as HTMLElement

    calBtn.focus() // establish anchor as the pre-open active element (WebKit does not auto-focus on click)
    calBtn.click() // first open: builds the popup + <ui-calendar> (ensureCalendar) — query them after
    const popup = field.querySelector('[data-part="calendar-popup"]') as HTMLElement
    const calEl = popup.querySelector('ui-calendar') as HTMLElement
    await new Promise<void>((r) => setTimeout(r, 0)) // Popover toggle event (queued task)

    calEl.dispatchEvent(new CustomEvent('select', { detail: '2024-07-04', bubbles: false }))
    // restoreFocus() is synchronous in overlay.close(), but the Popover toggle event fires as a task
    await new Promise<void>((r) => setTimeout(r, 0)) // let hidePopover() toggle task drain

    // After close(), restoreFocus() must move focus to the calendar button (the anchor).
    expect(document.activeElement, 'focus must return to the calendar button after overlay close').toBe(calBtn)
  })

  it('TOP-LAYER (m1): the calendar popup renders in the top layer — it escapes an overflow:hidden + stacking-context ancestor', async () => {
    // The Popover API spec: `[popover]` elements are placed in the document's top layer, which is
    // painted ABOVE any overflow:hidden ancestor or compositing stacking context. If the popup were a
    // normal positioned child it would be clipped to the 5px×5px clip box. Two proofs:
    //   (1) :popover-open — the popup is in the top layer.
    //   (2) popup bounding rect is WIDER than the 5px clip box — it escaped overflow:hidden.
    const clip = document.createElement('div')
    Object.assign(clip.style, {
      overflow: 'hidden',
      transform: 'translateZ(0)', // stacking context / compositing layer
      width: '5px',
      height: '5px',
      position: 'absolute',
      insetInlineStart: '0px',
      insetBlockStart: '0px',
    })
    clip.innerHTML = '<ui-text-field type="date"></ui-text-field>'
    document.body.append(clip)
    mounted.push(clip)

    const field = clip.querySelector('ui-text-field') as HTMLElement
    const calBtn = field.querySelector('[data-part="calendar-button"]') as HTMLElement
    expect(calBtn, 'calendar-button must be present for type=date').not.toBeNull()
    expect(field.querySelector('[data-part="calendar-popup"]'), 'popup must not exist before first open').toBeNull()

    calBtn.click() // first open: builds the popup + <ui-calendar> (ensureCalendar) — query it after
    const popup = field.querySelector('[data-part="calendar-popup"]') as HTMLElement
    expect(popup, 'calendar-popup must be present after first open').not.toBeNull()
    await new Promise<void>((r) => setTimeout(r, 0)) // Popover toggle event (queued task)

    // Proof 1: the popup entered the Popover top layer.
    expect(popup.matches(':popover-open'), 'popup must be in the Popover top layer after click').toBe(true)

    // Proof 2: the popup rendered WIDER than the 5px overflow:hidden clip box — top-layer escape.
    // The calendar grid (7 weekday columns × day-cell buttons) always exceeds 20px; the clip is 5px.
    const clipRect = clip.getBoundingClientRect()
    const popupRect = popup.getBoundingClientRect()
    expect(
      popupRect.width,
      `popup width (${popupRect.width.toFixed(1)}px) must exceed the ${clipRect.width}px clip ancestor — top-layer escape proof`,
    ).toBeGreaterThan(clipRect.width)
  })

  // Wave 5B — calendar-button forced-colors (Chromium only, m3): [data-part="calendar-button"] is in
  // the forced-color-adjust: none block (ADR-0048 §2 / text-field.css) so its calendar-icon glyph
  // keeps its inherited colour under system high-contrast (the same law as adornment buttons/suffix).
  it('forced-colors: calendar-button carries forced-color-adjust: none (Chromium only, m3)', async () => {
    if (server.browser !== 'chromium') {
      // WebKit baseline: confirm we are NOT already in forced-colors so the Chromium proof is not faked.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const { field } = mount('<ui-text-field type="date"></ui-text-field>')
    const calBtn = field.querySelector('[data-part="calendar-button"]') as HTMLElement
    expect(calBtn, 'calendar-button must be present for type=date').not.toBeNull()

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'engine must enter forced-colors').toBe(true)
      // ADR-0048 §2: calendar-button is in the forced-color-adjust: none block so its calendar-icon
      // glyph is exempted from the forced-color system palette and keeps its declared colour.
      const fca = getComputedStyle(calBtn).getPropertyValue('forced-color-adjust').trim()
      expect(fca, 'calendar-button must have forced-color-adjust: none under forced-colors (m3)').toBe('none')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // restore
    }
  })
})

describe('ui-text-field Wave-5B — type=time codec (s11 Wave-5B, both engines)', () => {
  it('CODEC: "14:30" → blur → localized display string (non-empty, the real ICU stack formats it)', () => {
    // The timeCodecOptions format() uses Intl.DateTimeFormat({ timeStyle: 'short' }) on a real ICU stack,
    // producing a locale-appropriate display. This test pins the non-vacuous behavioral outcome: the
    // display is a NON-EMPTY string and DIFFERS from the canonical "14:30" (it is localized).
    const { field, editor } = mount('<ui-text-field type="time"></ui-text-field>')

    ;(field as HTMLElement & { value: string }).value = '14:30'
    editor.textContent = '14:30'
    editor.dispatchEvent(new Event('blur'))

    const display = (field as HTMLElement & { value: string }).value
    expect(display, 'time codec must produce a non-empty display string after blur').toBeTruthy()
    // anti-vacuous: the localized display differs from the canonical HH:MM form (ICU formats it)
    expect(display, 'the localized display must differ from the canonical "14:30"').not.toBe('14:30')
  })

  it('GESTALT: type=time field in a flex row hugs its frame, never a dot (width = the derived padding + border, > 0)', () => {
    const wrap = document.createElement('div')
    wrap.style.display = 'flex'
    wrap.style.flexDirection = 'row'
    wrap.innerHTML = '<ui-text-field type="time"></ui-text-field>'
    document.body.append(wrap)
    mounted.push(wrap)
    const field = wrap.querySelector('ui-text-field') as HTMLElement
    const box = field.getBoundingClientRect()

    expect(box.width, 'type=time field collapsed to zero width in a flex row').toBeGreaterThan(0)
    // ADR-0245 cl.3 frame padding n replaced the old h/2: an empty flex-row item hugs padding + border, so its width
    // (16 at md) is no longer above its 4n height (28). The text-input shape is the frame itself: width >= both
    // inline pads + both hairlines, height the derived 4n.
    const cs = getComputedStyle(field)
    const frame = px(cs.paddingInlineStart) + px(cs.paddingInlineEnd) + px(cs.borderInlineStartWidth) + px(cs.borderInlineEndWidth)
    expect(box.width, 'type=time field is narrower than its own frame (a dot)').toBeGreaterThanOrEqual(frame - 0.5)
    expect(box.height, 'type=time field height is not the derived 4n').toBeCloseTo(resolve('product', 'sm', 'md').h, 0)
  })
})

// ── ADR-0123 LLD-C9: type=color swatch affordance + ui-color-picker overlay — cross-engine browser smoke ─
//
// These tests prove what jsdom cannot:
//   1. SHAPE — type=color field is not a collapsed dot in a flex row.
//   2. OVERLAY — the swatch button opens the picker popup in the top layer (Popover API) on BOTH engines.
//   3. LIVE UPDATE — a real picker `change` (dispatched on the real <ui-color-picker>, since the `all`
//      entry pre-registers it — customElements.get shortcut) updates the field value AND does NOT close the
//      popup (SPEC-R11 — unlike the calendar leg, one channel commit is not "done").
//   4. FOCUS — the swatch button stays a real, focusable anchor for the overlay.
//
// The `@agent-ui/components/all` entry already registers `<ui-color-picker>`,
// so the swatch button's click handler opens synchronously (the customElements.get fast path — the
// ADR-0048 precedent). The popup/`<ui-color-picker>` do not exist in the DOM until the swatch button's
// first click (`ensureColorPicker()`) — every test below queries them AFTER `swatchBtn.click()`.

describe('ui-text-field Wave-C9 — type=color swatch picker (both engines)', () => {
  it('SHAPE: type=color field in a flex row has positive bounding-box and is wider than tall (not a dot)', () => {
    const wrap = document.createElement('div')
    wrap.style.display = 'flex'
    wrap.style.flexDirection = 'row'
    wrap.innerHTML = '<ui-text-field type="color" value="#3b82f6"></ui-text-field>'
    document.body.append(wrap)
    mounted.push(wrap)
    const field = wrap.querySelector('ui-text-field') as HTMLElement
    const box = field.getBoundingClientRect()

    expect(box.width, 'type=color field collapsed to zero width in a flex row').toBeGreaterThan(0)
    expect(box.height, 'type=color field collapsed to zero height in a flex row').toBeGreaterThan(0)
    expect(box.width, 'type=color field is narrower than tall — should be a text-input shape').toBeGreaterThan(box.height)
  })

  it('the swatch-button preview renders a real, non-collapsed ui-swatch immediately (before the picker ever loads)', () => {
    const { field } = mount('<ui-text-field type="color" value="#3b82f6"></ui-text-field>')
    const swatch = field.querySelector('[data-part="swatch-button"] ui-swatch') as HTMLElement
    expect(swatch, 'the swatch preview must be present immediately').not.toBeNull()
    const rect = swatch.getBoundingClientRect()
    expect(rect.width, 'the swatch preview collapsed to zero width').toBeGreaterThan(0)
    expect(rect.height, 'the swatch preview collapsed to zero height').toBeGreaterThan(0)
    expect(field.querySelector('ui-color-picker'), 'the picker itself must not exist before first open').toBeNull()
  })

  it('OVERLAY: swatch button click opens the popup in the top layer (:popover-open)', async () => {
    const { field } = mount('<ui-text-field type="color" value="#3b82f6"></ui-text-field>')
    const swatchBtn = field.querySelector('[data-part="swatch-button"]') as HTMLElement
    expect(swatchBtn, 'swatch-button must be present for type=color').not.toBeNull()
    expect(field.querySelector('[data-part="color-picker-popup"]'), 'popup must not exist before first open').toBeNull()

    swatchBtn.click() // first open: builds the popup + <ui-color-picker> AND opens synchronously
    const popup = field.querySelector('[data-part="color-picker-popup"]') as HTMLElement
    expect(popup, 'color-picker-popup must be present after first open').not.toBeNull()
    const picker = popup.querySelector('ui-color-picker') as HTMLElement & { value: string }
    expect(picker.value, 'the picker must be seeded with the field\'s current value').toBe('#3b82f6')
    await new Promise<void>((r) => setTimeout(r, 0)) // let Popover toggle event (queued task) settle

    expect(popup.matches(':popover-open'), 'popup must be in the Popover top layer after button click').toBe(true)
  })

  it('LIVE UPDATE: a picker `change` updates the field value and does NOT close the popup', async () => {
    const { field } = mount('<ui-text-field type="color" value="#3b82f6"></ui-text-field>')
    const swatchBtn = field.querySelector('[data-part="swatch-button"]') as HTMLElement

    swatchBtn.click()
    const popup = field.querySelector('[data-part="color-picker-popup"]') as HTMLElement
    const picker = popup.querySelector('ui-color-picker') as HTMLElement & { value: string }
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(popup.matches(':popover-open'), 'popup must be open before the picker change').toBe(true)

    const events: string[] = []
    field.addEventListener('input', () => events.push('input'))
    field.addEventListener('change', () => events.push('change'))

    // Simulate a picker commit (what UIColorPickerElement fires on pointer-up / channel blur / readout parse).
    picker.value = '#ff0000'
    picker.dispatchEvent(new Event('change', { bubbles: true, composed: true }))

    expect((field as HTMLElement & { value: string }).value, 'field value must be set to the picked color').toBe('#ff0000')
    expect(events, 'must emit input then change').toEqual(['input', 'change'])

    // Deliberately UNLIKE the calendar leg: the overlay stays open (SPEC-R11 — one channel commit is not "done").
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(popup.matches(':popover-open'), 'the overlay must stay open after a picker change (unlike calendar select)').toBe(true)
  })

  it('the swatch button remains a real, focusable anchor for the overlay', () => {
    const { field } = mount('<ui-text-field type="color" value="#3b82f6"></ui-text-field>')
    const swatchBtn = field.querySelector('[data-part="swatch-button"]') as HTMLElement
    swatchBtn.focus()
    expect(document.activeElement, 'the swatch button must accept real focus').toBe(swatchBtn)
  })
})
