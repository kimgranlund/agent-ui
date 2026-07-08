import { describe, it, expect } from 'vitest'
// Read modal.css as TEXT (same approach as the button/text-field css probes).
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G9 s9 — modal.css static structural check (ADR-0003 sectioning + token hygiene; ADR-0017 the native-dialog
// surface + ::backdrop scrim; ADR-0015 the surface seam). jsdom can't compute the rendered colours/px nor the
// top-layer paint — these pin the STRUCTURE + the CSS text; the rendered backdrop/top-layer + forced-colors
// survival is modal.browser.test.ts's cross-engine smoke.

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/modal/modal.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-modal) {'), css.indexOf('@scope (ui-modal) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-modal) {'))

// A container reads the role-pure `--ui-container-*` surface SEAM (the cross-family seam every container
// consumes — container.css owns the [elevation]/[brightness] repoints) plus its OWN `--ui-modal-*` chain.
// Nothing else may appear in @scope (no raw `--md-sys-color-*` role, no `--ui-space-*`/`--ui-radius-base` — those enter
// the :where() token block only).
const surfaceSeam = new Set(['--ui-container-bg', '--ui-container-tint'])

/** @scope token-hygiene predicate — every var() ref that is NEITHER the own --ui-modal-* chain NOR the seam. */
const foreignScopeRefs = (scope: string): string[] =>
  [...scope.matchAll(/var\((--[\w-]+)/g)]
    .map((m) => m[1] as string)
    .filter((v) => !surfaceSeam.has(v) && !/^--ui-modal-/.test(v))

describe('modal.css — structure + sectioning (s9)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-modal\)/)
  })

  it('the :where() block sets the modal’s OWN default surface + DECLARES the --ui-modal-* chain from roles/dimensions', () => {
    // ui-modal is an OPAQUE plane — it repoints the container base default (transparent) to a surface role.
    expect(tokenBlock).toMatch(/--ui-container-bg:\s*var\(--md-sys-color-neutral-surface\)/)
    // the own chain (consumed role-pure in @scope) declared from roles + dimensions
    for (const slot of ['ink', 'outline', 'radius', 'padding', 'scrim']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-modal-${slot}:`))
    }
    expect(tokenBlock).toMatch(/--ui-modal-scrim:\s*var\(--md-sys-color-neutral-scrim\)/) // the backdrop wash (a scrim role)
    expect(tokenBlock).toMatch(/--ui-modal-radius:\s*var\(--ui-radius-base\)/) // the shared fleet radius
    expect(tokenBlock).toMatch(/--ui-modal-padding:\s*var\(--ui-space-/) // the density-responsive layout spacing
  })

  it('NO control height — the modal shell never reads --ui-height-* (geometry.md Pattern/container class)', () => {
    expect(css).not.toMatch(/var\(--ui-height-/) // spacing is off --ui-space, never the control-height ramp
    expect(css).not.toContain('color-mix(') // a mix ratio is a component colour opinion (ADR-0008)
  })
})

describe('modal.css — the @scope dialog surface + ::backdrop (s9)', () => {
  it('the host is display:contents (a logical wrapper — only the dialog PART renders)', () => {
    expect(stylesBlock).toMatch(/:scope\s*\{\s*display:\s*contents/)
  })

  it('the dialog part paints the surface from the role-pure --ui-container-* seam (base plane + tonal wash)', () => {
    const m = stylesBlock.match(/:scope > \[data-part='dialog'\]\s*\{([^}]*)\}/)
    expect(m, "the dialog part rule is missing").not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/background-color:\s*var\(--ui-container-bg\)/) // the elevation base plane
    expect(rule).toMatch(/background-image:\s*linear-gradient\(var\(--ui-container-tint\),\s*var\(--ui-container-tint\)\)/) // the brightness wash
    expect(rule).toMatch(/color:\s*var\(--ui-modal-ink\)/)
    expect(rule).toMatch(/border-radius:\s*var\(--ui-modal-radius\)/)
    // Box-model (container-box.css): the dialog is a [data-box] with NO shell padding — its children carry the
    // inset (author regions get the 12/6 region padding PLUS a 6px inset margin, REVISED 2026-07-04; loose
    // content gets the 6px box inset margin only).
    expect(rule).toMatch(/padding:\s*0/)
  })

  it('the ::backdrop reads the scrim from the own chain (the blocking layer)', () => {
    expect(stylesBlock).toMatch(/\[data-part='dialog'\]::backdrop\s*\{\s*background-color:\s*var\(--ui-modal-scrim\)/)
  })
})

describe('modal.css — @scope token hygiene (s9)', () => {
  it('@scope CONSUMES only the own --ui-modal-* chain + the role-pure --ui-container-* surface seam', () => {
    expect(foreignScopeRefs(stylesBlock)).toEqual([]) // no raw --md-sys-color-* / no --ui-space-* / no --ui-radius-base in @scope
    // anti-vacuous: BOTH the seam AND the own chain ARE consumed (the whitelist is live, not dead)
    const allRefs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)
    expect(allRefs.some((v) => surfaceSeam.has(v))).toBe(true)
    expect(allRefs.some((v) => /^--ui-modal-/.test(v))).toBe(true)
  })

  it('NEGATIVE control: a planted raw-primitive --md-sys-color-* ref in @scope is CAUGHT by the hygiene predicate', () => {
    const planted = "@scope (ui-modal) { :scope > [data-part='dialog'] { background: var(--md-sys-color-neutral-surface); } }"
    expect(foreignScopeRefs(planted)).toEqual(['--md-sys-color-neutral-surface'])
  })
})

describe('modal.css — forced-colors survival (s9)', () => {
  it('a forced-colors block keeps the dialog surface/frame/ink visible (Canvas/CanvasText) and drops the wash', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const fc = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/background-color:\s*Canvas/) // the surface survives as a system colour
    expect(fc).toMatch(/background-image:\s*none/) // the tonal wash drops (it would defeat the forced Canvas base)
    expect(fc).toMatch(/border-color:\s*CanvasText/) // the frame survives
    expect(fc).toMatch(/color:\s*CanvasText/) // the ink survives
  })
})
