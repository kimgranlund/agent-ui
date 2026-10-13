import { describe, it, expect } from 'vitest'
// Read button.css + the shared dimensions ramp as text (vite strips `.css?raw`; no `@types/node` devDep —
// same approach as the s6/s7 probes). jsdom can NOT compute layout px, so these are STATIC structural/
// formula checks on the DECLARED calc()s; the rendered-px CHANGE (sm→md→lg, [scale]/[density]) is s13's
// cross-engine browser smoke, NOT here.
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s11 — the STATIC geometry trip-wires for ui-button (geometry.md §Mechanization: "a law without
// a probe is not enforced"). This suite pins the geometry LAW that button-css.test.ts (s7) does NOT:
//   • 0 < glyph ≤ box — the content-icon ramp fits inside the height box, at every scale (a CROSS-FILE
//     static relation between button.css's `--ui-button-icon` and dimensions.css's `--md-sys-height-{size}`).
//   • the glyph IS the slot — `[slot=leading]` is a SQUARE cell sized to `--ui-button-icon` (the slot model).
//   • the control rule's edges: the leading slot edge is ½(h−icon) = n and the label edge is the box margin n,
//     with the label part's own inset n - c making the text edge 2n - c (ADR-0245 Amendment 4).
// NOT duplicated here (already pinned by button-css.test.ts s7 — referenced, not re-asserted): the two
// sectioned blocks, `padding-block: 0`, the slotless `padding-inline: h/2`, `column-gap: --ui-button-gap`,
// the `:has()` host-as-grid, every `--ui-button-*` declared in `:where()`, and the @scope token-hygiene
// (no raw `--md-sys-color-*`/ramp ref leaks). This file adds ONLY the geometry-law relations above.

const buttonCss = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/button/button.css`,
  'utf8',
) as string

const stylesBlock = buttonCss.slice(buttonCss.indexOf('@scope (ui-button) {'))

/** The declaration block for a `:where(...)` selector — from the marker to its closing brace (flat block). */
const whereBlock = (marker: string): string => {
  const start = buttonCss.indexOf(marker)
  if (start < 0) return ''
  return buttonCss.slice(start, buttonCss.indexOf('}', start))
}

/** The root register's derived boxes (ADR-0245 clause 2: product at scale sm). Since the cut the icon is the
 *  2n icon box and the height the 4n frame; scale.mjs resolve() is their one source. */
const iconPx = (size: 'sm' | 'md' | 'lg'): number => resolve('product', 'sm', size).icon
const heightPx = (size: 'sm' | 'md' | 'lg'): number => resolve('product', 'sm', size).h

const iconBySize: Record<string, number | null> = {
  sm: iconPx('sm'),
  md: iconPx('md'),
  lg: iconPx('lg'),
}

describe('button.css — STATIC geometry trip-wires (s11)', () => {
  it('0 < glyph ≤ box: the content-icon ramp is positive and fits the height box at every size', () => {
    // anti-vacuous: the root register's 2n icon box (ADR-0245), NOT an empty value silently passing the relation.
    expect(iconBySize).toEqual({ sm: 10, md: 12, lg: 14 }) // 2n at n 5 / 6 / 7

    for (const size of ['sm', 'md', 'lg'] as const) {
      const icon = iconBySize[size]
      const box = heightPx(size)
      expect(icon, `--ui-button-icon for ${size} did not parse`).not.toBeNull()
      expect(box, `--md-sys-height-${size} did not parse`).not.toBeNull()
      expect(icon as number).toBeGreaterThan(0) //              0 < glyph
      expect(icon as number).toBeLessThanOrEqual(box as number) // glyph ≤ box
    }
  })

  it('ADR-0038/ADR-0035: the icon is the shared §1-SET --md-sys-icon table (dimensions.css) — button reads var(--md-sys-icon-{size}), NO pow/calc', () => {
    // ADR-0038 supersedes ADR-0032/0037 (multiplier/snap): height is Kim's explicit lookup, not × --md-sys-scale.
    // ADR-0035 (4a hoist) established the icon table and the var(--md-sys-icon-*) wiring — button.css still reads it.
    // Pin the icon wiring (that pow and calc are gone from the icon decl); height format is tok-mono's (dimensions.test.ts).
    expect(whereBlock(':where(ui-button) {')).toMatch(/--ui-button-icon:\s*var\(--md-sys-icon-box, var\(--md-sys-icon-md\)\)/) //          md → shared token
    expect(whereBlock(":where(ui-button[size='sm'])")).toMatch(/--ui-button-icon:\s*var\(--md-sys-icon-box, var\(--md-sys-icon-sm\)\)/) // sm
    expect(whereBlock(":where(ui-button[size='lg'])")).toMatch(/--ui-button-icon:\s*var\(--md-sys-icon-box, var\(--md-sys-icon-lg\)\)/) // lg
    // the OLD calc/pow icon form is gone — the decl is a bare var(), not a calc()
    expect(whereBlock(':where(ui-button) {')).not.toMatch(/--ui-button-icon:\s*calc\(/)
    // ADR-0036: button.css sets line-height: var(--md-sys-control-line-height) on :scope (the single-line law)
    expect(stylesBlock).toMatch(/line-height:\s*var\(--md-sys-control-line-height\)/)
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

  it('the control rule per edge: leading slot edge = ½(h−icon) = n, label edge = the box margin n, and the asymmetry lives on the label inset', () => {
    // ADR-0245 Amendment 4 (re-derived from the old "asymmetric by design" law, not deleted): the host pads are
    // EQUAL at n, the slot edge as ½(h−icon) and the label edge as the box margin token (n derived, h/2 under the
    // legacy opt-out, where the old asymmetry survives). What still differs per edge is the TEXT: the label part
    // adds its own inset n - c, so the text sits n + labelMargin = 2n - c from its edge and the icon n from its.
    const hasBlock = stylesBlock.slice(stylesBlock.indexOf(":scope:has(> [slot='leading']):not"))
    expect(hasBlock).toMatch(/padding-inline-start:\s*calc\(\(var\(--ui-button-height\)\s*-\s*var\(--ui-button-icon\)\)\s*\/\s*2\)/)
    expect(hasBlock).toMatch(/padding-inline-end:\s*var\(--ui-button-edge\)/)
    expect(whereBlock(':where(ui-button) {')).toMatch(/--ui-button-edge:\s*var\(--md-sys-inset,\s*calc\(var\(--ui-button-height\)\s*\/\s*2\)\)/)
    expect(whereBlock(':where(ui-button) {')).toMatch(/--ui-button-label-inset:\s*var\(--md-sys-label-inset,\s*0px\)/)
    for (const size of ['sm', 'md', 'lg'] as const) {
      const r = resolve('product', 'sm', size)
      expect((r.h - r.icon) / 2, `${size}: the slot edge equals the box margin`).toBe(r.control.margin)
      expect(r.control.margin + r.labelMargin, `${size}: the label's text edge is 2n - c`).toBe(2 * r.n - r.c)
      expect(r.control.gutter + r.labelMargin, `${size}: icon to text is n`).toBe(r.n)
    }
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

  it('[icon-only] is the FIFTH structure — one EXPLICITLY square column (inline-size mirrors block-size), content-centered — and is MUTUALLY EXCLUSIVE with the three slot-bearing structures via :not([icon-only])', () => {
    // the three slot-bearing structures above all exclude [icon-only] (the mutually-exclusive anatomy).
    expect(stylesBlock).toMatch(/:scope:has\(> \[slot='leading'\]\):not\(:has\(> \[slot='trailing'\]\)\):not\(\[icon-only\]\)/)
    expect(stylesBlock).toMatch(/:scope:has\(> \[slot='trailing'\]\):not\(:has\(> \[slot='leading'\]\)\):not\(\[icon-only\]\)/)
    expect(stylesBlock).toMatch(/:scope:has\(> \[slot='leading'\]\):has\(> \[slot='trailing'\]\):not\(\[icon-only\]\)/)

    // the icon-only structure itself: one column, an EXPLICIT square inline-size (mirrors block-size —
    // not a min-inline-size floor, which would let intrinsic sizing add the border on top and overshoot
    // the square), centered via justify-content (no literal padding-inline).
    const m = stylesBlock.match(/:scope\[icon-only\]\s*\{([^}]*)\}/)
    expect(m, ':scope[icon-only] rule missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/grid-template-columns:\s*auto\s*;/) // ONE column — no label track, no gap
    expect(rule).toMatch(/inline-size:\s*var\(--ui-button-height\)/) // EXPLICIT — mirrors block-size, byte-exact square
    expect(rule).not.toMatch(/min-inline-size/) // NOT a floor — a floor lets border overshoot the square (the bug)
    expect(rule).toMatch(/padding-inline:\s*0/) // no literal padding — centering rides justify-content instead
    expect(rule).toMatch(/justify-content:\s*center/) // centers the icon-sized column, mirroring align-items on the block axis
    expect(rule).not.toContain('column-gap') // no label track to gap against
  })
})
