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

// Motion (interaction-states standard) — state-transition timing. Like the focus-ring geometry these are
// CONSTANTS (no var() over a subtree-repointable multiplier), so they live on :root, NOT the derived `*` ramp.
describe('dimensions.css — the motion timing constants (interaction-states standard)', () => {
  it('declares --ui-motion-fast + --ui-ease-standard on :root — constants, not on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--ui-motion-fast:\s*\d+ms\s*;/)
    expect(rootBlock).toMatch(/--ui-ease-standard:\s*cubic-bezier\([^)]*\)\s*;/)
    expect(universalBlock).not.toMatch(/--ui-motion|--ui-ease/) // constants stay off the derived `*` ramp
  })
})

// tok-space (ADR-0015 cl.4) — the --ui-space LAYOUT-SPACING ladder. The container ledger, distinct from the
// control-frame ramp: density rides it (it joins the derived `*` ramp so a subtree [density] re-multiplies),
// but [scale] does NOT touch it (the base px is a literal — layout rhythm is not control-frame size). The
// step VALUES are tokens-specialist's; this pins the contract (where it lives, what multiplier it carries).
describe('dimensions.css — the --ui-space layout-spacing ladder (ADR-0015 cl.4)', () => {
  const STEPS: Array<[string, number]> = [
    ['xs', 4], ['sm', 8], ['md', 12], ['lg', 16], ['xl', 24], ['2xl', 32],
  ]

  it('declares each --ui-space step as calc(<px> * var(--ui-density)) on the `*` block (density-responsive)', () => {
    expect(universalBlock.length).toBeGreaterThan(0) // anti-vacuous: the `*` block was isolated
    expect(universalBlock).toMatch(/--ui-space-none:\s*0\s*;/) // the no-gap rung
    for (const [name, px] of STEPS) {
      const re = new RegExp(`--ui-space-${name}:\\s*calc\\(\\s*${px}px\\s*\\*\\s*var\\(--ui-density\\)\\s*\\)`)
      expect(universalBlock).toMatch(re)
    }
  })

  it('keeps --ui-space SCALE-invariant — the ladder carries --ui-density only, never --ui-scale (layout rhythm ≠ control frame)', () => {
    // every --ui-space declaration references --ui-density, none references --ui-scale
    const decls = universalBlock.match(/--ui-space-[\w-]+:[^;]*;/g) ?? []
    expect(decls.length).toBeGreaterThanOrEqual(STEPS.length) // anti-vacuous
    for (const d of decls) {
      expect(d).not.toMatch(/--ui-scale/)
    }
    // and no [scale] selector touches --ui-space (it is rhythm, not frame)
    const scaleBlocks = css.match(/\[scale="[^"]+"\]\s*\{[^}]*\}/g) ?? []
    expect(scaleBlocks.length).toBeGreaterThan(0)
    for (const block of scaleBlocks) expect(block).not.toMatch(/--ui-space/)
  })

  it('keeps the derived --ui-space ladder OFF :root (the var() pre-substitution gotcha — subtree density stays live)', () => {
    expect(rootBlock).not.toMatch(/--ui-space-/)
  })
})

// tok-radius (ADR-0015 cl.5) — the shared --ui-radius-base. A CONSTANT (not subtree-derived), so on :root,
// NOT the `*` ramp: a container's corner radius does not scale with [scale] (the ADR is explicit). One fleet
// radius seeding the card chain (ADR-0018) + the text-field follow-up (#71).
describe('dimensions.css — the shared --ui-radius-base constant (ADR-0015 cl.5)', () => {
  it('declares --ui-radius-base on :root (a px constant), NOT on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--ui-radius-base:\s*\d+px\s*;/)
    expect(universalBlock).not.toMatch(/--ui-radius-base/) // a constant stays off the derived `*` ramp
  })
})

// tok-type (ADR-0025 cl.3) — the --ui-type-* FLEET typographic scale (the fleet's FIRST type ramp; the
// control-band --ui-font-* is a SEPARATE ledger — document typography, not control-frame glyph). Three legs
// per level: -size on the `*` ramp (× --ui-scale, density-INVARIANT — glyph size is frame-family, not rhythm),
// and -weight + -leading CONSTANTS on :root (leading UNITLESS — a line-height multiplier). A ratio-1.2 modular
// scale anchored at body = 16. ui-text reads --ui-text-* (text.css), never --ui-type-* directly — this pins the
// fleet ramp's shape (each leg's value, where it lives, what multiplier it carries). jsdom can't compute the
// rendered px (the actual subtree-[scale] rescale is the browser smoke); this is the static structural pin.
describe('dimensions.css — the --ui-type-* fleet typographic scale (ADR-0025 cl.3)', () => {
  // level, size-px, weight, leading (unitless). The finalized ramp: 16·1.2^n rounded to nearest integer.
  const LEVELS: Array<[string, number, number, string]> = [
    ['h1', 40, 700, '1.15'],
    ['h2', 33, 700, '1.2'],
    ['h3', 28, 600, '1.25'],
    ['h4', 23, 600, '1.3'],
    ['h5', 19, 600, '1.35'],
    ['body', 16, 400, '1.5'],
    ['caption', 13, 400, '1.4'],
  ]

  it('declares each -size as calc(<px> * var(--ui-scale)) on the `*` block (scale-responsive, like --ui-font-*)', () => {
    expect(universalBlock.length).toBeGreaterThan(0) // anti-vacuous: the `*` block was isolated
    for (const [level, px] of LEVELS) {
      const re = new RegExp(`--ui-type-${level}-size:\\s*calc\\(\\s*${px}px\\s*\\*\\s*var\\(--ui-scale\\)\\s*\\)`)
      expect(universalBlock).toMatch(re)
    }
  })

  it('declares each -weight + -leading as a CONSTANT on :root (scale-free, like the focus-ring/motion constants)', () => {
    expect(rootBlock.length).toBeGreaterThan(0) // anti-vacuous: :root was isolated
    for (const [level, , weight, leading] of LEVELS) {
      expect(rootBlock).toMatch(new RegExp(`--ui-type-${level}-weight:\\s*${weight}\\s*;`))
      expect(rootBlock).toMatch(new RegExp(`--ui-type-${level}-leading:\\s*${leading.replace('.', '\\.')}\\s*;`))
    }
  })

  it('keeps -leading UNITLESS (a bare line-height multiplier — it scales WITH the already-scaled -size)', () => {
    const leadingDecls = rootBlock.match(/--ui-type-[\w-]+-leading:[^;]*;/g) ?? []
    expect(leadingDecls.length).toBe(LEVELS.length) // anti-vacuous: all 7 levels present
    for (const d of leadingDecls) {
      expect(d).toMatch(/--ui-type-[\w-]+-leading:\s*[\d.]+\s*;/) // a number only…
      expect(d).not.toMatch(/px|em|rem|%/) // …no unit (a unit would break the multiplier semantics)
    }
  })

  it('keeps type DENSITY-INVARIANT — no -size references --ui-density, and no [density] selector touches --ui-type', () => {
    const sizeDecls = universalBlock.match(/--ui-type-[\w-]+-size:[^;]*;/g) ?? []
    expect(sizeDecls.length).toBe(LEVELS.length) // anti-vacuous: all 7 -size legs present
    for (const d of sizeDecls) {
      expect(d).not.toMatch(/--ui-density/) // glyph size is frame-family, not rhythm
    }
    const densityBlocks = css.match(/\[density="[^"]+"\]\s*\{[^}]*\}/g) ?? []
    expect(densityBlocks.length).toBeGreaterThan(0)
    for (const block of densityBlocks) expect(block).not.toMatch(/--ui-type/) // [density] never re-multiplies type
  })

  it('puts each leg in the right place — -size OFF :root (the pre-substitution gotcha), -weight/-leading OFF `*` (constants)', () => {
    expect(rootBlock).not.toMatch(/--ui-type-[\w-]+-size/) // derived sizes → the `*` ramp only
    expect(universalBlock).not.toMatch(/--ui-type-[\w-]+-(?:weight|leading)/) // scale-free constants → :root only
  })
})
