// site/pages/tokens-doc.test.ts — the standing drift gate for tokens.html. The page derives its whole content
// from the two foundation sheets (@agent-ui/shared/src/tokens/{tokens,dimensions}.css) through the pure
// site/lib/token-parse.ts helpers; this test reads the SAME raw text (via node:fs, not a Vite `?raw` import —
// see the note below) + calls the SAME helpers (never a hand-typed fixture), asserting the parse is non-vacuous
// and shaped as the page assumes — the adr-index.ts / site-toc.test.ts precedent (a build-time text source
// feeding a page is only as trustworthy as a test that the read isn't silently empty).
//
// WHY node:fs, not `?raw`: Vitest transforms every module through vite-node in SSR mode even under the jsdom
// environment (environment: 'jsdom' only sets up window/document globals — module TRANSFORM still runs SSR).
// Vite's own CSS plugin stubs `.css` imports to an empty string under SSR regardless of the `?raw` query
// (verified empirically: `.md?raw` and `.json?raw` both resolve real content under this same test run; only
// `.css?raw` came back `''`). site-toc.test.ts / site-coverage.test.ts already established the fix for exactly
// this class of problem — read the source file directly via node:fs rather than importing it through Vite — so
// this test follows that same "reverse-coupling fs-read" precedent instead of inventing a second one. The
// PRODUCTION page (tokens.ts) still uses the Vite `?raw` import: that code path runs through the real CLIENT
// build (`vite build`/`vite dev`), which does not apply the SSR CSS stub — verified against `npm run build`'s
// output before this page shipped.
import { describe, expect, it } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (site/lib/adr.test.ts precedent)
import { readFileSync } from 'node:fs'
import { familiesOf, parseColorPrimitives, parseColorRoles, parseDimensionRamp } from '../lib/token-parse.ts'

declare const process: { cwd(): string }
const ROOT = process.cwd()
const read = (p: string): string => readFileSync(p, 'utf8')
const tokensCss = read(`${ROOT}/packages/agent-ui/shared/src/tokens/tokens.css`)
const dimensionsCss = read(`${ROOT}/packages/agent-ui/shared/src/tokens/dimensions.css`)

describe('tokens.html source — color roles', () => {
  const roles = parseColorRoles(tokensCss)

  it('parses a non-vacuous set of semantic roles (anti-vacuous: a broken block-scan must fail loudly)', () => {
    expect(roles.length).toBeGreaterThan(100)
  })

  it('excludes the numbered/alpha PRIMITIVE scale steps, not just the semantic roles', () => {
    expect(roles.some((r) => r.varName === '--md-sys-color-neutral-500')).toBe(false)
    expect(roles.some((r) => r.varName === '--md-sys-color-primary-500-200')).toBe(false)
  })

  it('includes a known role from each documented family', () => {
    expect(roles.some((r) => r.varName === '--md-sys-color-neutral-on-surface')).toBe(true)
    expect(roles.some((r) => r.varName === '--md-sys-color-primary-container')).toBe(true)
    expect(roles.some((r) => r.varName === '--md-sys-color-danger-on-surface-variant')).toBe(true)
    expect(roles.some((r) => r.varName === '--md-sys-color-focus-ring')).toBe(true)
  })

  it('derives exactly the ten families the current palette ships (fails loudly if one is added/removed)', () => {
    // TKT-0019 — 'dialog' joins the list: --md-sys-color-dialog-backdrop parses as { family: 'dialog', role:
    // 'backdrop' } via the SAME bare-utility-token shape as 'focus' (parseColorRoles's own doc comment — no
    // special case needed), so it renders as its own one-role family section on tokens.html.
    expect(familiesOf(roles).sort()).toEqual(['accent', 'danger', 'dialog', 'focus', 'info', 'neutral', 'primary', 'secondary', 'success', 'warning'])
  })

  it('every role value is a real declared expression (light-dark(...) or a literal), never empty', () => {
    expect(roles.every((r) => r.value.length > 0)).toBe(true)
  })
})

// The ADDITIVE assertion (token-surfaces.spec.md SPEC-R17 AC2): parseColorPrimitives is a NEW parse helper
// (LLD-C12, the tonal-primitives ui-ramp dogfood section) — parseColorRoles/parseDimensionRamp/familiesOf
// above are UNCHANGED, this only proves the new function resolves a non-empty ordered step set per family
// (so the new section is gate-backed, the same drift discipline as the rest of the page).
describe('tokens.html source — tonal primitives (SPEC-R17 AC2, additive)', () => {
  const primitives = parseColorPrimitives(tokensCss)

  it('resolves a non-vacuous, non-empty family map (anti-vacuous: a broken block-scan must fail loudly)', () => {
    expect(Object.keys(primitives).length).toBeGreaterThan(0)
  })

  it('resolves a non-empty, numerically-ordered step series for a known family (primary)', () => {
    expect(primitives.primary?.length).toBeGreaterThan(0)
    const steps = primitives.primary.map((s) => Number(s.step))
    const sorted = [...steps].sort((a, b) => a - b)
    expect(steps).toEqual(sorted) // numerically ordered, not declaration order
  })

  it('excludes the alpha `-{N}-{aa}` variants (a step is a BARE number, never e.g. "500-050")', () => {
    expect(primitives.primary?.some((s) => s.step === '500-050')).toBe(false)
    expect(primitives.primary?.some((s) => s.step === '500')).toBe(true)
  })

  it('every resolved step carries a real varName + declared value, never empty', () => {
    for (const steps of Object.values(primitives)) {
      for (const step of steps) {
        expect(step.varName).toBe(`--md-sys-color-${step.family}-${step.step}`)
        expect(step.value.length).toBeGreaterThan(0)
      }
    }
  })

  it('a family with no numbered primitives (focus — a bare utility token) resolves to no entry, not a crash', () => {
    expect(primitives.focus).toBeUndefined()
  })

  it('same for dialog (TKT-0019 — --md-sys-color-dialog-backdrop, also a bare utility token)', () => {
    expect(primitives.dialog).toBeUndefined()
  })
})

describe('tokens.html source — dimensional ramps', () => {
  const cases: readonly [string, number][] = [
    ['ui-height', 3], // sm · md · lg
    ['ui-font', 3],
    ['ui-icon', 3],
    ['ui-compact', 3],
    ['ui-space', 7], // none · xs · sm · md · lg · xl · 2xl
  ]

  it.each(cases)('parses the %s ramp with %i tiers, non-vacuous', (prefix, count) => {
    const tiers = parseDimensionRamp(dimensionsCss, prefix)
    expect(tiers.length).toBe(count)
    expect(tiers.every((t) => t.value.length > 0)).toBe(true)
  })

  it('the ui-height ramp reads the default (:root) tiers, not a [scale] override', () => {
    const tiers = parseDimensionRamp(dimensionsCss, 'ui-height')
    expect(tiers.find((t) => t.tier === 'md')?.value).toBe('28px') // the ui-md default (dimensions.css:48)
  })

  it('a prefix absent from the sheet parses to zero tiers (the negative control — proves the regex bites)', () => {
    expect(parseDimensionRamp(dimensionsCss, 'ui-zzfake')).toEqual([])
  })
})
