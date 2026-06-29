import { describe, it, expect } from 'vitest'
// Read text-field.css as TEXT (no @types/node devDep — same approach as the button s7 css probe).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G6 s9 — text-field.css static structural check (ADR-0003 sectioning + token hygiene; ADR-0014 the
// BORDER-channel state ladder + the :focus-within ring-only focus (transparent border) + the disabled role-repoint; anatomy.md
// host-as-grid). jsdom can't compute the rendered colours/px — these pin the STRUCTURE + the CSS text; the
// rendered px CHANGE + forced-colors survival is s11's cross-engine smoke. The geometry LAW is
// text-field-geometry.test.ts.

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/text-field/text-field.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-text-field) {'), css.indexOf('@scope (ui-text-field) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-text-field) {'))

/** A `:where(...)` declaration block by marker — from the marker to its closing brace (flat block). */
const whereBlock = (marker: string): string => {
  const start = tokenBlock.indexOf(marker)
  return start < 0 ? '' : tokenBlock.slice(start, tokenBlock.indexOf('}', start))
}

// The fleet tokens a control reads DIRECTLY in @scope (never repointed through the component chain, so every
// control draws the identical ring / uses the identical timing): the shared focus ring (ADR-0009) + the shared
// state-transition motion (interaction-states standard). Everything else in @scope must be the own chain.
const sharedFleet = new Set([
  '--c-focus-ring',
  '--ui-focus-ring-width',
  '--ui-focus-ring-offset',
  '--ui-motion-fast',
  '--ui-ease-standard',
])

/** @scope token-hygiene predicate — every var() ref that is NEITHER the own --ui-text-field-* chain NOR a fleet
 *  token. Reused by the negative control so the planted bad scope runs the IDENTICAL check. */
const foreignScopeRefs = (scope: string): string[] =>
  [...scope.matchAll(/var\((--[\w-]+)/g)]
    .map((m) => m[1] as string)
    .filter((v) => !sharedFleet.has(v) && !/^--ui-text-field-/.test(v))

describe('text-field.css — structure + sectioning (s9)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK') // sectioned banners distinguish declaration vs consumption
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-text-field\)/)
  })

  it('the :where() block DECLARES the full --ui-text-field-* chain from colour roles + the dimensional ramp', () => {
    for (const slot of ['border', 'bg', 'ink', 'placeholder', 'height', 'font', 'gap', 'icon']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-text-field-${slot}:`))
    }
    expect(tokenBlock).toContain('var(--c-neutral') // the field-frame roles (family = neutral)
    expect(tokenBlock).toContain('var(--ui-height-md)') // the dimensional ramp
  })

  it('[size] repoints the geometry ramp (height/font/gap/icon) for sm and lg', () => {
    for (const size of ['sm', 'lg'] as const) {
      const b = whereBlock(`:where(ui-text-field[size='${size}'])`)
      expect(b).toMatch(/--ui-text-field-height:/)
      expect(b).toMatch(/--ui-text-field-icon:\s*calc\(\d+px\s*\*\s*var\(--ui-scale\)\)/)
    }
  })
})

// ── The BORDER-channel state ladder (ADR-0014 cl.2c) ─────────────────────────────────────────────────────
// A text field has no pressed/active state, so the button's BACKGROUND ladder does not apply — the state is a
// BORDER channel. The SOLID role ladder (NOT soft-alpha — alpha outlines resolve sub-3:1 against the field
// surface, failing WCAG 1.4.11) is declared per-state in the :where() token block, consumed at the matching
// pseudo-/custom-state in @scope. Roles, never a color-mix (colour opinions live in the token layer).
describe('text-field.css — the SOLID border-channel ladder (ADR-0014 cl.2c)', () => {
  it('declares the full border ladder from the PINNED roles: idle/hover/focus/invalid/invalid+hover', () => {
    const b = whereBlock(':where(ui-text-field) {')
    expect(b).toMatch(/--ui-text-field-border:\s*var\(--c-neutral\)/) // idle
    expect(b).toMatch(/--ui-text-field-border-hover:\s*var\(--c-neutral-high\)/) // hover
    expect(b).toMatch(/--ui-text-field-border-focus:\s*transparent/) // focus = transparent (the outline ring is the sole indicator; ADR-0014 dev#1)
    expect(b).toMatch(/--ui-text-field-border-invalid:\s*var\(--c-danger\)/) // user-invalid
    expect(b).toMatch(/--ui-text-field-border-invalid-hover:\s*var\(--c-danger-high\)/) // invalid + hover
  })

  it('the field surface roles: bg=surface · ink=on-surface · placeholder=on-surface-variant', () => {
    const b = whereBlock(':where(ui-text-field) {')
    expect(b).toMatch(/--ui-text-field-bg:\s*var\(--c-neutral-surface\)/)
    expect(b).toMatch(/--ui-text-field-ink:\s*var\(--c-neutral-on-surface\)/)
    expect(b).toMatch(/--ui-text-field-placeholder:\s*var\(--c-neutral-on-surface-variant\)/)
  })

  it('the ladder is SOLID role steps — NEVER a color-mix, NEVER a soft-alpha primitive', () => {
    expect(css).not.toContain('color-mix(') // a mix ratio is a component colour opinion (ADR-0008/0014)
    // no alpha primitive (`--c-*-500-NNN`) and no scrim role leaks into the border channel — SOLID only.
    const borderDecls = [...tokenBlock.matchAll(/--ui-text-field-border[\w-]*:\s*([^;]+);/g)].map((m) => m[1] as string)
    expect(borderDecls.length).toBeGreaterThan(0) // anti-vacuous: the border tokens were actually found
    for (const decl of borderDecls) {
      expect(decl).not.toMatch(/-500-\d/) // not an alpha primitive
      expect(decl).not.toContain('scrim') // not a scrim role
    }
  })

  it('@scope repoints ONLY border-color from the ladder tokens (the geometry law is untouched)', () => {
    expect(stylesBlock).toMatch(/:scope:hover\s*\{\s*border-color:\s*var\(--ui-text-field-border-hover\)/)
    expect(stylesBlock).toMatch(/:scope:state\(user-invalid\)\s*\{\s*border-color:\s*var\(--ui-text-field-border-invalid\)/)
    expect(stylesBlock).toMatch(
      /:scope:state\(user-invalid\):hover\s*\{\s*border-color:\s*var\(--ui-text-field-border-invalid-hover\)/,
    )
  })
})

// ── Disabled — a role REPOINT, not opacity (ADR-0014 cl.2c / tokens.md canon) ────────────────────────────
describe('text-field.css — disabled is a role REPOINT, not opacity', () => {
  it('repoints bg/ink/border to the muted neutral roles, matching BOTH [disabled] and :state(disabled)', () => {
    const b = whereBlock(":where(ui-text-field:is([disabled], :state(disabled)))")
    expect(b.length).toBeGreaterThan(0) // the disabled repoint block exists
    expect(b).toMatch(/--ui-text-field-bg:\s*var\(--c-neutral-surface-high\)/)
    expect(b).toMatch(/--ui-text-field-ink:\s*var\(--c-neutral-on-surface-variant\)/)
    expect(b).toMatch(/--ui-text-field-border:\s*var\(--c-neutral-outline-variant\)/) // the faint disabled frame
  })

  it('NEVER opacity — the muted look is a token repoint (the disabled host is also pointer-inert)', () => {
    // target an `opacity:` DECLARATION, not prose — a comment may say "NOT opacity" to document the canon.
    expect(css).not.toMatch(/opacity\s*:/) // disabled is a role repoint, not an opacity fade (tokens.md canon)
    // the host is pointer-inert when disabled (own [disabled] OR the effective :state(disabled) — fieldset too),
    // so :hover/:focus-within never lift it off the held muted frame.
    expect(stylesBlock).toMatch(
      /:scope:is\(\[disabled\],\s*:state\(disabled\)\)\s*\{[^}]*pointer-events:\s*none/,
    )
  })
})

// ── @scope token hygiene — consume ONLY --ui-text-field-* (+ the fleet exception) ────────────────────────
describe('text-field.css — @scope token hygiene (s9)', () => {
  it('@scope CONSUMES only --ui-text-field-* for its own tokens (+ the shared focus-ring/motion fleet tokens)', () => {
    // no raw --c-* primitive ref and no role read in @scope (other than the whitelisted fleet focus ring); the
    // component otherwise reads only its own --ui-text-field-* chain.
    expect(foreignScopeRefs(stylesBlock)).toEqual([])
    // anti-vacuous: the fleet tokens ARE consumed (the focus ring + the motion timing), so the whitelist is live.
    const allRefs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)
    expect(allRefs.some((v) => sharedFleet.has(v))).toBe(true)
    expect(allRefs.some((v) => /^--ui-text-field-/.test(v))).toBe(true)
  })

  it('NEGATIVE control: a planted raw-primitive --c-* ref in @scope is CAUGHT by the hygiene predicate', () => {
    // a role read directly in the styles block (instead of through the component chain) MUST be flagged.
    const planted = '@scope (ui-text-field) { :scope:hover { border-color: var(--c-neutral-high); } }'
    expect(foreignScopeRefs(planted)).toEqual(['--c-neutral-high'])
  })
})

// ── Focus — the shared outline ring is the SOLE indicator + a TRANSPARENT border, BOTH on :focus-within (ADR-0014 dev#1) ──
describe('text-field.css — the :focus-within ring-only focus, transparent border (ADR-0014 dev#1)', () => {
  it(':focus-within draws the shared outline ring AND steps the border TRANSPARENT (no double border, all-focus parity)', () => {
    const m = stylesBlock.match(/:scope:focus-within\s*\{([^}]*)\}/)
    expect(m, ':scope:focus-within rule missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    // the border steps to the focus token (via the own ladder token) — which resolves to `transparent` (asserted
    // in the token-block ladder test), so the ring is the sole indicator and there is no second blue frame.
    expect(rule).toMatch(/border-color:\s*var\(--ui-text-field-border-focus\)/)
    // the SOLE focus indicator — the shared outline ring, read DIRECTLY from the fleet tokens
    expect(rule).toMatch(/outline:\s*var\(--ui-focus-ring-width\)\s+solid\s+var\(--c-focus-ring\)/)
    expect(rule).toMatch(/outline-offset:\s*var\(--ui-focus-ring-offset\)/)
  })

  it('focus is ALL-focus: :focus-within, NEVER :focus-visible (keyboard-only) and NEVER a bare :focus', () => {
    // a text field must visibly signal where typing lands, including on a mouse click — :focus-within, not the
    // button's keyboard-only :focus-visible (the focusable element is the editor child, the ring is on the host).
    // Rule-based (not a bare substring): a comment may legitimately mention :focus-visible for contrast — what is
    // barred is a :focus-visible / bare :focus SELECTOR. (`/:focus\s*\{/` does not match `:focus-within {`.)
    expect(stylesBlock).toMatch(/:scope:focus-within\s*\{/) // the all-focus rule exists
    expect(stylesBlock).not.toMatch(/:focus-visible\s*[{,]/) // no :focus-visible rule (keyboard-only — the button's)
    expect(stylesBlock).not.toMatch(/:focus\s*\{/) // no bare `:focus {` rule
  })
})

// ── Anatomy + placeholder + motion + forced-colors ───────────────────────────────────────────────────────
describe('text-field.css — anatomy, placeholder, motion, forced-colors', () => {
  it('host-as-grid: a presence-driven :has() grid + the density-bearing column-gap; the editor is order-placed', () => {
    expect(stylesBlock).toMatch(/display:\s*inline-grid/)
    expect(stylesBlock).toMatch(/:scope:has\(>\s*\[slot='leading'\]\)/)
    expect(stylesBlock).toMatch(/:scope:has\(>\s*\[slot='trailing'\]\)/)
    expect(stylesBlock).toMatch(/column-gap:\s*var\(--ui-text-field-gap\)/) // the gap rides --ui-density
    expect(stylesBlock).toMatch(/:scope > \[data-part='editor'\][^}]*order:\s*1/) // editor = the centre value cell
    expect(stylesBlock).toMatch(/:scope > \[data-part='editor'\][^}]*outline:\s*none/) // the ring is on the host
  })

  it('the placeholder is a control-toggled [data-empty]::before carrying attr(data-placeholder)', () => {
    const m = stylesBlock.match(/\[data-part='editor'\]\[data-empty\]::before\s*\{([^}]*)\}/)
    expect(m, 'the [data-empty]::before placeholder rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/content:\s*attr\(data-placeholder\)/)
    expect(rule).toMatch(/color:\s*var\(--ui-text-field-placeholder\)/)
  })

  it('motion transitions the state-PAINT only — enumerated, never `all`, never geometry/outline — gated past first paint', () => {
    const m = stylesBlock.match(/:scope:state\(ready\)\s*\{([^}]*)\}/)
    expect(m, ':scope:state(ready) transition rule missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/transition:/)
    expect(rule).toContain('border-color')
    expect(rule).not.toMatch(/transition:\s*all/) // enumerated longhands, never the `all` keyword
    expect(rule).not.toMatch(/height|padding|inline-size|\bwidth\b|gap|transform|outline/) // geometry/ring must SNAP
    expect(rule).toContain('--ui-motion-fast') // timing from the shared motion token, not a magic number
    // gated: the base :scope rule declares NO transition (so the first paint snaps)
    const baseStart = stylesBlock.indexOf(':scope {')
    const baseScope = stylesBlock.slice(baseStart, stylesBlock.indexOf('}', baseStart) + 1)
    expect(baseScope).not.toMatch(/transition/)
  })

  it('zeroes the transition under prefers-reduced-motion (accessibility — non-negotiable)', () => {
    expect(stylesBlock).toMatch(/prefers-reduced-motion:\s*reduce/)
    const rm = stylesBlock.slice(stylesBlock.indexOf('prefers-reduced-motion'))
    expect(rm).toMatch(/:scope:state\(ready\)\s*\{\s*transition:\s*none/)
  })

  it('a forced-colors block keeps the border + ink + placeholder visible (CanvasText)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const fc = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/border-color:\s*CanvasText/) // the field border survives
    expect(fc).toMatch(/color:\s*CanvasText/) // the ink survives
    expect(fc).toMatch(/\[data-empty\]::before\s*\{\s*color:\s*CanvasText/) // the placeholder survives
  })
})

// ── Visible inline-validation message (ADR-0029 A1 — extends ADR-0014) ──────────────────────────────────────
// The control-managed `.ui-text-field-message` node becomes VISIBLE when :state(user-invalid) is active
// and the node carries a non-empty message. Two changes: two new tokens declared in the :where() block, and
// one new display rule inside @scope gated by :state(user-invalid). The @scope hygiene predicate already
// passes because the new scope refs are `--ui-text-field-message-*` (the own chain).
describe('text-field.css — visible message node (ADR-0029 A1, extends ADR-0014)', () => {
  it('declares the --ui-text-field-message-font and --ui-text-field-message-ink tokens in the :where() block', () => {
    expect(tokenBlock).toMatch(/--ui-text-field-message-font:\s*var\(--ui-font-sm\)/)
    expect(tokenBlock).toMatch(/--ui-text-field-message-ink:\s*var\(--c-danger\)/)
  })

  it('the @scope :state(user-invalid) > .ui-text-field-message rule gives it display:block + danger-text treatment', () => {
    const m = stylesBlock.match(/:scope:state\(user-invalid\)\s*>\s*\.ui-text-field-message\s*\{([^}]*)\}/)
    expect(m, ':state(user-invalid) > .ui-text-field-message rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/display:\s*block/) // makes the node visible (overrides `hidden`)
    expect(rule).toMatch(/font-size:\s*var\(--ui-text-field-message-font\)/) // small type from the token
    expect(rule).toMatch(/color:\s*var\(--ui-text-field-message-ink\)/) // danger ink from the token
  })

  it('@scope hygiene still passes with the new message tokens (they are --ui-text-field-* own chain)', () => {
    // foreignScopeRefs already covers the whole stylesBlock including the new rule; asserting here
    // documents that the ADR-0029 rule was not a scope-hygiene regression.
    expect(foreignScopeRefs(stylesBlock)).toEqual([])
  })
})
