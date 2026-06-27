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
//   • the glyph IS the slot — `[slot=icon]` is a SQUARE cell sized to `--ui-button-icon` (the slot model).
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

/** Parse a `--ui-button-icon: calc(<n>px * var(--ui-scale))` glyph size (px @ scale 1) from a block. */
const iconPx = (block: string): number | null => {
  const m = block.match(/--ui-button-icon:\s*calc\(\s*(\d+(?:\.\d+)?)px\s*\*\s*var\(--ui-scale\)\s*\)/)
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

  it('the glyph↔box relation is SCALE-INVARIANT: both `icon` and `height` carry the same var(--ui-scale)', () => {
    // both the glyph and the box multiply by --ui-scale, so the base-px comparison above holds at EVERY
    // scale (the ratio is scale-invariant) — density never touches either (it rides the gap only, s6).
    expect(whereBlock(':where(ui-button) {')).toMatch(/--ui-button-icon:\s*calc\([^)]*\*\s*var\(--ui-scale\)\s*\)/)
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(dimCss).toMatch(new RegExp(`--ui-height-${size}:\\s*calc\\([^)]*\\*\\s*var\\(--ui-scale\\)\\s*\\)`))
    }
  })

  it('the glyph IS the slot: [slot=icon] is a SQUARE cell sized to --ui-button-icon on BOTH axes', () => {
    // the slot model (geometry.md): the slotted glyph IS the square cell — inline-size == block-size ==
    // the glyph size, so it centers in a square of its own size (no phantom box around it).
    expect(stylesBlock).toMatch(/:scope\s*>\s*\[slot='icon'\]\s*\{[^}]*inline-size:\s*var\(--ui-button-icon\)/)
    expect(stylesBlock).toMatch(/:scope\s*>\s*\[slot='icon'\]\s*\{[^}]*block-size:\s*var\(--ui-button-icon\)/)
  })

  it('per-edge ASYMMETRY by design: leading slot edge = ½(h−icon), trailing label edge = h/2', () => {
    // geometry.md §"Per-edge inline padding": with an icon present the control is asymmetric BY DESIGN —
    // the leading slot edge insets ½(h−icon) while the trailing (slotless) label edge stays h/2. s7 pins
    // that ½(h−icon) appears; here we pin it is the START edge and that END is the slotless h/2.
    const hasBlock = stylesBlock.slice(stylesBlock.indexOf(":scope:has(> [slot='icon'])"))
    expect(hasBlock).toMatch(/padding-inline-start:\s*calc\(\(var\(--ui-button-height\)\s*-\s*var\(--ui-button-icon\)\)\s*\/\s*2\)/)
    expect(hasBlock).toMatch(/padding-inline-end:\s*calc\(var\(--ui-button-height\)\s*\/\s*2\)/)
  })
})
