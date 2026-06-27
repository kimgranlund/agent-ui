import { describe, it, expect } from 'vitest'
// Read button.css as text (vite strips `.css?raw`; no `@types/node` devDep — same approach as the s6 ramp probe).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s7 — button.css static structural check (ADR-0003 sectioning + token hygiene; ADR-0006 anatomy;
// references/geometry.md). The rendered-px CHANGE is s13's browser smoke; here we pin the STRUCTURE: the
// two sectioned blocks, that `:where()` DECLARES the `--ui-button-*` chain, that `@scope` CONSUMES only it,
// the geometry law, the `:has()` host-as-grid, the [variant]/[size] repoints, and a forced-colors block.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/button/button.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-button) {'), css.indexOf('@scope (ui-button) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-button) {'))

describe('button.css — structure + token hygiene (s7)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK') // sectioned banners distinguish declaration vs consumption
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-button\)/)
  })

  it('the :where() block DECLARES the full --ui-button-* chain from colour roles + the dimensional ramp', () => {
    for (const slot of ['bg', 'ink', 'border', 'height', 'font', 'gap', 'icon']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-button-${slot}:`))
    }
    expect(tokenBlock).toContain('var(--c-primary') // colour roles (default family = primary)
    expect(tokenBlock).toContain('var(--ui-height-md)') // the s6 dimensional ramp
  })

  it('[variant] repoints the colour channel; [size] repoints the geometry', () => {
    expect(tokenBlock).toMatch(/ui-button\[variant='soft'\]/)
    expect(tokenBlock).toMatch(/ui-button\[variant='ghost'\]/)
    expect(tokenBlock).toMatch(/ui-button\[size='sm'\]/)
    expect(tokenBlock).toMatch(/ui-button\[size='lg'\]/)
  })

  it('@scope CONSUMES only --ui-button-* for its own tokens (+ the shared focus-ring/motion fleet tokens)', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    // The component reads only its own --ui-button-* chain, with deliberate exceptions: the shared FLEET
    // constants read DIRECTLY (never repointed through the component chain) so every control draws the
    // identical ring / uses the identical motion timing — fleet tokens, not per-control opinions: the focus
    // ring (ADR-0009) and the state-transition motion (interaction-states standard).
    const sharedFleet = new Set([
      '--c-focus-ring', '--ui-focus-ring-width', '--ui-focus-ring-offset', // the shared focus ring (ADR-0009)
      '--ui-motion-fast', '--ui-ease-standard', // the shared state-transition motion (interaction-states standard)
    ])
    for (const v of refs) {
      if (sharedFleet.has(v as string)) continue
      expect(v).toMatch(/^--ui-button-/) // the component otherwise reads only its own chain
    }
    expect(refs.some((v) => sharedFleet.has(v as string))).toBe(true) // anti-vacuous: the fleet tokens ARE consumed
  })

  it('geometry per the LAW: block-size off the ramp, padding-block 0, slotless inline-pad = h/2', () => {
    expect(stylesBlock).toMatch(/block-size:\s*var\(--ui-button-height\)/)
    expect(stylesBlock).toMatch(/padding-block:\s*0/)
    expect(stylesBlock).toMatch(/padding-inline:\s*calc\(var\(--ui-button-height\)\s*\/\s*2\)/)
  })

  it('host-as-grid (ADR-0006): a presence-driven :has() leading slot + the density-bearing column-gap', () => {
    expect(stylesBlock).toMatch(/:scope:has\(>\s*\[slot='leading'\]\)/) // optional leading adornment slot
    expect(stylesBlock).toMatch(/grid-template-columns:\s*auto 1fr/) // leading + label
    expect(stylesBlock).toMatch(/column-gap:\s*var\(--ui-button-gap\)/) // the gap rides --ui-density
    expect(stylesBlock).toMatch(/calc\(\(var\(--ui-button-height\)\s*-\s*var\(--ui-button-icon\)\)\s*\/\s*2\)/) // slot ½(h−icon)
  })

  it('a forced-colors block keeps the ink/border from vanishing', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
  })
})

// ── Interaction states + the shared focus ring (ADR-0008 / ADR-0009) ─────────────────────────────────
// The per-state BACKGROUND comes from a ROLE-LADDER step declared per-variant in the token block (NEVER a
// color-mix — colour opinions live in the token layer); the @scope styles consume the per-state tokens on the
// platform pseudo-classes. The focus ring is the SHARED fleet ring (a layout-neutral, keyboard-only outline).
// jsdom can't compute the rendered colours — these pin the CSS-text/structure; the px change + forced-colors
// survival is the wave-2 cross-engine smoke.

/** The declaration block for a `:where(...)` variant selector in the token block — marker to its closing brace. */
const variantBlock = (marker: string): string => {
  const start = tokenBlock.indexOf(marker)
  return start < 0 ? '' : tokenBlock.slice(start, tokenBlock.indexOf('}', start))
}

describe('button.css — interaction states from role ladders (ADR-0008)', () => {
  it('solid (default) steps the ACCENT ladder: idle --c-primary · hover -dim · active -high', () => {
    const b = variantBlock(':where(ui-button) {')
    expect(b).toMatch(/--ui-button-bg:\s*var\(--c-primary\)/)
    expect(b).toMatch(/--ui-button-bg-hover:\s*var\(--c-primary-dim\)/)
    expect(b).toMatch(/--ui-button-bg-active:\s*var\(--c-primary-high\)/)
  })

  it('soft steps the CONTAINER ladder: idle -container-low · hover -container · active -container-high', () => {
    const b = variantBlock(":where(ui-button[variant='soft'])")
    expect(b).toMatch(/--ui-button-bg:\s*var\(--c-primary-container-low\)/)
    expect(b).toMatch(/--ui-button-bg-hover:\s*var\(--c-primary-container\)/)
    expect(b).toMatch(/--ui-button-bg-active:\s*var\(--c-primary-container-high\)/)
  })

  it('ghost is a WASH: transparent idle · hover -container-low · active -container', () => {
    const b = variantBlock(":where(ui-button[variant='ghost'])")
    expect(b).toMatch(/--ui-button-bg:\s*transparent/)
    expect(b).toMatch(/--ui-button-bg-hover:\s*var\(--c-primary-container-low\)/)
    expect(b).toMatch(/--ui-button-bg-active:\s*var\(--c-primary-container\)/)
  })

  it('@scope consumes the per-state tokens on :hover/:active (background only); NO color-mix anywhere', () => {
    expect(stylesBlock).toMatch(/:scope:hover\s*\{\s*background:\s*var\(--ui-button-bg-hover\)/)
    expect(stylesBlock).toMatch(/:scope:active\s*\{\s*background:\s*var\(--ui-button-bg-active\)/)
    expect(css).not.toContain('color-mix(') // states are role steps, never a synthesized mix() (ADR-0008)
  })

  it('disabled HOLDS at idle: -bg-hover/-bg-active repoint to the muted neutral, and the host is pointer-inert', () => {
    const b = variantBlock(":where(ui-button[disabled])")
    expect(b).toMatch(/--ui-button-bg-hover:\s*var\(--c-neutral-surface-high\)/)
    expect(b).toMatch(/--ui-button-bg-active:\s*var\(--c-neutral-surface-high\)/)
    expect(stylesBlock).toMatch(/:scope:is\(\[disabled\]\)\s*\{[^}]*pointer-events:\s*none/) // :hover/:active can't match
  })
})

describe('button.css — the shared focus ring (ADR-0009)', () => {
  it(':focus-visible draws the fleet ring: a layout-neutral outline from the shared --c-focus-ring/--ui-focus-ring-*', () => {
    const m = stylesBlock.match(/:scope:focus-visible\s*\{([^}]*)\}/)
    expect(m, ':scope:focus-visible rule missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/outline:\s*var\(--ui-focus-ring-width\)\s+solid\s+var\(--c-focus-ring\)/)
    expect(rule).toMatch(/outline-offset:\s*var\(--ui-focus-ring-offset\)/)
  })

  it('the ring is KEYBOARD-only: :focus-visible, never a bare :focus (no ring on a mouse click)', () => {
    expect(stylesBlock).not.toMatch(/:focus\s*\{/) // a bare `:focus {` rule — would ring on mouse focus too
  })
})

// ── Role-driven glyph sizing — caret = font (ADR-0012 / geometry-sizing-spec §4.1, §4.6) ──────────────
// PLACEMENT stays position-driven (the :has() grid, edge-pad ½(h−icon)); GLYPH SIZE becomes role-driven.
// The CELL stays icon-sized for both roles; the caret glyph is the FONT, centered within the icon cell so it
// lands at the emergent ½(h−font) edge — NOT --ui-ind (an inline affordance at icon size is the oversize bug).
describe('button.css — role-driven glyph sizing, caret = font (ADR-0012)', () => {
  it('--ui-button-glyph is declared = the font (the inline-affordance ramp; --ui-glyph-ratio 1)', () => {
    expect(tokenBlock).toMatch(/--ui-button-glyph:\s*var\(--ui-button-font\)/)
  })

  it('the CELL stays icon-sized for BOTH slots (border-box, so a role inset stays within the icon cell)', () => {
    const start = stylesBlock.indexOf(":scope > [slot='leading']")
    const block = stylesBlock.slice(start, stylesBlock.indexOf('}', start) + 1)
    expect(block).toMatch(/\[slot='leading'\]/)
    expect(block).toMatch(/\[slot='trailing'\]/)
    expect(block).toMatch(/inline-size:\s*var\(--ui-button-icon\)/)
    expect(block).toMatch(/block-size:\s*var\(--ui-button-icon\)/)
    expect(block).toMatch(/box-sizing:\s*border-box/)
  })

  it('[data-role=caret] sizes the GLYPH to font (--ui-button-glyph), inset/centered in the icon cell — not --ui-ind', () => {
    const m = stylesBlock.match(/:scope > \[data-role='caret'\]\s*\{([^}]*)\}/)
    expect(m, "[data-role='caret'] rule missing").not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    // inset = ½(icon − glyph) → the font glyph centers in the icon-sized cell, landing at the emergent ½(h−font).
    // The glyph reduces from icon to --ui-button-glyph (= font) — NOT left at --ui-ind (the oversize-caret bug).
    expect(rule).toMatch(/padding:\s*calc\(\(var\(--ui-button-icon\)\s*-\s*var\(--ui-button-glyph\)\)\s*\/\s*2\)/)
    expect(rule).toContain('--ui-button-glyph') // sized to the font ramp, not the icon ramp
  })

  it('[data-role=icon] FILLS the icon cell (the content-icon FRAME role)', () => {
    expect(stylesBlock).toMatch(/:scope > \[data-role='icon'\]\s*\{[^}]*padding:\s*0/)
  })
})

// ── Motion: state transitions, gated past first paint (interaction-states standard) ──────────────────
// Transition the state-PAINT props ONLY (never geometry, never `all`), gated behind a :state(ready) custom
// state flipped one frame past first paint (so the upgrade/first paint snaps), zeroed under reduced-motion.
// The rendered behaviour (first paint does NOT animate; a later hover DOES) is the cross-engine smoke;
// jsdom has no CustomStateSet, so here we pin the CSS-text structure.
describe('button.css — state-transition motion, gated past first paint', () => {
  it('transitions the state-PAINT properties only — enumerated, never `all`, never geometry', () => {
    const m = stylesBlock.match(/:scope:state\(ready\)\s*\{([^}]*)\}/)
    expect(m, ':scope:state(ready) transition rule missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/transition:/)
    expect(rule).toContain('background-color')
    expect(rule).not.toMatch(/transition:\s*all/) // enumerated longhands, never the `all` keyword
    // geometry must SNAP, and the focus ring stays instant — none of these may appear in the transition list
    expect(rule).not.toMatch(/height|padding|inline-size|\bwidth\b|gap|transform|outline/)
    expect(rule).toContain('--ui-motion-fast') // timing from the shared motion token, not a magic number
  })

  it('is GATED behind :state(ready) — the base :scope rule declares NO transition (so the first paint snaps)', () => {
    const baseStart = stylesBlock.indexOf(':scope {')
    const baseScope = stylesBlock.slice(baseStart, stylesBlock.indexOf('}', baseStart) + 1)
    expect(baseScope).not.toMatch(/transition/) // unconditional transition would animate the upgrade/first paint
    expect(stylesBlock).toContain(':scope:state(ready)') // the gate exists
  })

  it('zeroes the transition under prefers-reduced-motion (accessibility — non-negotiable)', () => {
    expect(stylesBlock).toMatch(/prefers-reduced-motion:\s*reduce/)
    const rm = stylesBlock.slice(stylesBlock.indexOf('prefers-reduced-motion'))
    expect(rm).toMatch(/:scope:state\(ready\)\s*\{\s*transition:\s*none/)
  })
})
