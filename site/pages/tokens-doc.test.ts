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
import { familiesOf, parseColorRoles, parseDimensionRamp } from '../lib/token-parse.ts'

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

  it('derives exactly the nine families the current palette ships (fails loudly if one is added/removed)', () => {
    expect(familiesOf(roles).sort()).toEqual(['danger', 'focus', 'info', 'neutral', 'primary', 'secondary', 'success', 'tertiary', 'warning'])
  })

  it('every role value is a real declared expression (light-dark(...) or a literal), never empty', () => {
    expect(roles.every((r) => r.value.length > 0)).toBe(true)
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
