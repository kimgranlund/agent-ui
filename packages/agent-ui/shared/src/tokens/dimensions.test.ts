import { describe, it, expect } from 'vitest'
// We read the CSS as text. vite strips `.css?raw` to empty (its CSS pipeline intercepts), so the
// trip-wire's `?raw` glob can't be used for stylesheets. Node GLOBALS stay out of the root graph
// (`types` lists only vite/client), so declare the one global we touch.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// dimensions.css after the ADR-0245 cut: the dimensional CONSTANTS only. Every size (the control ramp, the
// widget box, the gap, the space ladder, the typescale -size legs, the container corner) derives from one n
// in foundations.gen.css, and the old names survive one release as aliases in foundations-bridge.gen.css
// (pinned by foundations.test.ts against the generator, and computed against resolve() by
// foundations.browser.test.ts). This file pins that the constants stay put and that the retired ramp is gone.

// vitest runs from the repo root; read the source CSS as text.
const css = readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/dimensions.css`, 'utf8') as string
const flat = css.replace(/\s+/g, ' ') // whitespace-insensitive matching
const bare = flat.replace(/\/\*.*?\*\//g, '') // comment-free, single-spaced
const rootBlock = (bare.match(/:root\s*\{[^}]*\}/) ?? [''])[0]
const universalBlock = (bare.match(/(?:^|}|;)\s*\*\s*\{[^}]*\}/) ?? [''])[0]

describe('dimensions.css: the hand-tabled ramp retired at the cut (ADR-0245 clause 10a)', () => {
  it('declares one :root block of constants and no `*` ramp, [scale], [density] or media block', () => {
    expect(rootBlock.length).toBeGreaterThan(100) // anti-vacuous: :root was isolated
    expect(universalBlock).toBe('')
    expect(bare).not.toMatch(/\[(?:scale|density)\b/)
    expect(bare).not.toMatch(/@media/)
  })

  it('declares none of the old ramp names: they are bridge aliases of the derived values now', () => {
    expect(bare).not.toMatch(/--md-sys-(?:height|font|icon|gap|compact)-(?:sm|md|lg)\s*:/)
    expect(bare).not.toMatch(/--md-sys-(?:space-[\w]+|widget-inset|shape-corner-base|scale|density)\s*:/)
    expect(bare).not.toMatch(/--md-sys-typescale-[\w-]+-size\s*:/)
    expect(bare).not.toMatch(/--ui-bar-inline-inset\s*:/)
  })

  it('declares --md-sys-control-line-height: 1 on :root (ADR-0036, which ADR-0245 keeps)', () => {
    expect(rootBlock).toMatch(/--md-sys-control-line-height:\s*1\s*;/)
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

// Pending/stale-content convention (ADR-0191, GH #974's companion styling half; booked repair GH #999).
// Like the focus-ring/motion geometry these are CONSTANTS (no var() over a subtree-repointable
// multiplier), so they live on :root, NOT the derived `*` ramp. `--ui-pending-duration` is a pure ALIAS of
// `--md-sys-motion-duration-fast` (no new motion primitive); `--ui-pending-opacity` is the new literal.
describe('dimensions.css — the pending/stale-content token pair (ADR-0191)', () => {
  it('declares --ui-pending-duration as an alias of --md-sys-motion-duration-fast, and --ui-pending-opacity: 0.6, on :root — constants, not on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--ui-pending-duration:\s*var\(--md-sys-motion-duration-fast\)\s*;/)
    expect(rootBlock).toMatch(/--ui-pending-opacity:\s*0\.6\s*;/)
    expect(universalBlock).not.toMatch(/--ui-pending-/) // constants stay off the derived `*` ramp
  })
})

// Working/live-surface-mutation convention (ADR-0199, GH #1104) — the `:state(working)` breathing
// treatment's constants. `--ui-working-duration` is the fleet's FIRST LOOP-motion literal (deliberately
// NOT an alias of --md-sys-motion-duration-fast — a 300ms half-cycle is a strobe, not a breath, the
// ADR's cl.4); the opacity pair is the overlay breath's two rungs; the blur is a paint constant like
// the focus-ring width. All :root constants, never on the derived `*` ramp.
describe('dimensions.css — the working/live-mutation constants (ADR-0199)', () => {
  it('declares --ui-working-duration: 1600ms as a NEW loop-motion literal (not an alias), on :root', () => {
    expect(rootBlock).toMatch(/--ui-working-duration:\s*1600ms\s*;/)
  })

  it('declares the opacity rungs 0.15/0.55 and the 24px diffused blur, on :root — constants, not on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--ui-working-opacity-min:\s*0\.15\s*;/)
    expect(rootBlock).toMatch(/--ui-working-opacity-max:\s*0\.55\s*;/)
    expect(rootBlock).toMatch(/--ui-working-blur:\s*24px\s*;/)
    expect(universalBlock).not.toMatch(/--ui-working-/) // constants stay off the derived `*` ramp
  })
})

// tok-mono — the shared monospace FONT-FAMILY constant (code blocks, inline-code chips, captions). A
// :root constant like the focus-ring constants. Named --md-sys-typeface-mono (NOT --md-sys-font-*) to stay
// clear of the --md-sys-font-{sm,md,lg} SIZE names (bridge aliases since the ADR-0245 cut).
describe('dimensions.css — the shared --md-sys-typeface-mono font-family constant', () => {
  it('declares --md-sys-typeface-mono (the ui-monospace stack) on :root — a constant, not on the `*` ramp', () => {
    expect(rootBlock).toMatch(/--md-sys-typeface-mono:\s*ui-monospace,\s*SFMono-Regular,\s*Menlo,\s*monospace\s*;/)
    expect(universalBlock).not.toMatch(/--md-sys-typeface-mono/) // a constant stays off the derived `*` ramp
    // --md-sys-typeface-mono is a font-FAMILY stack, never a px SIZE — distinct from the --md-sys-font-{sm,md,lg} table
    expect(rootBlock).not.toMatch(/--md-sys-typeface-mono:\s*\d/)
  })
})

// tok-typescale (ADR-0078 cl.2/cl.2b) — the --md-sys-typescale-* FLEET typographic scale, replacing
// ADR-0025 cl.3's --ui-type-*. Four legs per role×size cell: the -size leg derives from n since the ADR-0245
// cut (a bridge alias of the clause 7 role, foundations-bridge.gen.css), and -weight/-line-height/-tracking
// stay CONSTANTS on :root here (-line-height UNITLESS, -tracking em). 15 M3-core rows (verbatim against the canonical MD3
// default type scale) + 12 editorial-extension rows (cl.2b). ui-text reads --ui-text-* (text.css), never
// this family directly — this pins the fleet ramp's shape (each leg's value, where it lives, what
// multiplier it carries, and that --ui-type-* has zero survivors). This is the static structural pin.
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
    // GH #370 (Kim's ruling 2026-07-30, option (a)) — the kicker role is 400 weight / 0.2em tracking at
    // every size ("all caps, 20% letter-spaced, 400 weight"); casing stays a consumer treatment.
    ['kicker-large', 14, 400, '1.429', '0.2em'],
    ['kicker-medium', 12, 400, '1.333', '0.2em'],
    ['kicker-small', 11, 400, '1.455', '0.2em'],
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

  it('marks each of the 4 extension families `/* extension — not MD3 */` (kicker/overline/lead/quote) and leaves zero --ui-type- survivors fleet-wide', () => {
    // each family's FIRST (large) row is preceded by the marker comment on :root — the marker precedes the
    // group, not every individual row (medium/small share it by proximity, not by re-declaration)
    for (const family of ['kicker', 'overline', 'lead', 'quote'] as const) {
      const idx = css.indexOf(`--md-sys-typescale-${family}-large-weight`)
      expect(idx, `${family} block not found`).toBeGreaterThan(-1)
      const preceding = css.slice(Math.max(0, idx - 300), idx)
      expect(preceding, `${family} missing the extension marker`).toMatch(/extension — not MD3/)
    }
    // the retired family has zero DECLARATION survivors — ADR-0078 cl.6's zero-survivor regression guard,
    // static half (`bare` is comment-stripped, so the retirement note's own historical mention of
    // `--ui-type-*` in prose, above, doesn't trip this — a live declaration would)
    expect(bare).not.toMatch(/--ui-type-[\w-]+:/)
  })
})

// ADR-0150 — the compact-window body register: ONE `@media (width < 52.5rem)` block AFTER the base `*`
// ramp, re-declaring ONLY the three body -size legs (16/14/12 → 15/13/11), each still riding
// var(--md-sys-scale). Position + exclusivity ARE the contract: both blocks are `*` at specificity
// 0,0,0 and a media query adds none, so later-declaration is the ONLY win condition; any non-body or
// non-`-size` leg in the block would silently widen the ratified scope. The rendered-px truth (13px
// below the line, [scale] composing) is text.browser.test.ts's compact-viewport leg — this is the
