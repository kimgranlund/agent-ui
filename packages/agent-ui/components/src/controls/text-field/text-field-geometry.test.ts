import { describe, it, expect } from 'vitest'
// Read text-field.css + the shared dimensions ramp as TEXT (no @types/node devDep — same approach as the
// button s11 geometry probe). jsdom can NOT compute layout px, so these are STATIC structural/formula checks on
// the DECLARED calc()s; the rendered-px CHANGE (sm→md→lg, [scale]) is s11's cross-engine browser smoke, NOT here.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
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

/** Parse a `--ui-text-field-icon: calc(<n>px * var(--ui-scale))` glyph size (px @ scale 1) from a block. */
const iconPx = (block: string): number | null => {
  const m = block.match(/--ui-text-field-icon:\s*calc\(\s*(\d+(?:\.\d+)?)px\s*\*\s*var\(--ui-scale\)\s*\)/)
  return m ? Number(m[1]) : null
}

/** Parse the `--ui-height-{size}: calc(<n>px * var(--ui-scale))` box height (px @ scale 1) from dimensions.css. */
const heightPx = (size: string): number | null => {
  const m = dimCss.match(
    new RegExp(`--ui-height-${size}:\\s*calc\\(\\s*(\\d+(?:\\.\\d+)?)px\\s*\\*\\s*var\\(--ui-scale\\)\\s*\\)`),
  )
  return m ? Number(m[1]) : null
}

// The per-size `--ui-text-field-icon`: md is the default (`:where(ui-text-field)`), sm/lg repoint via `[size]`.
const iconBySize: Record<string, number | null> = {
  sm: iconPx(whereBlock(":where(ui-text-field[size='sm'])")),
  md: iconPx(whereBlock(':where(ui-text-field) {')),
  lg: iconPx(whereBlock(":where(ui-text-field[size='lg'])")),
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

  it('0 < glyph ≤ box: the content-icon ramp is positive and fits the height box at every size', () => {
    // anti-vacuous: the parse actually found the tabled content-icon ramp (geometry-sizing-spec §1, mirrored
    // off button md=18/sm=16/lg=20) — NOT an empty match silently passing the relation below.
    expect(iconBySize).toEqual({ sm: 16, md: 18, lg: 20 })

    for (const size of ['sm', 'md', 'lg'] as const) {
      const icon = iconBySize[size]
      const box = heightPx(size)
      expect(icon, `--ui-text-field-icon for ${size} did not parse`).not.toBeNull()
      expect(box, `--ui-height-${size} did not parse`).not.toBeNull()
      expect(icon as number).toBeGreaterThan(0) //                  0 < glyph
      expect(icon as number).toBeLessThanOrEqual(box as number) //  glyph ≤ box
    }
  })

  it('the glyph↔box relation is SCALE-INVARIANT: both `icon` and `height` carry the same var(--ui-scale)', () => {
    // both glyph and box multiply by --ui-scale, so the base-px comparison above holds at EVERY scale; density
    // never touches either (it rides the gap only).
    expect(whereBlock(':where(ui-text-field) {')).toMatch(
      /--ui-text-field-icon:\s*calc\([^)]*\*\s*var\(--ui-scale\)\s*\)/,
    )
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(dimCss).toMatch(new RegExp(`--ui-height-${size}:\\s*calc\\([^)]*\\*\\s*var\\(--ui-scale\\)\\s*\\)`))
    }
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
