import { describe, it, expect } from 'vitest'
// We read the CSS as text. vite strips `.css?raw` to empty (its CSS pipeline intercepts), so the
// trip-wire's `?raw` glob can't be used for stylesheets; and there is no `@types/node` devDep, so the
// node builtin is untyped here. Suppress the untyped-import + declare the one global we touch.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s6 — the dimensional token ramp (geometry.md; values geometry-sizing-spec.md §1). A STATIC
// structural check: the Control-band height+font ramp tokens exist with the tabled values, and the
// [scale]/[density] multiplier wiring is present and correct (scale on the frame+font; density on the
// rhythm/gap only). The actual rendered-px CHANGE is s13's browser smoke (jsdom can't compute layout px).

// vitest runs from the repo root; read the source CSS as text.
const css = readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/dimensions.css`, 'utf8') as string
const flat = css.replace(/\s+/g, ' ') // whitespace-insensitive `calc(...)` matching

// Isolate a selector's block to pin WHERE a token is declared. Strip CSS comments first (they hold `}`,
// e.g. `{size}`, which would truncate a `[^}]*` block); custom-property VALUES hold no `}`, so on the
// comment-free text `[^}]*` cleanly captures one block. The derived ramp MUST live on `*` (universal), not
// `:root`: a var() in a custom-property value is substituted where the property is DECLARED, so on :root the
// ramp would freeze --ui-scale/--ui-density = 1 and a subtree [scale]/[density] would be dead. The probe
// pins the ramp to the `*` block (and OFF :root) to guard that.
const bare = flat.replace(/\/\*.*?\*\//g, '') // comment-free, single-spaced
const rootBlock = (bare.match(/:root\s*\{[^}]*\}/) ?? [''])[0]
const universalBlock = (bare.match(/(?:^|}|;)\s*\*\s*\{[^}]*\}/) ?? [''])[0]

describe('dimensions.css — the Control-band ramp + scale/density multipliers (s6)', () => {
  it('declares the global multipliers on :root, defaulting to 1', () => {
    expect(css.length).toBeGreaterThan(0) // anti-vacuous: the ?raw glob actually found the CSS
    expect(rootBlock).toMatch(/--ui-scale:\s*1\s*;/)
    expect(rootBlock).toMatch(/--ui-density:\s*1\s*;/)
  })

  it('declares the height ramp (sm·md·lg = 24·28·36) scaled by --ui-scale, on the `*` block', () => {
    expect(universalBlock).toMatch(/--ui-height-sm:\s*calc\(\s*24px\s*\*\s*var\(--ui-scale\)\s*\)/)
    expect(universalBlock).toMatch(/--ui-height-md:\s*calc\(\s*28px\s*\*\s*var\(--ui-scale\)\s*\)/)
    expect(universalBlock).toMatch(/--ui-height-lg:\s*calc\(\s*36px\s*\*\s*var\(--ui-scale\)\s*\)/)
  })

  it('declares the font ramp (sm·md·lg = 13·14·16) scaled by --ui-scale, on the `*` block', () => {
    expect(universalBlock).toMatch(/--ui-font-sm:\s*calc\(\s*13px\s*\*\s*var\(--ui-scale\)\s*\)/)
    expect(universalBlock).toMatch(/--ui-font-md:\s*calc\(\s*14px\s*\*\s*var\(--ui-scale\)\s*\)/)
    expect(universalBlock).toMatch(/--ui-font-lg:\s*calc\(\s*16px\s*\*\s*var\(--ui-scale\)\s*\)/)
  })

  it('derives the rhythm gap from font/2 and multiplies it by --ui-density (the ONE density-bearing quantity), on the `*` block', () => {
    for (const size of ['sm', 'md', 'lg']) {
      const re = new RegExp(`--ui-gap-${size}:\\s*calc\\(\\s*var\\(--ui-font-${size}\\)\\s*/\\s*2\\s*\\*\\s*var\\(--ui-density\\)\\s*\\)`)
      expect(universalBlock).toMatch(re)
    }
  })

  it('keeps the DERIVED ramp OFF :root (the var() pre-substitution gotcha) — so subtree scale/density stay live', () => {
    expect(universalBlock.length).toBeGreaterThan(0) // anti-vacuous: the `*` block was actually isolated
    expect(rootBlock).not.toMatch(/--ui-height|--ui-font|--ui-gap/)
  })

  it('[scale] ancestor selectors repoint --ui-scale (the frame multiplier)', () => {
    expect(flat).toMatch(/\[scale="compact"\]\s*\{\s*--ui-scale:\s*0\.875/)
    expect(flat).toMatch(/\[scale="spacious"\]\s*\{\s*--ui-scale:\s*1\.25/)
    // and a comfortable (=1) baseline exists
    expect(flat).toMatch(/\[scale="comfortable"\]\s*\{\s*--ui-scale:\s*1\s*;/)
  })

  it('[density] ancestor selectors repoint --ui-density (the rhythm multiplier) — NOT the frame', () => {
    expect(flat).toMatch(/\[density="compact"\]\s*\{\s*--ui-density:\s*0\.5/)
    expect(flat).toMatch(/\[density="spacious"\]\s*\{\s*--ui-density:\s*1\.5/)
    // density must NOT repoint the frame: no [density] rule touches --ui-scale or a height/font token
    const densityBlocks = css.match(/\[density="[^"]+"\]\s*\{[^}]*\}/g) ?? []
    expect(densityBlocks.length).toBeGreaterThan(0)
    for (const block of densityBlocks) {
      expect(block).not.toMatch(/--ui-scale|--ui-height|--ui-font/)
    }
  })
})

// tok-focus (ADR-0009) — the shared focus-ring geometry. Width + offset are CONSTANTS (no var() over a
// subtree-repointable multiplier), so they belong on :root, NOT on the `*` ramp: ADR-0007's universal-
// selector rule covers only DERIVED tokens. The probe pins them ON :root and OFF `*`.
describe('dimensions.css — the shared focus-ring geometry constants (ADR-0009)', () => {
  it('declares --ui-focus-ring-width/-offset (2px/2px) on :root — constants, not on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--ui-focus-ring-width:\s*2px\s*;/)
    expect(rootBlock).toMatch(/--ui-focus-ring-offset:\s*2px\s*;/)
    // constants, so they stay OFF the `*` block (ADR-0007's `*` rule is for derived tokens only)
    expect(universalBlock).not.toMatch(/--ui-focus-ring/)
  })
})
