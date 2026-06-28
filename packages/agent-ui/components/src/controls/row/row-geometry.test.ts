import { describe, it, expect } from 'vitest'
// Read row.css + the shared dimensions ramp as text (vite strips `.css?raw`; no `@types/node` devDep —
// same approach as the button s11 geometry probe). jsdom can NOT compute layout px, so these are STATIC
// structural/relation checks on the DECLARED CSS; the rendered-px CHANGE (gap responds to [density], the
// @container reflow) is row.browser.test.ts.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// s3 — the STATIC geometry LAW for ui-row (geometry.md §"five size-classes" → the Container/layout band, and
// §"--space-* is layout spacing, not control geometry"). A layout primitive has NO control frame: it never
// reads the control ramp (`--ui-height/font/gap-*`), declares no `block-size`/`padding-block` frame, and its
// gap is the `--ui-space` LEDGER (rides [density], not [scale]) — a different ledger from the h/2 centring law.

const rowCss = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/row/row.css`, 'utf8') as string
const dimCss = readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/dimensions.css`, 'utf8') as string
const stylesBlock = rowCss.slice(rowCss.indexOf('@scope (ui-row) {'))
const scopeRule = stylesBlock.slice(stylesBlock.indexOf(':scope {'), stylesBlock.indexOf('}', stylesBlock.indexOf(':scope {')) + 1)

describe('row.css — the Container/layout LAW: no control geometry (geometry.md) (s3)', () => {
  it('reads NO control ramp token (--ui-height-*/--ui-font-*/--ui-gap-*) — a container has no frame', () => {
    // the law: spacing is the --ui-space ledger × [density], NEVER the control frame (the h/2 centring ramp).
    expect(rowCss).not.toMatch(/var\(--ui-height-/)
    expect(rowCss).not.toMatch(/var\(--ui-font-/)
    expect(rowCss).not.toMatch(/var\(--ui-gap-/) // --ui-gap-* is the CONTROL slot-rhythm ramp; layout uses --ui-space-*
  })

  it('USES the --ui-space layout-spacing ladder (anti-vacuous: it is the layout ledger, not the control ramp)', () => {
    expect(rowCss).toMatch(/var\(--ui-space-/) // the gap repoints read the layout-spacing ledger
  })

  it('the :scope rule declares NO control frame: no block-size, no padding (height/padding are content-driven)', () => {
    expect(scopeRule.length).toBeGreaterThan(0) // anti-vacuous: the :scope rule was actually sliced
    expect(scopeRule).not.toMatch(/block-size:/) // no control height — the Container/layout class has none
    expect(scopeRule).not.toMatch(/padding-block:/)
    expect(scopeRule).not.toMatch(/padding-inline:/)
    expect(scopeRule).not.toMatch(/padding:/) // gap (between children) is the only spacing lever, not padding
  })
})

describe('row.css — gap is the --ui-space ledger, density-responsive (ADR-0015 cl.4) (s3)', () => {
  it('every gap step repoints to the matching --ui-space-{step} (none..2xl bijection)', () => {
    const steps = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl']
    for (const step of steps) expect(rowCss).toContain(`var(--ui-space-${step})`)
  })

  it('--ui-space rides [density] but NOT [scale] (layout rhythm is not control-frame size — geometry.md)', () => {
    // cross-file law: the ledger the row consumes is density-responsive and scale-INVARIANT. Pin it at the
    // source so a future ramp edit that wires --ui-scale into --ui-space (re-coupling layout to the frame) trips.
    const md = dimCss.match(/--ui-space-md:\s*([^;]+);/)
    expect(md, '--ui-space-md must be declared in dimensions.css').not.toBeNull()
    const decl = (md as RegExpMatchArray)[1]
    expect(decl).toContain('var(--ui-density)') // density re-multiplies the gutter
    expect(decl).not.toContain('var(--ui-scale)') // [scale] resizes controls, not the gutters between them
  })
})

describe('row.css — the corner radius is the shared fleet constant, not an h/2 pill (s3)', () => {
  it('--ui-row-radius reads --ui-radius-base (a container constant — fixed regardless of [scale])', () => {
    expect(rowCss).toMatch(/--ui-row-radius:\s*var\(--ui-radius-base\)/)
    // NOT a control pill radius (calc(height / 2)) — a container radius is the fleet --ui-radius-base (ADR-0015 cl.5)
    expect(rowCss).not.toMatch(/border-radius:\s*calc\(/)
  })
})
