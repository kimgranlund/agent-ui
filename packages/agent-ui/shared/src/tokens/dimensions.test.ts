import { describe, it, expect } from 'vitest'
// We read the CSS as text. vite strips `.css?raw` to empty (its CSS pipeline intercepts), so the
// trip-wire's `?raw` glob can't be used for stylesheets. Node GLOBALS stay out of the root graph
// (`types` lists only vite/client), so declare the one global we touch.
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
// ramp would freeze --md-sys-scale/--md-sys-density = 1 and a subtree [scale]/[density] would be dead. The probe
// pins the ramp to the `*` block (and OFF :root) to guard that.
const bare = flat.replace(/\/\*.*?\*\//g, '') // comment-free, single-spaced
const rootBlock = (bare.match(/:root\s*\{[^}]*\}/) ?? [''])[0]
const universalBlock = (bare.match(/(?:^|}|;)\s*\*\s*\{[^}]*\}/) ?? [''])[0]

describe('dimensions.css — the Control-band ramp + scale/density multipliers (s6)', () => {
  it('declares the global multipliers on :root, defaulting to 1', () => {
    expect(css.length).toBeGreaterThan(0) // anti-vacuous: the ?raw glob actually found the CSS
    expect(rootBlock).toMatch(/--md-sys-scale:\s*1\s*;/)
    expect(rootBlock).toMatch(/--md-sys-density:\s*1\s*;/)
  })

  it('declares --md-sys-height-{sm,md,lg} as the EXPLICIT per-[scale] table (ADR-0038 Kim lookup — supersedes the × var(--md-sys-scale) multiplier) — :root default + each tier, OFF `*`', () => {
    // tier → [sm,md,lg] height px (Kim's (scale×size) → §1-row table). NO calc, NO var(--md-sys-scale) — literals.
    const TABLE: Array<[string, [number, number, number]]> = [
      ['ui-sm', [20, 24, 28]],
      ['ui-md', [24, 28, 36]],
      ['ui-lg', [28, 36, 48]],
      ['content-sm', [24, 28, 36]], // ≡ ui-md (Kim's band overlap)
      ['content-md', [28, 36, 48]], // ≡ ui-lg
      ['content-lg', [36, 48, 64]],
    ]
    // :root default = the ui-md triple (24/28/36) — byte-identical to today
    expect(rootBlock).toMatch(/--md-sys-height-sm:\s*24px\s*;/)
    expect(rootBlock).toMatch(/--md-sys-height-md:\s*28px\s*;/)
    expect(rootBlock).toMatch(/--md-sys-height-lg:\s*36px\s*;/)
    for (const [tier, [sm, md, lg]] of TABLE) {
      const block = (flat.match(new RegExp(`\\[scale="${tier}"\\]\\s*\\{[^}]*\\}`)) ?? [''])[0]
      expect(block.length, `[scale="${tier}"] block not found`).toBeGreaterThan(0)
      expect(block).toMatch(new RegExp(`--md-sys-height-sm:\\s*${sm}px\\s*;`))
      expect(block).toMatch(new RegExp(`--md-sys-height-md:\\s*${md}px\\s*;`))
      expect(block).toMatch(new RegExp(`--md-sys-height-lg:\\s*${lg}px\\s*;`))
    }
    // OFF the `*` ramp + NO multiplier — `× var(--md-sys-scale)` left the control path (AC5 static analog)
    expect(universalBlock).not.toMatch(/--md-sys-height-\w+:/)
    const heightDecls = flat.match(/--md-sys-height-(?:sm|md|lg):[^;]*;/g) ?? []
    expect(heightDecls.length).toBeGreaterThanOrEqual(21) // 6 tiers × 3 + 3 :root = 21
    for (const d of heightDecls) expect(d).not.toMatch(/calc\(|var\(/)
  })

  it('declares --md-sys-font-{sm,md,lg} as the EXPLICIT per-[scale] table (ADR-0038 Kim rows — re-tables ADR-0035) — :root default + each tier, OFF `*`', () => {
    // tier → [sm,md,lg] font px — the §1 row each cell's height picks (ADR-0038). NO pow, NO calc — literals.
    // ADR-0038 re-derived these from Kim's heights: ui-lg ↑ (md 14→16, lg 16→18); content-sm/md ↓ (= ui-md/ui-lg).
    const TABLE: Array<[string, [number, number, number]]> = [
      ['ui-sm', [12, 13, 14]],
      ['ui-md', [13, 14, 16]],
      ['ui-lg', [14, 16, 18]],
      ['content-sm', [13, 14, 16]], // ≡ ui-md (Kim's band overlap)
      ['content-md', [14, 16, 18]], // ≡ ui-lg
      ['content-lg', [16, 18, 20]],
    ]
    // :root default = the ui-md triple (13/14/16) — byte-identical to today
    expect(rootBlock).toMatch(/--md-sys-font-sm:\s*13px\s*;/)
    expect(rootBlock).toMatch(/--md-sys-font-md:\s*14px\s*;/)
    expect(rootBlock).toMatch(/--md-sys-font-lg:\s*16px\s*;/)
    // each [scale] tier re-tables the triple to its §1-SET integers (content-lg/lg = 20, Kim's case)
    for (const [tier, [sm, md, lg]] of TABLE) {
      const block = (flat.match(new RegExp(`\\[scale="${tier}"\\]\\s*\\{[^}]*\\}`)) ?? [''])[0]
      expect(block.length, `[scale="${tier}"] block not found`).toBeGreaterThan(0)
      expect(block).toMatch(new RegExp(`--md-sys-font-sm:\\s*${sm}px\\s*;`))
      expect(block).toMatch(new RegExp(`--md-sys-font-md:\\s*${md}px\\s*;`))
      expect(block).toMatch(new RegExp(`--md-sys-font-lg:\\s*${lg}px\\s*;`))
    }
    // OFF the `*` ramp (a literal can't ride `*` — it would re-declare per descendant + defeat subtree); the `*`
    // gap still REFERENCES var(--md-sys-font-*), so guard on the DECLARATION form (`--md-sys-font-x:`), not the reference
    expect(universalBlock).not.toMatch(/--md-sys-font-\w+:/)
    // pure px literals — the pow mechanism is GONE from the font path
    const fontDecls = flat.match(/--md-sys-font-(?:sm|md|lg):[^;]*;/g) ?? []
    expect(fontDecls.length).toBeGreaterThanOrEqual(21) // 6 tiers × 3 + 3 :root = 21
    for (const d of fontDecls) expect(d).not.toMatch(/pow\(|calc\(|var\(/)
  })

  it('declares --md-sys-icon-{sm,md,lg} as the EXPLICIT per-[scale] table (ADR-0038 Kim rows — re-tables ADR-0035 4a hoist) — :root default + each tier, OFF `*`', () => {
    // The shared icon token (ADR-0035 4a hoist); ADR-0038 re-derives the per-cell values from Kim's heights:
    // ui-lg ↑ (md 18→20, lg 20→24); content-sm/md ↓ (= ui-md/ui-lg icons). Same explicit-table shape as --md-sys-font.
    const TABLE: Array<[string, [number, number, number]]> = [
      ['ui-sm', [14, 16, 18]],
      ['ui-md', [16, 18, 20]],
      ['ui-lg', [18, 20, 24]],
      ['content-sm', [16, 18, 20]], // ≡ ui-md (Kim's band overlap)
      ['content-md', [18, 20, 24]], // ≡ ui-lg
      ['content-lg', [20, 24, 28]],
    ]
    // :root default = the ui-md icon triple (16/18/20) — byte-identical to today's button icon ramp
    expect(rootBlock).toMatch(/--md-sys-icon-sm:\s*16px\s*;/)
    expect(rootBlock).toMatch(/--md-sys-icon-md:\s*18px\s*;/)
    expect(rootBlock).toMatch(/--md-sys-icon-lg:\s*20px\s*;/)
    for (const [tier, [sm, md, lg]] of TABLE) {
      const block = (flat.match(new RegExp(`\\[scale="${tier}"\\]\\s*\\{[^}]*\\}`)) ?? [''])[0]
      expect(block).toMatch(new RegExp(`--md-sys-icon-sm:\\s*${sm}px\\s*;`))
      expect(block).toMatch(new RegExp(`--md-sys-icon-md:\\s*${md}px\\s*;`))
      expect(block).toMatch(new RegExp(`--md-sys-icon-lg:\\s*${lg}px\\s*;`)) // content-lg/lg = 28 (Kim's case)
    }
    expect(universalBlock).not.toMatch(/--md-sys-icon-\w+:/) // a literal table — off the `*` ramp
    const iconDecls = flat.match(/--md-sys-icon-(?:sm|md|lg):[^;]*;/g) ?? []
    expect(iconDecls.length).toBeGreaterThanOrEqual(21)
    for (const d of iconDecls) expect(d).not.toMatch(/pow\(|calc\(|var\(/) // pure px — pow(scale,0.58) is gone
  })

  it('CONTROLS have NO multiplier (ADR-0038) — height/font/icon are literal tables OFF `*` (no calc/var(--md-sys-scale)); --md-sys-scale survives for --md-sys-typescale-*-size DISPLAY only (ADR-0078); no pow()', () => {
    // ADR-0038: `× var(--md-sys-scale)` LEAVES the control path — height/font/icon are explicit Kim's-table literals.
    expect(bare).not.toMatch(/pow\(/) // file-wide (comment-stripped): the pow primitive is long gone (ADR-0035)
    // none of the three control tokens is declared on `*` (literal tables → :root + [scale])
    expect(universalBlock).not.toMatch(/--md-sys-height-\w+:/)
    expect(universalBlock).not.toMatch(/--md-sys-font-\w+:/)
    expect(universalBlock).not.toMatch(/--md-sys-icon-\w+:/)
    // …and NO control-geometry declaration carries a multiplier (no calc/var(--md-sys-scale)) — the AC5 static analog
    for (const tok of ['height', 'font', 'icon'] as const) {
      const decls = flat.match(new RegExp(`--md-sys-${tok}-(?:sm|md|lg):[^;]*;`, 'g')) ?? []
      expect(decls.length, `--md-sys-${tok}-* decls`).toBeGreaterThanOrEqual(21) // 3 :root + 18 tiers
      for (const d of decls) expect(d).not.toMatch(/calc\(|var\(/) // pure px literal — no --md-sys-scale multiplier
    }
    // DISPLAY --md-sys-typescale-*-size STILL rides --md-sys-scale (ADR-0078 cl.2 — the ONLY surviving --md-sys-scale consumer)
    const typeSizeDecls = universalBlock.match(/--md-sys-typescale-[\w-]+-size:[^;]*;/g) ?? []
    expect(typeSizeDecls.length).toBe(27) // anti-vacuous: all 27 typescale role×size cells (ADR-0078)
    for (const d of typeSizeDecls) expect(d).toMatch(/calc\(\s*\d+px\s*\*\s*var\(--md-sys-scale\)\s*\)/)
  })

  it('derives the rhythm gap from font/2 and multiplies it by --md-sys-density (the ONE density-bearing quantity), on the `*` block', () => {
    for (const size of ['sm', 'md', 'lg']) {
      const re = new RegExp(`--md-sys-gap-${size}:\\s*calc\\(\\s*var\\(--md-sys-font-${size}\\)\\s*/\\s*2\\s*\\*\\s*var\\(--md-sys-density\\)\\s*\\)`)
      expect(universalBlock).toMatch(re)
    }
  })

  it('keeps the genuinely-DERIVED ramp (--md-sys-gap, --ui-type-*-size, --md-sys-space — they carry var(--md-sys-scale)/var(--md-sys-density)) OFF :root', () => {
    expect(universalBlock.length).toBeGreaterThan(0) // anti-vacuous: the `*` block was actually isolated
    // ONLY the tokens that carry a subtree-repointable multiplier must stay off :root (the var() pre-substitution
    // gotcha). ADR-0038 made --md-sys-height a LITERAL table too (joining --md-sys-font/--md-sys-icon from ADR-0035), so all
    // three control tokens legitimately live ON :root (default) — dropped from this guard (the table tests pin them).
    expect(rootBlock).not.toMatch(/--md-sys-gap-|--ui-type-[\w-]+-size|--md-sys-space-/)
  })

  it('declares --md-sys-control-line-height: 1 on :root (ADR-0036) — a single-line control constant, not on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--md-sys-control-line-height:\s*1\s*;/)
    expect(universalBlock).not.toMatch(/--md-sys-control-line-height/) // a constant, off the derived `*` ramp
  })

  it('[scale] still sets --md-sys-scale per tier (ADR-0032 values) — but post-ADR-0038 it feeds --ui-type-* DISPLAY only', () => {
    // tier → --md-sys-scale (ui-* 0.875·1·1.125 · content-* 1.375·1.5·1.75). ADR-0038 removed --md-sys-scale from the
    // CONTROL path (height/font/icon are explicit tables now); these per-tier values survive solely for the
    // display --ui-type-* × var(--md-sys-scale) consumer — so they must still be declared on each [scale] selector.
    const TIERS: Array<[string, string]> = [
      ['ui-sm', '0\\.875'],
      ['ui-md', '1'],
      ['ui-lg', '1\\.125'],
      ['content-sm', '1\\.375'],
      ['content-md', '1\\.5'],
      ['content-lg', '1\\.75'],
    ]
    for (const [tier, val] of TIERS) {
      // --md-sys-scale is the FIRST declaration in each tier block, so this also pins the co-located shape
      expect(flat).toMatch(new RegExp(`\\[scale="${tier}"\\]\\s*\\{\\s*--md-sys-scale:\\s*${val}\\s*;`))
    }
    // ui-md = 1 is the DEFAULT (matches :root --md-sys-scale — today's baseline, no visual shift)
    expect(rootBlock).toMatch(/--md-sys-scale:\s*1\s*;/)
    // the OLD 3-step SCALE vocab is gone — compact/comfortable/spacious is now DENSITY's alone (vocab de-overlapped)
    expect(flat).not.toMatch(/\[scale="comfortable"\]/)
    expect(flat).not.toMatch(/\[scale="spacious"\]/)
  })

  it('[density] ancestor selectors repoint --md-sys-density (the rhythm multiplier) — NOT the frame', () => {
    expect(flat).toMatch(/\[density="compact"\]\s*\{\s*--md-sys-density:\s*0\.5/)
    expect(flat).toMatch(/\[density="spacious"\]\s*\{\s*--md-sys-density:\s*1\.5/)
    // density must NOT repoint the frame: no [density] rule touches --md-sys-scale or a height/font token
    const densityBlocks = css.match(/\[density="[^"]+"\]\s*\{[^}]*\}/g) ?? []
    expect(densityBlocks.length).toBeGreaterThan(0)
    for (const block of densityBlocks) {
      expect(block).not.toMatch(/--md-sys-scale|--md-sys-height|--md-sys-font/)
    }
  })
})

// DIM-COMPACT (ADR-0041) — the --md-sys-compact-* WIDGET-BOX ramp: the box of the Indicator (checkbox/switch/radio)
// + Range (slider) classes (geometry-sizing-spec §5.1's separate size system — NOT --md-sys-height-*). Kim's clean
// 8-value ramp (12·14·16·18·20·22·24·28). Same explicit lookup as ADR-0038's control table: a LITERAL per-[scale]
// table (:root default + [scale] re-tables; [size] picks sm/md/lg), NO --md-sys-scale multiplier, so it can't ride
// `*` (a literal on `*` re-declares per descendant + defeats subtree inheritance). The realm is now CONSUMED
// (ADR-0041 retires §5.2's "forward-ready" note). The browser proves the rendered box with the first widget
// (exec's smoke) — this static probe pins the table + the ALL-DISTINCT-tiers property + the 2px inset.
describe("dimensions.css — the --md-sys-compact-* widget-box ramp (ADR-0041, Kim's 8-value ramp)", () => {
  // tier → [sm, md, lg] widget-box px (ADR-0041 cl.2). ui band byte-unchanged from §5.2; content band re-tabled
  // onto Kim's ramp (off the §5.2 off-ramp 26/32). All 6 triples DISTINCT (the widget box does NOT step).
  const TABLE: Array<[string, [number, number, number]]> = [
    ['ui-sm', [12, 14, 16]],
    ['ui-md', [14, 16, 18]],
    ['ui-lg', [16, 18, 20]],
    ['content-sm', [18, 20, 22]],
    ['content-md', [20, 22, 24]],
    ['content-lg', [22, 24, 28]],
  ]

  it('re-tables --md-sys-compact-{sm,md,lg} per [scale] tier with the ADR-0041 widget-ramp literals', () => {
    for (const [tier, [sm, md, lg]] of TABLE) {
      const block = (flat.match(new RegExp(`\\[scale="${tier}"\\]\\s*\\{[^}]*\\}`)) ?? [''])[0]
      expect(block.length, `[scale="${tier}"] block not found`).toBeGreaterThan(0)
      expect(block).toMatch(new RegExp(`--md-sys-compact-sm:\\s*${sm}px\\s*;`))
      expect(block).toMatch(new RegExp(`--md-sys-compact-md:\\s*${md}px\\s*;`))
      expect(block).toMatch(new RegExp(`--md-sys-compact-lg:\\s*${lg}px\\s*;`))
    }
  })

  it('defaults --md-sys-compact-* to the ui-md band (14·16·18) on :root — the no-[scale] inherited default', () => {
    expect(rootBlock).toMatch(/--md-sys-compact-sm:\s*14px\s*;/)
    expect(rootBlock).toMatch(/--md-sys-compact-md:\s*16px\s*;/)
    expect(rootBlock).toMatch(/--md-sys-compact-lg:\s*18px\s*;/)
  })

  it('keeps --md-sys-compact-* OFF the `*` ramp — a literal table, NOT a --md-sys-scale multiplier (subtree via the [scale] selector)', () => {
    expect(universalBlock).not.toMatch(/--md-sys-compact/) // not derived/multiplied — never on the `*` ramp
    // every --md-sys-compact declaration is a pure px LITERAL — no var() multiplier anywhere (it is a hand-table)
    const compactDecls = flat.match(/--md-sys-compact-[\w-]+:[^;]*;/g) ?? []
    expect(compactDecls.length).toBeGreaterThanOrEqual(21) // 6 tiers × 3 + 3 :root default = 21
    for (const d of compactDecls) {
      expect(d).not.toMatch(/var\(/)
      expect(d).toMatch(/--md-sys-compact-(?:sm|md|lg):\s*\d+px\s*;/)
    }
  })

  it('all SIX [scale] tiers render DISTINCT widget-box triples — the widget box does NOT step (unlike control fonts, ADR-0038)', () => {
    // ADR-0041 cl.2: the widget ramp is dense/linear, so every tier's (sm,md,lg) triple is unique — NO
    // content-sm ≡ ui-md overlap (the control-font stepping). Read each triple straight from the CSS + assert distinct.
    const triples = TABLE.map(([tier]) => {
      const block = (flat.match(new RegExp(`\\[scale="${tier}"\\]\\s*\\{[^}]*\\}`)) ?? [''])[0]
      const sm = block.match(/--md-sys-compact-sm:\s*(\d+)px/)?.[1]
      const md = block.match(/--md-sys-compact-md:\s*(\d+)px/)?.[1]
      const lg = block.match(/--md-sys-compact-lg:\s*(\d+)px/)?.[1]
      return `${sm}·${md}·${lg}`
    })
    for (const t of triples) expect(t, `a [scale] tier's compact triple failed to parse: ${t}`).not.toMatch(/undefined/)
    expect(new Set(triples).size, `widget-box tiers are not all-distinct (a tier stepped): ${triples.join(' / ')}`).toBe(TABLE.length)
  })

  it('declares --md-sys-widget-inset: 2px on :root (ADR-0041 cl.3) — a FLAT thumb-inset constant, not on the `*` ramp', () => {
    // the thumb inset law (thumb = box − 2×inset); a fleet constant, flat across the ramp (frame family,
    // density-invariant) — like --md-sys-shape-corner-base: on :root, off the derived `*` ramp, no multiplier.
    expect(rootBlock).toMatch(/--md-sys-widget-inset:\s*2px\s*;/)
    expect(universalBlock).not.toMatch(/--md-sys-widget-inset/) // a constant — off the derived `*` ramp
    expect(rootBlock).not.toMatch(/--md-sys-widget-inset:[^;]*var\(/) // flat literal — no multiplier
  })
})

// tok-focus (ADR-0009) — the shared focus-ring geometry. Width + offset are CONSTANTS (no var() over a
// subtree-repointable multiplier), so they belong on :root, NOT on the `*` ramp: ADR-0007's universal-
// selector rule covers only DERIVED tokens. The probe pins them ON :root and OFF `*`.
describe('dimensions.css — the shared focus-ring geometry constants (ADR-0009)', () => {
  it('declares --md-sys-state-focus-ring-width/-offset (2px/2px) on :root — constants, not on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--md-sys-state-focus-ring-width:\s*2px\s*;/)
    expect(rootBlock).toMatch(/--md-sys-state-focus-ring-offset:\s*2px\s*;/)
    // constants, so they stay OFF the `*` block (ADR-0007's `*` rule is for derived tokens only)
    expect(universalBlock).not.toMatch(/--md-sys-state-focus-ring/)
  })
})

// Motion (interaction-states standard) — state-transition timing. Like the focus-ring geometry these are
// CONSTANTS (no var() over a subtree-repointable multiplier), so they live on :root, NOT the derived `*` ramp.
describe('dimensions.css — the motion timing constants (interaction-states standard)', () => {
  it('declares --md-sys-motion-duration-fast + --md-sys-motion-easing-standard on :root — constants, not on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--md-sys-motion-duration-fast:\s*\d+ms\s*;/)
    expect(rootBlock).toMatch(/--md-sys-motion-easing-standard:\s*cubic-bezier\([^)]*\)\s*;/)
    expect(universalBlock).not.toMatch(/--ui-motion|--ui-ease/) // constants stay off the derived `*` ramp
  })
})

// tok-space (ADR-0015 cl.4) — the --md-sys-space LAYOUT-SPACING ladder. The container ledger, distinct from the
// control-frame ramp: density rides it (it joins the derived `*` ramp so a subtree [density] re-multiplies),
// but [scale] does NOT touch it (the base px is a literal — layout rhythm is not control-frame size). The
// step VALUES are tokens-specialist's; this pins the contract (where it lives, what multiplier it carries).
describe('dimensions.css — the --md-sys-space layout-spacing ladder (ADR-0015 cl.4)', () => {
  const STEPS: Array<[string, number]> = [
    ['xs', 4], ['sm', 8], ['md', 12], ['lg', 16], ['xl', 24], ['2xl', 32],
  ]

  it('declares each --md-sys-space step as calc(<px> * var(--md-sys-density)) on the `*` block (density-responsive)', () => {
    expect(universalBlock.length).toBeGreaterThan(0) // anti-vacuous: the `*` block was isolated
    expect(universalBlock).toMatch(/--md-sys-space-none:\s*0\s*;/) // the no-gap rung
    for (const [name, px] of STEPS) {
      const re = new RegExp(`--md-sys-space-${name}:\\s*calc\\(\\s*${px}px\\s*\\*\\s*var\\(--md-sys-density\\)\\s*\\)`)
      expect(universalBlock).toMatch(re)
    }
  })

  it('keeps --md-sys-space SCALE-invariant — the ladder carries --md-sys-density only, never --md-sys-scale (layout rhythm ≠ control frame)', () => {
    // every --md-sys-space declaration references --md-sys-density, none references --md-sys-scale
    const decls = universalBlock.match(/--md-sys-space-[\w-]+:[^;]*;/g) ?? []
    expect(decls.length).toBeGreaterThanOrEqual(STEPS.length) // anti-vacuous
    for (const d of decls) {
      expect(d).not.toMatch(/--md-sys-scale/)
    }
    // and no [scale] selector touches --md-sys-space (it is rhythm, not frame)
    const scaleBlocks = css.match(/\[scale="[^"]+"\]\s*\{[^}]*\}/g) ?? []
    expect(scaleBlocks.length).toBeGreaterThan(0)
    for (const block of scaleBlocks) expect(block).not.toMatch(/--md-sys-space/)
  })

  it('keeps the derived --md-sys-space ladder OFF :root (the var() pre-substitution gotcha — subtree density stays live)', () => {
    expect(rootBlock).not.toMatch(/--md-sys-space-/)
  })
})

// tok-radius (ADR-0015 cl.5) — the shared --md-sys-shape-corner-base. A CONSTANT (not subtree-derived), so on :root,
// NOT the `*` ramp: a container's corner radius does not scale with [scale] (the ADR is explicit). One fleet
// radius seeding the card chain (ADR-0018) + the text-field follow-up (#71).
describe('dimensions.css — the shared --md-sys-shape-corner-base constant (ADR-0015 cl.5)', () => {
  it('declares --md-sys-shape-corner-base on :root (a px constant), NOT on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--md-sys-shape-corner-base:\s*\d+px\s*;/)
    expect(universalBlock).not.toMatch(/--md-sys-shape-corner-base/) // a constant stays off the derived `*` ramp
  })
})

// tok-mono — the shared monospace FONT-FAMILY constant (code blocks, inline-code chips, captions). A
// :root constant like the focus-ring / radius constants, NOT the `*` ramp: a font-family carries no
// [scale]/[density] multiplier. Named --md-sys-typeface-mono (NOT --md-sys-font-*) to stay in its own namespace, distinct from
// the --md-sys-font-{sm,md,lg} SIZE table (which ALSO lives on :root now — the §1-SET table, ADR-0035). The probe
// pins the stack ON :root + OFF `*`.
describe('dimensions.css — the shared --md-sys-typeface-mono font-family constant', () => {
  it('declares --md-sys-typeface-mono (the ui-monospace stack) on :root — a constant, not on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--md-sys-typeface-mono:\s*ui-monospace,\s*SFMono-Regular,\s*Menlo,\s*monospace\s*;/)
    expect(universalBlock).not.toMatch(/--md-sys-typeface-mono/) // a constant stays off the derived `*` ramp
    // --md-sys-typeface-mono is a font-FAMILY stack, never a px SIZE — distinct from the --md-sys-font-{sm,md,lg} table
    expect(rootBlock).not.toMatch(/--md-sys-typeface-mono:\s*\d/)
  })
})

// tok-typescale (ADR-0078 cl.2/cl.2b) — the --md-sys-typescale-* FLEET typographic scale, replacing
// ADR-0025 cl.3's --ui-type-* (the control-band --md-sys-font-* stays a SEPARATE ledger — control-frame
// glyph, not document typography). Four legs per role×size cell: -size on the `*` ramp (× --md-sys-scale,
// density-INVARIANT — glyph size is frame-family, not rhythm), -weight/-line-height/-tracking CONSTANTS
// on :root (-line-height UNITLESS, -tracking em). 15 M3-core rows (verbatim against the canonical MD3
// default type scale) + 12 editorial-extension rows (cl.2b). ui-text reads --ui-text-* (text.css), never
// this family directly — this pins the fleet ramp's shape (each leg's value, where it lives, what
// multiplier it carries, and that --ui-type-* has zero survivors). jsdom can't compute the rendered px
// (the actual subtree-[scale] rescale is the browser smoke); this is the static structural pin.
describe('dimensions.css — the --md-sys-typescale-* fleet typographic scale (ADR-0078 cl.2/cl.2b)', () => {
  // role-size, size-px, weight, line-height (unitless), tracking (em string, exactly as declared —
  // literal `0` where M3 tracking is zero, `Nem` otherwise). The 15 M3-core rows (cl.2), M3-verbatim.
  const M3_CORE: Array<[string, number, number, string, string]> = [
    ['display-large', 57, 400, '1.123', '-0.004em'],
    ['display-medium', 45, 400, '1.156', '0'],
    ['display-small', 36, 400, '1.222', '0'],
    ['headline-large', 32, 400, '1.25', '0'],
    ['headline-medium', 28, 400, '1.286', '0'],
    ['headline-small', 24, 400, '1.333', '0'],
    ['title-large', 22, 400, '1.273', '0'],
    ['title-medium', 16, 500, '1.5', '0.009em'],
    ['title-small', 14, 500, '1.429', '0.007em'],
    ['body-large', 16, 400, '1.5', '0.031em'],
    ['body-medium', 14, 400, '1.429', '0.018em'],
    ['body-small', 12, 400, '1.333', '0.033em'],
    ['label-large', 14, 500, '1.429', '0.007em'],
    ['label-medium', 12, 500, '1.333', '0.042em'],
    ['label-small', 11, 500, '1.455', '0.045em'],
  ]
  // the 12 editorial-extension rows (cl.2b) — kicker/overline/quote/lead, each `/* extension — not
  // MD3 */`-marked in dimensions.css.
  const EXTENSIONS: Array<[string, number, number, string, string]> = [
    ['kicker-large', 14, 700, '1.429', '0.08em'],
    ['kicker-medium', 12, 700, '1.333', '0.08em'],
    ['kicker-small', 11, 700, '1.455', '0.08em'],
    ['overline-large', 14, 500, '1.429', '0.15em'],
    ['overline-medium', 12, 500, '1.333', '0.15em'],
    ['overline-small', 11, 500, '1.455', '0.15em'],
    ['lead-large', 22, 400, '1.455', '0'],
    ['lead-medium', 18, 400, '1.444', '0'],
    ['lead-small', 16, 400, '1.5', '0.031em'],
    ['quote-large', 22, 400, '1.455', '0'],
    ['quote-medium', 18, 400, '1.444', '0'],
    ['quote-small', 16, 400, '1.5', '0.031em'],
  ]
  const ALL_ROWS = [...M3_CORE, ...EXTENSIONS]

  it('declares each -size as calc(<px> * var(--md-sys-scale)) on the `*` block, for all 15 M3-core + 12 extension rows', () => {
    expect(universalBlock.length).toBeGreaterThan(0) // anti-vacuous: the `*` block was isolated
    for (const [role, px] of ALL_ROWS) {
      const re = new RegExp(`--md-sys-typescale-${role}-size:\\s*calc\\(\\s*${px}px\\s*\\*\\s*var\\(--md-sys-scale\\)\\s*\\)`)
      expect(universalBlock).toMatch(re)
    }
  })

  it('declares each -weight/-line-height/-tracking as a CONSTANT on :root, matching the exact cl.2/cl.2b table', () => {
    expect(rootBlock.length).toBeGreaterThan(0) // anti-vacuous: :root was isolated
    for (const [role, , weight, lineHeight, tracking] of ALL_ROWS) {
      expect(rootBlock).toMatch(new RegExp(`--md-sys-typescale-${role}-weight:\\s*${weight}\\s*;`))
      expect(rootBlock).toMatch(new RegExp(`--md-sys-typescale-${role}-line-height:\\s*${lineHeight.replace('.', '\\.')}\\s*;`))
      expect(rootBlock).toMatch(new RegExp(`--md-sys-typescale-${role}-tracking:\\s*${tracking.replace('.', '\\.')}\\s*;`))
    }
  })

  it('keeps -line-height UNITLESS (a bare line-height multiplier — it scales WITH the already-scaled -size)', () => {
    const lineHeightDecls = rootBlock.match(/--md-sys-typescale-[\w-]+-line-height:[^;]*;/g) ?? []
    expect(lineHeightDecls.length).toBe(ALL_ROWS.length) // anti-vacuous: all 27 rows present
    for (const d of lineHeightDecls) {
      expect(d).toMatch(/--md-sys-typescale-[\w-]+-line-height:\s*[\d.]+\s*;/) // a number only…
      expect(d).not.toMatch(/px|em|rem|%/) // …no unit (a unit would break the multiplier semantics)
    }
  })

  it('keeps -tracking EM (or bare 0), never a bare non-zero number', () => {
    const trackingDecls = rootBlock.match(/--md-sys-typescale-[\w-]+-tracking:[^;]*;/g) ?? []
    expect(trackingDecls.length).toBe(ALL_ROWS.length) // anti-vacuous: all 27 rows present
    for (const d of trackingDecls) {
      expect(d).toMatch(/--md-sys-typescale-[\w-]+-tracking:\s*(?:0|-?[\d.]+em)\s*;/)
    }
  })

  it('keeps type DENSITY-INVARIANT — no -size references --md-sys-density, and no [density] selector touches --md-sys-typescale', () => {
    const sizeDecls = universalBlock.match(/--md-sys-typescale-[\w-]+-size:[^;]*;/g) ?? []
    expect(sizeDecls.length).toBe(ALL_ROWS.length) // anti-vacuous: all 27 -size legs present
    for (const d of sizeDecls) {
      expect(d).not.toMatch(/--md-sys-density/) // glyph size is frame-family, not rhythm
    }
    const densityBlocks = css.match(/\[density="[^"]+"\]\s*\{[^}]*\}/g) ?? []
    expect(densityBlocks.length).toBeGreaterThan(0)
    for (const block of densityBlocks) expect(block).not.toMatch(/--md-sys-typescale/) // [density] never re-multiplies type
  })

  it('puts each leg in the right place — -size OFF :root (the pre-substitution gotcha), -weight/-line-height/-tracking OFF `*` (constants)', () => {
    expect(rootBlock).not.toMatch(/--md-sys-typescale-[\w-]+-size/) // derived sizes → the `*` ramp only
    expect(universalBlock).not.toMatch(/--md-sys-typescale-[\w-]+-(?:weight|line-height|tracking)/) // scale-free constants → :root only
  })

  it('marks each of the 4 extension families `/* extension — not MD3 */` (kicker/overline/lead/quote) and leaves zero --ui-type- survivors fleet-wide', () => {
    // each family's FIRST (large) row is preceded by the marker comment on :root — the marker precedes the
    // group, not every individual row (medium/small share it by proximity, not by re-declaration)
    for (const family of ['kicker', 'overline', 'lead', 'quote'] as const) {
      const idx = css.indexOf(`--md-sys-typescale-${family}-large-weight`)
      expect(idx, `${family} block not found`).toBeGreaterThan(-1)
      const preceding = css.slice(Math.max(0, idx - 300), idx)
      expect(preceding, `${family} missing the extension marker`).toMatch(/extension — not MD3/)
    }
    // the `*`-ramp -size legs carry the marker too (one comment ahead of the 12 extension -size rows).
    // Read from `css` (comments intact), NOT `universalBlock` (deliberately comment-stripped, so its
    // `[^}]*` block-isolation regex can't be tripped by a stray `}` inside an EXISTING comment, e.g. the
    // gap comment's `--md-sys-gap-{size}`).
    const sizeIdx = css.indexOf('--md-sys-typescale-kicker-large-size')
    expect(sizeIdx).toBeGreaterThan(-1)
    expect(css.slice(Math.max(0, sizeIdx - 150), sizeIdx)).toMatch(/extension — not MD3/)
    // the retired family has zero DECLARATION survivors — ADR-0078 cl.6's zero-survivor regression guard,
    // static half (`bare` is comment-stripped, so the retirement note's own historical mention of
    // `--ui-type-*` in prose, above, doesn't trip this — a live declaration would)
    expect(bare).not.toMatch(/--ui-type-[\w-]+:/)
  })
})
