import { describe, it, expect } from 'vitest'
// Read text-field.css + the shared dimensions ramp as TEXT (same approach as the
// button s11 geometry probe). jsdom can NOT compute layout px, so these are STATIC structural/formula checks on
// the DECLARED calc()s; the rendered-px CHANGE (sm→md→lg, [scale]) is s11's cross-engine browser smoke, NOT here.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G6 s9 — the STATIC geometry trip-wires for ui-text-field (geometry.md §Mechanization: "a law without a probe
// is not enforced"). ui-text-field is a CONTROL class (geometry.md §"five size-classes"): block-size off the
// ramp, padding-block 0, value edge h/2, slot edge ½(h−icon). This file pins the geometry LAW; the token
// hygiene + state structure is text-field-css.test.ts.

const tfCss = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/text-field/text-field.css`,
  'utf8',
) as string
const dimCss = readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/dimensions.css`, 'utf8') as string

const stylesBlock = tfCss.slice(tfCss.indexOf('@scope (ui-text-field) {'))

/** The declaration block for a `:where(...)` selector — from the marker to its closing brace (flat block). */
const whereBlock = (marker: string): string => {
  const start = tfCss.indexOf(marker)
  if (start < 0) return ''
  return tfCss.slice(start, tfCss.indexOf('}', start))
}

/** The comment-stripped `:root` block of dimensions.css (the ui-md default tier, ADR-0038 explicit table). */
const dimRoot = ((): string => {
  const noComments = dimCss.replace(/\/\*[\s\S]*?\*\//g, '')
  return (noComments.match(/:root\s*\{[^}]*\}/) ?? [''])[0]
})()

/** Parse `--ui-icon-{size}: <n>px` from dimensions.css :root (ADR-0038 / ADR-0035 §1-SET table). */
const iconPx = (size: string): number | null => {
  const m = dimRoot.match(new RegExp(`--ui-icon-${size}:\\s*(\\d+(?:\\.\\d+)?)px\\s*;`))
  return m ? Number(m[1]) : null
}

/** Parse `--ui-height-{size}: <n>px` from dimensions.css :root (ADR-0038 explicit literal table, no × --ui-scale). */
const heightPx = (size: string): number | null => {
  const m = dimRoot.match(new RegExp(`--ui-height-${size}:\\s*(\\d+(?:\\.\\d+)?)px\\s*;`))
  return m ? Number(m[1]) : null
}

// The §1-SET icon ramp's ui-md default (dimensions.css :root, ADR-0038 clause 2): sm·md·lg = 16·18·20.
const iconBySize: Record<string, number | null> = {
  sm: iconPx('sm'),
  md: iconPx('md'),
  lg: iconPx('lg'),
}

/** The geometry LAW as a reusable predicate, so the negative control runs the SAME check on a planted bad scope. */
const paddingBlockIsZero = (scope: string): boolean => {
  const m = scope.match(/padding-block:\s*([^;]+);/)
  if (!m) return false // a Control class MUST declare padding-block — absence is a fail
  return /^0$/.test((m[1] as string).trim()) // block-size is the vertical lever, NEVER block-padding
}

describe('text-field.css — STATIC geometry law (s9)', () => {
  it('block-size reads the ramp and padding-block is 0 (Control class — the vertical lever is block-size)', () => {
    expect(stylesBlock).toMatch(/block-size:\s*var\(--ui-text-field-height\)/)
    expect(paddingBlockIsZero(stylesBlock)).toBe(true)
  })

  it('NEGATIVE control: a block-padding HEIGHT (not 0) FAILS the padding-block law', () => {
    // the planted bad scope pads the block with the height ramp instead of 0 — the predicate must BITE.
    const planted = ':scope { block-size: var(--ui-text-field-height); padding-block: var(--ui-text-field-height); }'
    expect(paddingBlockIsZero(planted)).toBe(false)
  })

  it('0 < glyph ≤ box: the §1-SET icon ramp is positive and fits the height box at every size (ADR-0038 ui-md defaults)', () => {
    // anti-vacuous: the parse found the explicit §1-SET icon ramp from dimensions.css :root (ADR-0038 clause 2,
    // the ui-md default tier): sm=16, md=18, lg=20 — NOT an empty match silently passing the relation below.
    expect(iconBySize).toEqual({ sm: 16, md: 18, lg: 20 })

    for (const size of ['sm', 'md', 'lg'] as const) {
      const icon = iconBySize[size]
      const box = heightPx(size)
      expect(icon, `--ui-icon-${size} did not parse from dimensions.css :root`).not.toBeNull()
      expect(box, `--ui-height-${size} did not parse from dimensions.css :root`).not.toBeNull()
      expect(icon as number).toBeGreaterThan(0) //                  0 < glyph
      expect(icon as number).toBeLessThanOrEqual(box as number) //  glyph ≤ box
    }
  })

  it('ADR-0038 / ADR-0035 wiring: icon reads the shared §1-SET --ui-icon-* table (not a local calc); height is an explicit literal (not × --ui-scale)', () => {
    // ADR-0038 supersedes the multiplier: text-field.css drops calc(Npx × --ui-scale) for icon and reads the
    // shared --ui-icon-* table (ADR-0035 conformance gap now closed — button adopted the table first).
    // dimensions.css :root has explicit `<n>px` literals for height (no × --ui-scale — ADR-0038 clause 5).
    // text-field.css icon wiring
    expect(whereBlock(':where(ui-text-field) {')).toMatch(/--ui-text-field-icon:\s*var\(--ui-icon-md\)/)
    expect(whereBlock(":where(ui-text-field[size='sm'])")).toMatch(/--ui-text-field-icon:\s*var\(--ui-icon-sm\)/)
    expect(whereBlock(":where(ui-text-field[size='lg'])")).toMatch(/--ui-text-field-icon:\s*var\(--ui-icon-lg\)/)
    // the old local calc is gone (ADR-0035 conformance gap closed)
    expect(whereBlock(':where(ui-text-field) {')).not.toMatch(/--ui-text-field-icon:\s*calc\(/)
    // dimensions.css :root: height is now a literal px (no multiplier), confirmed by the `heightPx` parse above
    expect(heightPx('sm'), '--ui-height-sm :root literal parse returned null').not.toBeNull()
    expect(heightPx('md'), '--ui-height-md :root literal parse returned null').not.toBeNull()
    expect(heightPx('lg'), '--ui-height-lg :root literal parse returned null').not.toBeNull()
  })

  it('the slot IS the square cell: [slot=leading] AND [slot=trailing] are sized to --ui-text-field-icon on BOTH axes', () => {
    // the slot model (geometry.md): the adornment cell is a SQUARE of side = the icon ramp, so it centers in a
    // square of its own size and the per-edge ½(h−icon) pad holds. Leading + trailing share the one square rule.
    // the GROUPED square-cell rule (`[slot=leading], [slot=trailing] { … }`) is the LAST `[slot=leading]`
    // occurrence — the earlier ones are the per-slot `order` placement rules. lastIndexOf targets the cell rule.
    const start = stylesBlock.lastIndexOf(":scope > [slot='leading']")
    const block = stylesBlock.slice(start, stylesBlock.indexOf('}', start) + 1)
    expect(block).toMatch(/\[slot='leading'\]/) // the leading adornment cell
    expect(block).toMatch(/\[slot='trailing'\]/) // the trailing adornment cell — same square model
    expect(block).toMatch(/inline-size:\s*var\(--ui-text-field-icon\)/)
    expect(block).toMatch(/block-size:\s*var\(--ui-text-field-icon\)/)
  })

  it('per-edge formula: a slotless VALUE edge = h/2, a present SLOT edge = ½(h−icon)', () => {
    // geometry.md §"Per-edge inline padding". Slotless (bare editor) base: padding-inline h/2 (the value edge).
    expect(stylesBlock).toMatch(/padding-inline:\s*calc\(var\(--ui-text-field-height\)\s*\/\s*2\)/)
    // leading-only [leading | editor]: the START slot edge insets ½(h−icon); the END (slotless) value edge is h/2.
    const leadingOnly = stylesBlock.slice(stylesBlock.indexOf(":scope:has(> [slot='leading']):not"))
    expect(leadingOnly).toMatch(
      /padding-inline-start:\s*calc\(\(var\(--ui-text-field-height\)\s*-\s*var\(--ui-text-field-icon\)\)\s*\/\s*2\)/,
    )
    expect(leadingOnly).toMatch(/padding-inline-end:\s*calc\(var\(--ui-text-field-height\)\s*\/\s*2\)/)
  })

  it('M2 (ADR-0048): calendar-button is in the adornment-button chrome-reset block (no UA border/background)', () => {
    // text-field.css reset block: clear/reveal/step-up/step-down/calendar-button all share the same
    // `border:none; background:none; padding:0; cursor:pointer; font:inherit; color:inherit` reset.
    // Absence would render the calendar icon with default browser button chrome (border + gradient BG).
    expect(stylesBlock).toContain("[data-part='calendar-button']")
    // The calendar-button selector must appear BEFORE the opening brace of the reset declaration block
    // that contains `border: none` — i.e., the button IS in that reset.
    const resetBlockStart = stylesBlock.indexOf("[data-part='calendar-button']")
    const resetBlockEnd   = stylesBlock.indexOf('}', resetBlockStart)
    const resetDecls = stylesBlock.slice(resetBlockStart, resetBlockEnd)
    expect(resetDecls).toMatch(/border:\s*none/)
    expect(resetDecls).toMatch(/background:\s*none/)
    expect(resetDecls).toMatch(/padding:\s*0/)
    expect(resetDecls).toMatch(/cursor:\s*pointer/)
  })

  it('M3 (ADR-0048): calendar-popup [popover] wrapper strips all UA popover chrome to zero', () => {
    // text-field.css: `[popover][data-part='calendar-popup'] { padding:0; border:0; background:transparent; margin:0 }`
    // Without this, UA adds padding/border/background — doubling the visual spacing around the calendar panel.
    const popupStart = stylesBlock.indexOf("[data-part='calendar-popup']")
    expect(popupStart, "calendar-popup rule must exist in text-field.css").toBeGreaterThan(0)
    const popupBlock = stylesBlock.slice(popupStart, stylesBlock.indexOf('}', popupStart))
    expect(popupBlock).toMatch(/padding:\s*0/)
    expect(popupBlock).toMatch(/border:\s*0/)
    expect(popupBlock).toMatch(/background:\s*transparent/)
    expect(popupBlock).toMatch(/margin:\s*0/)
  })

  it('host-as-grid presence structures: 1fr · auto 1fr · 1fr auto · auto 1fr auto, placed by `order`', () => {
    // anatomy.md (ADR-0006/0012): the four presence-driven :has() templates; the editor is the centre value cell,
    // placed by `order` (control-injected, not DOM-ordered).
    const baseScope = stylesBlock.slice(stylesBlock.indexOf(':scope {'))
    expect(baseScope).toMatch(/grid-template-columns:\s*1fr/) // slotless — just the editor
    const leadingOnly = stylesBlock.slice(stylesBlock.indexOf(":scope:has(> [slot='leading']):not"))
    expect(leadingOnly).toMatch(/grid-template-columns:\s*auto 1fr/) // leading + editor
    const trailingOnly = stylesBlock.slice(stylesBlock.indexOf(":scope:has(> [slot='trailing']):not"))
    expect(trailingOnly).toMatch(/grid-template-columns:\s*1fr auto/) // editor + trailing
    const both = stylesBlock.slice(stylesBlock.indexOf(":scope:has(> [slot='leading']):has(> [slot='trailing'])"))
    expect(both).toMatch(/grid-template-columns:\s*auto 1fr auto/) // leading + editor + trailing
    // the editor is the centre cell, placed by order (not DOM order — it is control-injected)
    expect(stylesBlock).toMatch(/:scope > \[data-part='editor'\][^}]*order:\s*1/)
  })
})
