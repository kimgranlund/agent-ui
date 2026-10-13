import { describe, it, expect } from 'vitest'
// Read row.css + the shared dimensions ramp as text (vite strips `.css?raw`; no `@types/node` devDep —
// same approach as the button s11 geometry probe). jsdom can NOT compute layout px, so these are STATIC
// structural/relation checks on the DECLARED CSS; the rendered-px CHANGE (gap responds to [density], the
// @container reflow) is row.browser.test.ts.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// s3 — the STATIC geometry LAW for ui-row (geometry.md §"five size-classes" → the Container/layout band, and
// §"--space-* is layout spacing, not control geometry"). A layout primitive has NO control frame: it never
// reads the control ramp (`--md-sys-height/font/gap-*`), declares no `block-size`/`padding-block` frame, and its
// gap is the `--md-sys-space` LEDGER (rides [density], not [scale]) — a different ledger from the h/2 centring law.

const rowCss = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/row/row.css`, 'utf8') as string
// Since the ADR-0245 cut the --md-sys-space-* steps are bridge aliases of the derived container levels.
const dimCss = readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/foundations-bridge.gen.css`, 'utf8') as string
const stylesBlock = rowCss.slice(rowCss.indexOf('@scope (ui-row) {'))
const scopeRule = stylesBlock.slice(stylesBlock.indexOf(':scope {'), stylesBlock.indexOf('}', stylesBlock.indexOf(':scope {')) + 1)

describe('row.css — the Container/layout LAW: no control geometry (geometry.md) (s3)', () => {
  it('reads NO control ramp token (--md-sys-height-*/--md-sys-font-*/--md-sys-gap-*) — a container has no frame', () => {
    // the law: spacing is the --md-sys-space ledger × [density], NEVER the control frame (the h/2 centring ramp).
    expect(rowCss).not.toMatch(/var\(--md-sys-height-/)
    expect(rowCss).not.toMatch(/var\(--md-sys-font-/)
    expect(rowCss).not.toMatch(/var\(--md-sys-gap-/) // --md-sys-gap-* is the CONTROL slot-rhythm ramp; layout uses --md-sys-space-*
  })

  it('USES the --md-sys-space layout-spacing ladder (anti-vacuous: it is the layout ledger, not the control ramp)', () => {
    expect(rowCss).toMatch(/var\(--md-sys-space-/) // the gap repoints read the layout-spacing ledger
  })

  it('the :scope rule declares NO control frame: no block-size, no padding (height/padding are content-driven)', () => {
    expect(scopeRule.length).toBeGreaterThan(0) // anti-vacuous: the :scope rule was actually sliced
    expect(scopeRule).not.toMatch(/block-size:/) // no control height — the Container/layout class has none
    expect(scopeRule).not.toMatch(/padding-block:/)
    expect(scopeRule).not.toMatch(/padding-inline:/)
    expect(scopeRule).not.toMatch(/padding:/) // gap (between children) is the only spacing lever, not padding
  })
})

describe('row.css — gap is the --md-sys-space ledger, density-responsive (ADR-0015 cl.4) (s3)', () => {
  it('every gap step repoints to the matching --md-sys-space-{step} (none..2xl bijection)', () => {
    const steps = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl']
    for (const step of steps) expect(rowCss).toContain(`var(--md-sys-space-${step})`)
  })

  it('--md-sys-space derives from the element n (ADR-0245 clause 6): md is the group margin n + c', () => {
    // under one n the frame and the rhythm move together (the geometry.md frame/rhythm split retired at the cut).
    const md = dimCss.match(/--md-sys-space-md:\s*([^;]+);/)
    expect(md, '--md-sys-space-md must be declared in the foundations bridge').not.toBeNull()
    expect((md as RegExpMatchArray)[1]).toBe('var(--md-sys-group-margin)')
  })
})

describe('row.css — the corner radius is the shared fleet constant, not an h/2 pill (s3)', () => {
  it('--ui-row-radius reads --md-sys-shape-corner-base (a container constant — fixed regardless of [scale])', () => {
    expect(rowCss).toMatch(/--ui-row-radius:\s*var\(--md-sys-shape-corner-base\)/)
    // NOT a control pill radius (calc(height / 2)) — a container radius is the fleet --md-sys-shape-corner-base (ADR-0015 cl.5)
    expect(rowCss).not.toMatch(/border-radius:\s*calc\(/)
  })
})
