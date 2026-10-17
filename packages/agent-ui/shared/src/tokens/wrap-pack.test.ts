// wrap-pack.test.ts — exercises `../../tools/themes/wrap-pack.ts` from `src/` (the mini-skills.ts /
// produce-loop.test.ts precedent: the vitest `packages` project only globs `src/**/*.test.ts`, so a
// `tools/`-side script's logic is co-tested from its nearest `src/` sibling, never from inside `tools/`
// itself, which the standing run never collects).
import { describe, it, expect } from 'vitest'
import { extractRootBody, wrapPack, repointDarkPrimary } from '../../tools/themes/wrap-pack.ts'

const VALID_EXPORT = `:root {
  color-scheme: light dark;
  --md-sys-color-neutral-100: oklch(0.95 0 0);
  --md-sys-color-primary-on-surface: light-dark(var(--md-sys-color-primary-700), var(--md-sys-color-primary-300));
}
`

describe('extractRootBody', () => {
  it('extracts the :root block body, trimmed', () => {
    const body = extractRootBody(VALID_EXPORT)
    expect(body).toContain('--md-sys-color-neutral-100:')
    expect(body.startsWith('color-scheme')).toBe(true)
  })

  it('throws on missing :root', () => {
    expect(() => extractRootBody('.foo { color: red; }')).toThrow(/no `:root` block/)
  })

  it('throws on missing color-scheme (not scheme-complete)', () => {
    expect(() => extractRootBody(':root { --md-sys-color-neutral-100: oklch(0.95 0 0); }')).toThrow(/color-scheme/)
  })

  it('throws on a foreign (non-md-sys-color) custom property', () => {
    const foreign = ':root { color-scheme: light dark; --ui-button-height: 28px; }'
    expect(() => extractRootBody(foreign)).toThrow(/non-`--md-sys-color-\*`/)
  })

  it('throws on zero declared properties (scheme-complete but otherwise empty)', () => {
    expect(() => extractRootBody(':root { color-scheme: light dark; }')).toThrow(/zero custom properties/)
  })
})

describe('wrapPack', () => {
  it('wraps the export body under [theme=\'<name>\']', () => {
    const pack = wrapPack('ocean', VALID_EXPORT)
    expect(pack).toMatch(/\[theme='ocean'\]\s*\{/)
    expect(pack).toContain('--md-sys-color-neutral-100:')
    expect(pack.trim().endsWith('}')).toBe(true)
  })

  it('rejects an illegal theme name', () => {
    expect(() => wrapPack('Bad Name!', VALID_EXPORT)).toThrow(/not a legal theme name/)
    expect(() => wrapPack('', VALID_EXPORT)).toThrow(/not a legal theme name/)
  })

  it('accepts kebab-case names', () => {
    expect(() => wrapPack('cool-blue-2', VALID_EXPORT)).not.toThrow()
  })

  it('is idempotent: wrapping the same (name, export) pair twice yields byte-identical output', () => {
    expect(wrapPack('ocean', VALID_EXPORT)).toBe(wrapPack('ocean', VALID_EXPORT))
  })

  it('propagates extractRootBody\'s validation (a foreign export never silently wraps)', () => {
    expect(() => wrapPack('ocean', '.foo { color: red; }')).toThrow(/no `:root` block/)
  })
})

// T-0340: repointDarkPrimary derives the dark fill legs from the body's own primary ramp.
describe('repointDarkPrimary', () => {
  // a grey ramp: L only, so the AA crossing is easy to reason about (white ink, L=1)
  const ramp = (ls: Record<string, number>) => Object.entries(ls).map(([s, l]) => `--md-sys-color-primary-${s}: oklch(${l} 0 0);`).join('\n')
  const roles = (rest: string, hover: string, active: string) => `
--md-sys-color-primary: light-dark(var(--md-sys-color-primary-550), var(--md-sys-color-primary-${rest}));
--md-sys-color-primary-hover: light-dark(var(--md-sys-color-primary-650), var(--md-sys-color-primary-${hover}));
--md-sys-color-primary-active: light-dark(var(--md-sys-color-primary-750), var(--md-sys-color-primary-${active}));
--md-sys-color-primary-on-primary: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-050));`
  const STOPS = { '050': 1, '250': 0.82, '350': 0.74, '450': 0.65, '550': 0.56, '600': 0.52, '650': 0.47, '700': 0.43, '750': 0.38, '800': 0.33, '850': 0.29 }

  it('moves dark rest/hover/active onto 600/700/750 when 600 clears AA', () => {
    const out = repointDarkPrimary(ramp(STOPS) + roles('450', '350', '250'))
    expect(out).toContain('--md-sys-color-primary: light-dark(var(--md-sys-color-primary-550), var(--md-sys-color-primary-600));')
    expect(out).toContain('--md-sys-color-primary-hover: light-dark(var(--md-sys-color-primary-650), var(--md-sys-color-primary-700));')
    expect(out).toContain('--md-sys-color-primary-active: light-dark(var(--md-sys-color-primary-750), var(--md-sys-color-primary-750));')
  })

  it('walks darker when the 600 stop fails AA on that ramp (rest 650, hover 750, active 800)', () => {
    const out = repointDarkPrimary(ramp({ ...STOPS, '600': 0.6 }) + roles('450', '350', '250'))
    expect(out).toContain('var(--md-sys-color-primary-550), var(--md-sys-color-primary-650));')
    expect(out).toContain('--md-sys-color-primary-hover: light-dark(var(--md-sys-color-primary-650), var(--md-sys-color-primary-750));')
    expect(out).toContain('--md-sys-color-primary-active: light-dark(var(--md-sys-color-primary-750), var(--md-sys-color-primary-800));')
  })

  it('is idempotent and leaves a body with no primary role untouched', () => {
    const once = repointDarkPrimary(ramp(STOPS) + roles('450', '350', '250'))
    expect(repointDarkPrimary(once)).toBe(once)
    expect(repointDarkPrimary('--md-sys-color-neutral-100: oklch(0.95 0 0);')).toBe('--md-sys-color-neutral-100: oklch(0.95 0 0);')
  })

  it('throws when no stop from 600 clears AA', () => {
    const dim = Object.fromEntries(Object.entries(STOPS).map(([s, l]) => [s, s === '050' ? l : 0.9]))
    expect(() => repointDarkPrimary(ramp(dim) + roles('450', '350', '250'))).toThrow(/clears 4.5:1/)
  })
})
