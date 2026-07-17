// wrap-pack.test.ts — exercises `../../tools/themes/wrap-pack.ts` from `src/` (the mini-skills.ts /
// produce-loop.test.ts precedent: the vitest `packages` project only globs `src/**/*.test.ts`, so a
// `tools/`-side script's logic is co-tested from its nearest `src/` sibling, never from inside `tools/`
// itself, which the standing run never collects).
import { describe, it, expect } from 'vitest'
import { extractRootBody, wrapPack } from '../../tools/themes/wrap-pack.ts'

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
