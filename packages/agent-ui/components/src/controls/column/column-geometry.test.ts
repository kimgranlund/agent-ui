import { describe, it, expect } from 'vitest'
// Read column.css + the shared dimensions ramp as text (vite strips `.css?raw`; no `@types/node` devDep —
// same approach as the button geometry probe). jsdom can NOT compute layout px, so these are STATIC structural/
// cross-file checks on the DECLARED tokens; the rendered gap change (sm→lg, [density]) is column.browser.test.ts.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// s4 — the STATIC geometry trip-wires for ui-column (geometry.md §Mechanization: "a law without a probe is not
// enforced"). The Container/layout size-class law (ADR-0015 / geometry.md):
//   • NO control height — a layout primitive never reads `--ui-height-*` (that is the control band's lever).
//   • spacing is the --ui-space LADDER — every `gap` step maps onto a real `--ui-space-{step}` token, and that
//     ladder is DENSITY-RESPONSIVE (`calc(<px> * var(--ui-density))`), so the gap is the one density-bearing
//     quantity (a CROSS-FILE static relation between column.css's gap repoints and shared dimensions.css).

// Strip `/* … */` comments before the negative scans — a prose mention of `--ui-height-*` in a comment is not a
// real declaration (the rubric reads the shipped code, not the annotation). The cross-file ramp reads are on raw.
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, ' ')
const columnCss = stripComments(
  readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/column/column.css`, 'utf8') as string,
)
const dimCss = readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/dimensions.css`, 'utf8') as string

// The non-`none` gap steps column maps (the flexProps gap union minus the 0 step) — each must resolve to a
// real --ui-space-{step} token in the shared ramp.
const GAP_STEPS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const

describe('column.css — STATIC geometry trip-wires (s4)', () => {
  it('NO control height: a layout primitive never reads --ui-height-* (Container/layout class)', () => {
    expect(columnCss).not.toMatch(/--ui-height-/) // spacing rides --ui-space, never the control-height lever
    // and it declares no fixed block-size frame — the block-size is content-driven
    expect(columnCss).not.toMatch(/block-size:\s*var\(--ui-height/)
  })

  it('every gap step maps onto a real --ui-space-{step} token (the layout-spacing ladder, ADR-0015 cl.4)', () => {
    // anti-vacuous: prove column actually references each --ui-space step before checking it exists in the ramp.
    for (const step of GAP_STEPS) {
      expect(columnCss, `column.css does not map gap=${step}`).toMatch(new RegExp(`var\\(--ui-space-${step}\\)`))
      expect(dimCss, `--ui-space-${step} is not declared in dimensions.css`).toMatch(new RegExp(`--ui-space-${step}:`))
    }
    // the `none` default is the zero step
    expect(columnCss).toMatch(/var\(--ui-space-none\)/)
    expect(dimCss).toMatch(/--ui-space-none:/)
  })

  it('the gap is DENSITY-RESPONSIVE: the --ui-space ladder carries var(--ui-density) (rhythm, not frame)', () => {
    // each non-zero --ui-space step is `calc(<px> * var(--ui-density))`, so a subtree [density] re-multiplies the
    // column gap while no frame moves — the geometry.md split (density rides the rhythm, [scale] does not touch it).
    for (const step of GAP_STEPS) {
      expect(dimCss).toMatch(new RegExp(`--ui-space-${step}:\\s*calc\\([^)]*\\*\\s*var\\(--ui-density\\)\\s*\\)`))
    }
  })
})
