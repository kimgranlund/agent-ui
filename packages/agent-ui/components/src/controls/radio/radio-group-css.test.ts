import { describe, it, expect } from 'vitest'
// Read radio-group.css as TEXT (the same readFileSync approach as the button/tabs
// probes). jsdom can't compute rendered px — this pins the STRUCTURE + token hygiene of the DECLARED CSS; the
// rendered px (gap/wrap/[density]) + the negative control live in radio-group.browser.test.ts.

import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/radio/radio-group.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-radio-group) {'), css.indexOf('@scope (ui-radio-group) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-radio-group) {'))

/** @scope token-hygiene predicate — every var() ref that is NOT the own --ui-radio-group-* chain. */
const foreignScopeRefs = (scope: string): string[] =>
  [...scope.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string).filter((v) => !/^--ui-radio-group-/.test(v))

describe('radio-group.css — structure + token hygiene (ADR-0103)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-radio-group\)/)
  })

  it('declares --ui-radio-group-gap off the layout ladder (--md-sys-space-sm, ADR-0103 clause 2)', () => {
    expect(tokenBlock).toMatch(/--ui-radio-group-gap:\s*var\(--md-sys-space-sm\)/)
  })

  it('@scope consumes ONLY --ui-radio-group-* (no raw --md-sys-space-* / --md-sys-color-* leakage)', () => {
    expect(foreignScopeRefs(stylesBlock)).toEqual([])
  })

  it('the vertical (default) rule: display flex, column, gap var(--ui-radio-group-gap)', () => {
    const m = /:scope \{([^}]*)\}/.exec(stylesBlock)
    expect(m, 'no bare :scope {...} rule found').not.toBeNull()
    const scopeRule = m?.[1] ?? ''
    expect(scopeRule).toMatch(/display:\s*flex/)
    expect(scopeRule).toMatch(/flex-direction:\s*column/)
    expect(scopeRule).toMatch(/gap:\s*var\(--ui-radio-group-gap\)/)
  })

  it("[orientation='horizontal'] repoints to a wrapping row, centred cross-axis", () => {
    const m = /:scope\[orientation='horizontal'\] \{([^}]*)\}/.exec(stylesBlock)
    expect(m, "no :scope[orientation='horizontal'] {...} rule found").not.toBeNull()
    const horizRule = m?.[1] ?? ''
    expect(horizRule).toMatch(/flex-direction:\s*row/)
    expect(horizRule).toMatch(/flex-wrap:\s*wrap/)
    expect(horizRule).toMatch(/align-items:\s*center/)
  })

  it('carries a forced-colors block (fleet discipline, no visual surface of its own)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
  })
})
