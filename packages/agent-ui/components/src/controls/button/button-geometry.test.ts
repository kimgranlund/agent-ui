import { describe, it, expect } from 'vitest'
// Read button.css + the shared dimensions ramp as text (vite strips `.css?raw`; no `@types/node` devDep —
// same approach as the s6/s7 probes). jsdom can NOT compute layout px, so these are STATIC structural/
// formula checks on the DECLARED calc()s; the rendered-px CHANGE (sm→md→lg, [scale]/[density]) is s13's
// cross-engine browser smoke, NOT here.
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
// (no raw `--md-sys-color-*`/ramp ref leaks). This file adds ONLY the geometry-law relations above.

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

/** The comment-stripped `:root` block of dimensions.css — the no-[scale] DEFAULT tier (where --ui-icon's
 *  ui-md band lives). Strip comments first so `[^}]*` cleanly captures the one block. */
const dimRoot = ((): string => {
  const noComments = dimCss.replace(/\/\*[\s\S]*?\*\//g, '')
  return (noComments.match(/:root\s*\{[^}]*\}/) ?? [''])[0]
})()

/** Parse the :root default `--ui-icon-{size}: <n>px` — the §1-SET icon table's ui-md band (ADR-0035 4a hoist).
 *  The icon is the shared --ui-icon-* token now (hoisted from button.css); the px @ scale 1 lives here. */
const iconPx = (size: string): number | null => {
  const m = dimRoot.match(new RegExp(`--ui-icon-${size}:\\s*(\\d+(?:\\.\\d+)?)px\\s*;`))
  return m ? Number(m[1]) : null
}

/** Parse `--ui-height-{size}: <n>px` from dimensions.css :root (ADR-0038 explicit literal table; no × --ui-scale). */
const heightPx = (size: string): number | null => {
  const m = dimRoot.match(new RegExp(`--ui-height-${size}:\\s*(\\d+(?:\\.\\d+)?)px\\s*;`))
  return m ? Number(m[1]) : null
}

// The §1-SET icon ramp's no-[scale] default (dimensions.css :root, ADR-0035 4a hoist): sm·md·lg = 16·18·20.
// button.css reads var(--ui-icon-{size}) per [size]; the px @ scale 1 is dimensions.css's :root default.
const iconBySize: Record<string, number | null> = {
  sm: iconPx('sm'),
  md: iconPx('md'),
  lg: iconPx('lg'),
}

describe('button.css — STATIC geometry trip-wires (s11)', () => {
  it('0 < glyph ≤ box: the content-icon ramp is positive and fits the height box at every size', () => {
    // anti-vacuous: the parse actually found the §1-SET --ui-icon ramp's :root default (ADR-0035 4a hoist,
    // dimensions.css) — NOT an empty match silently passing the relation below.
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

  it('ADR-0038/ADR-0035: the icon is the shared §1-SET --ui-icon table (dimensions.css) — button reads var(--ui-icon-{size}), NO pow/calc', () => {
    // ADR-0038 supersedes ADR-0032/0037 (multiplier/snap): height is Kim's explicit lookup, not × --ui-scale.
    // ADR-0035 (4a hoist) established the icon table and the var(--ui-icon-*) wiring — button.css still reads it.
    // Pin the icon wiring (that pow and calc are gone from the icon decl); height format is tok-mono's (dimensions.test.ts).
    expect(whereBlock(':where(ui-button) {')).toMatch(/--ui-button-icon:\s*var\(--ui-icon-md\)/) //          md → shared token
    expect(whereBlock(":where(ui-button[size='sm'])")).toMatch(/--ui-button-icon:\s*var\(--ui-icon-sm\)/) // sm
    expect(whereBlock(":where(ui-button[size='lg'])")).toMatch(/--ui-button-icon:\s*var\(--ui-icon-lg\)/) // lg
    // the OLD calc/pow icon form is gone — the decl is a bare var(), not a calc()
    expect(whereBlock(':where(ui-button) {')).not.toMatch(/--ui-button-icon:\s*calc\(/)
    // ADR-0036: button.css sets line-height: var(--ui-control-line-height) on :scope (the single-line law)
    expect(stylesBlock).toMatch(/line-height:\s*var\(--ui-control-line-height\)/)
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
