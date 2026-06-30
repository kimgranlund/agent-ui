import { describe, it, expect } from 'vitest'
// Read button.css + the shared dimensions ramp as text (vite strips `.css?raw`; no `@types/node` devDep —
// same approach as the s6/s7 probes). jsdom can NOT compute layout px, so these are STATIC structural/
// formula checks on the DECLARED calc()s; the rendered-px CHANGE (sm→md→lg, [scale]/[density]) is s13's
// cross-engine browser smoke, NOT here.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s11 — the STATIC geometry trip-wires for ui-button (geometry.md §Mechanization: "a law without
// a probe is not enforced"). This suite pins the geometry LAW that button-css.test.ts (s7) does NOT:
//   • 0 < glyph ≤ box — the content-icon ramp fits inside the height box, at every scale (a CROSS-FILE
//     static relation between button.css's `--ui-button-icon` and dimensions.css's `--ui-height-{size}`).
//   • the glyph IS the slot — `[slot=leading]` is a SQUARE cell sized to `--ui-button-icon` (the slot model).
//   • per-edge ASYMMETRY by design — the leading slot edge is ½(h−icon), the trailing label edge is h/2.
// NOT duplicated here (already pinned by button-css.test.ts s7 — referenced, not re-asserted): the two
// sectioned blocks, `padding-block: 0`, the slotless `padding-inline: h/2`, `column-gap: --ui-button-gap`,
// the `:has()` host-as-grid, every `--ui-button-*` declared in `:where()`, and the @scope token-hygiene
// (no raw `--c-*`/ramp ref leaks). This file adds ONLY the geometry-law relations above.

const buttonCss = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/button/button.css`,
  'utf8',
) as string
const dimCss = readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/dimensions.css`, 'utf8') as string

const stylesBlock = buttonCss.slice(buttonCss.indexOf('@scope (ui-button) {'))

/** The declaration block for a `:where(...)` selector — from the marker to its closing brace (flat block). */
const whereBlock = (marker: string): string => {
  const start = buttonCss.indexOf(marker)
  if (start < 0) return ''
  return buttonCss.slice(start, buttonCss.indexOf('}', start))
}

/** Parse a `--ui-button-icon: calc(<n>px * pow(var(--ui-scale), 0.58))` glyph BASE size (px @ scale 1) from a
 *  block. The icon is SUBLINEAR in [scale] (§1.1, ADR-0033) — the base is the multiplicand, the scale-1 size. */
const iconPx = (block: string): number | null => {
  const m = block.match(/--ui-button-icon:\s*calc\(\s*(\d+(?:\.\d+)?)px\s*\*\s*pow\(\s*var\(--ui-scale\)\s*,\s*0\.58\s*\)\s*\)/)
  return m ? Number(m[1]) : null
}

/** Parse the `--ui-height-{size}: calc(<n>px * var(--ui-scale))` box height (px @ scale 1) from dimensions.css. */
const heightPx = (size: string): number | null => {
  const m = dimCss.match(new RegExp(`--ui-height-${size}:\\s*calc\\(\\s*(\\d+(?:\\.\\d+)?)px\\s*\\*\\s*var\\(--ui-scale\\)\\s*\\)`))
  return m ? Number(m[1]) : null
}

// The per-size `--ui-button-icon`: md is the default (`:where(ui-button)`), sm/lg repoint via `[size]`.
const iconBySize: Record<string, number | null> = {
  sm: iconPx(whereBlock(":where(ui-button[size='sm'])")),
  md: iconPx(whereBlock(':where(ui-button) {')),
  lg: iconPx(whereBlock(":where(ui-button[size='lg'])")),
}

describe('button.css — STATIC geometry trip-wires (s11)', () => {
  it('0 < glyph ≤ box: the content-icon ramp is positive and fits the height box at every size', () => {
    // anti-vacuous: the parse actually found the tabled content-icon ramp (geometry-sizing-spec §1) — NOT
    // an empty match silently passing the relation below.
    expect(iconBySize).toEqual({ sm: 16, md: 18, lg: 20 })

    for (const size of ['sm', 'md', 'lg'] as const) {
      const icon = iconBySize[size]
      const box = heightPx(size)
      expect(icon, `--ui-button-icon for ${size} did not parse`).not.toBeNull()
      expect(box, `--ui-height-${size} did not parse`).not.toBeNull()
      expect(icon as number).toBeGreaterThan(0) //              0 < glyph
      expect(icon as number).toBeLessThanOrEqual(box as number) // glyph ≤ box
    }
  })

  it('ADR-0033: the icon is SUBLINEAR in [scale] (pow 0.58) while the box height stays LINEAR — so icon ≤ box is preserved a fortiori (the ratio only TIGHTENS as scale climbs)', () => {
    // Pre-ADR-0033 the icon and box BOTH carried a bare var(--ui-scale) (a scale-invariant ratio). ADR-0033
    // (§1.1) decouples them: the icon grows on pow(var(--ui-scale), 0.58) — STRICTLY slower than the box's
    // linear var(--ui-scale) — so the content-icon never overruns the frame at the content-* tiers; the
    // base-px `icon ≤ box` proven above only tightens as scale climbs. Pin the two distinct scaling forms.
    const md = whereBlock(':where(ui-button) {')
    expect(md).toMatch(/--ui-button-icon:\s*calc\(\s*\d+px\s*\*\s*pow\(\s*var\(--ui-scale\)\s*,\s*0\.58\s*\)\s*\)/) // sublinear icon
    expect(md).not.toMatch(/--ui-button-icon:\s*calc\(\s*\d+px\s*\*\s*var\(--ui-scale\)\s*\)/) // the OLD bare-linear icon form is gone
    for (const size of ['sm', 'md', 'lg'] as const) {
      const decl = (dimCss.match(new RegExp(`--ui-height-${size}:[^;]*;`)) ?? [''])[0]
      expect(decl, `--ui-height-${size} decl not found`).toMatch(/\*\s*var\(--ui-scale\)/) // the box stays LINEAR…
      expect(decl).not.toMatch(/pow\(/) //                                                    …NOT sublinear (the frame lever holds linear)
    }
  })

  it('the glyph IS the slot: [slot=leading] AND [slot=trailing] are SQUARE cells sized to --ui-button-icon on BOTH axes', () => {
    // the slot model (geometry.md): the slotted glyph IS the square cell — inline-size == block-size ==
    // the glyph size, so it centers in a square of its own size (no phantom box around it). The leading icon
    // and the trailing adornment (caret/arrow, ADR-0006 extended) share the one square-cell rule.
    const slotRule = stylesBlock.slice(stylesBlock.indexOf(":scope > [slot='leading']"))
    const block = slotRule.slice(0, slotRule.indexOf('}') + 1)
    expect(block).toMatch(/\[slot='leading'\]/) // the leading icon cell
    expect(block).toMatch(/\[slot='trailing'\]/) // the trailing adornment cell — same square model
    expect(block).toMatch(/inline-size:\s*var\(--ui-button-icon\)/)
    expect(block).toMatch(/block-size:\s*var\(--ui-button-icon\)/)
  })

  it('per-edge ASYMMETRY by design: leading slot edge = ½(h−icon), trailing label edge = h/2', () => {
    // geometry.md §"Per-edge inline padding": with an icon present the control is asymmetric BY DESIGN —
    // the leading slot edge insets ½(h−icon) while the trailing (slotless) label edge stays h/2. s7 pins
    // that ½(h−icon) appears; here we pin it is the START edge and that END is the slotless h/2.
    const hasBlock = stylesBlock.slice(stylesBlock.indexOf(":scope:has(> [slot='leading']):not"))
    expect(hasBlock).toMatch(/padding-inline-start:\s*calc\(\(var\(--ui-button-height\)\s*-\s*var\(--ui-button-icon\)\)\s*\/\s*2\)/)
    expect(hasBlock).toMatch(/padding-inline-end:\s*calc\(var\(--ui-button-height\)\s*\/\s*2\)/)
  })

  it('the trailing adornment anatomy: [label|caret] is 1fr auto, [icon|label|caret] is auto 1fr auto (ADR-0006 extended)', () => {
    // host-as-grid extended (ADR-0006): a trailing [slot=trailing] caret/arrow gives the symmetric structures.
    // [label | caret] (no icon): 1fr auto, trailing slot edge ½(h−icon), leading label edge stays h/2.
    const trailingOnly = stylesBlock.slice(stylesBlock.indexOf(":scope:has(> [slot='trailing']):not"))
    expect(trailingOnly).toMatch(/grid-template-columns:\s*1fr\s+auto/)
    expect(trailingOnly).toMatch(/padding-inline-end:\s*calc\(\(var\(--ui-button-height\)\s*-\s*var\(--ui-button-icon\)\)\s*\/\s*2\)/)
    // [icon | label | caret]: auto 1fr auto — both adornment edges ½(h−icon).
    const both = stylesBlock.slice(stylesBlock.indexOf(":scope:has(> [slot='leading']):has(> [slot='trailing'])"))
    expect(both).toMatch(/grid-template-columns:\s*auto\s+1fr\s+auto/)
  })
})
