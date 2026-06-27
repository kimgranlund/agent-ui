import { describe, it, expect } from 'vitest'
// We read the CSS as text. vite strips `.css?raw` to empty (its CSS pipeline intercepts), so the
// trip-wire's `?raw` glob can't be used for stylesheets; and there is no `@types/node` devDep, so the
// node builtin is untyped here. Suppress the untyped-import + declare the one global we touch.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// tok-focus (ADR-0009) — the shared focus-ring COLOUR role. A STATIC structural check on tokens.css: the
// DEDICATED --c-focus-ring role resolves via light-dark() like every other role (NOT --c-primary reused,
// which would tint each control's ring by its own family), and carries the forced-colors (WHCM) mapping
// → Highlight so the keyboard ring survives forced-colors for free. (The RENDERED ring is the wave-2
// cross-engine smoke; jsdom can't compute a focus outline.)

// vitest runs from the repo root; read the source CSS as text.
const css = readFileSync(`${process.cwd()}/packages/agent-ui/shared/src/tokens/tokens.css`, 'utf8') as string
const flat = css.replace(/\s+/g, ' ') // whitespace-insensitive matching
const bare = flat.replace(/\/\*.*?\*\//g, '') // comment-free, single-spaced

// The top-level :root block. Custom-property values hold no `}` (light-dark()/oklch() carry only `)`), so on
// the comment-free text `[^}]*` cleanly captures one block; `.match` (non-global) returns the FIRST :root —
// the top-level roles block — not the forced-colors `:root` nested in the @media below.
const rootBlock = (bare.match(/:root\s*\{[^}]*\}/) ?? [''])[0]

describe('tokens.css — the shared focus-ring role (ADR-0009)', () => {
  it('declares a DEDICATED --c-focus-ring role resolved via light-dark() (not --c-primary reused)', () => {
    expect(css.length).toBeGreaterThan(0) // anti-vacuous: the CSS was actually read
    expect(rootBlock.length).toBeGreaterThan(0) // anti-vacuous: the :root block was isolated
    expect(rootBlock).toMatch(/--c-focus-ring:\s*light-dark\(/)
  })

  it('maps --c-focus-ring → Highlight under forced-colors (the WHCM ring survives for free)', () => {
    // a forced-colors media query repoints --c-focus-ring to the system focus colour `Highlight`. `[^@]*`
    // keeps the match inside the media block (does not cross into another at-rule).
    expect(bare).toMatch(/@media\s*\(\s*forced-colors:\s*active\s*\)\s*\{[^@]*--c-focus-ring:\s*Highlight\s*;/)
  })
})
