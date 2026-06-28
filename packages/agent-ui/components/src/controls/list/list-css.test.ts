import { describe, it, expect } from 'vitest'
// Read list.css as TEXT (no @types/node devDep — same approach as the button/text-field css probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G9 s5 — list.css static structural check (ADR-0003 sectioning + token hygiene; ADR-0016 the flex mapping;
// geometry.md "Container/layout" class — no control height). jsdom can't compute the rendered flex/px —
// these pin the STRUCTURE + the CSS text; the rendered gap-by-[density] + role-by-internals is list.browser
// .test.ts's cross-engine smoke. The surface seam + container-type + forced-colors live in the SHARED
// controls/_surface/container.css (covered by s2), not here — list.css owns layout only.

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/list/list.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-list) {'), css.indexOf('@scope (ui-list) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-list) {'))

/** A `:where(...)` declaration block by marker — from the marker to its closing brace (flat block). */
const whereBlock = (marker: string): string => {
  const start = tokenBlock.indexOf(marker)
  return start < 0 ? '' : tokenBlock.slice(start, tokenBlock.indexOf('}', start))
}

// A layout primitive has NO interaction state of its own (no focus ring / motion / colour), so — unlike
// button/text-field — there is NO shared-fleet exception: @scope must consume ONLY the own --ui-list-* chain.
// The shared --ui-space-* ladder is read on the DECLARATION side (the :where token block), never in @scope.
const foreignScopeRefs = (scope: string): string[] =>
  [...scope.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string).filter((v) => !/^--ui-list-/.test(v))

describe('list.css — structure + sectioning (s5)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK') // sectioned banners distinguish declaration vs consumption
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-list\)/)
  })

  it('the :where() block DECLARES the full --ui-list-* flex chain (align/justify/gap/wrap)', () => {
    const b = whereBlock(':where(ui-list) {')
    for (const slot of ['align', 'justify', 'gap', 'wrap']) {
      expect(b).toMatch(new RegExp(`--ui-list-${slot}:`))
    }
  })
})

// ── The flexProps literal-union → CSS-keyword mapping (ADR-0016 cl.1) ─────────────────────────────────────
describe('list.css — the flex mapping (ADR-0016)', () => {
  it('align → align-items keywords (center/end/stretch/baseline; start is the default)', () => {
    expect(tokenBlock).toMatch(/:where\(ui-list\[align='center'\]\)\s*\{\s*--ui-list-align:\s*center/)
    expect(tokenBlock).toMatch(/:where\(ui-list\[align='end'\]\)\s*\{\s*--ui-list-align:\s*flex-end/)
    expect(tokenBlock).toMatch(/:where\(ui-list\[align='stretch'\]\)\s*\{\s*--ui-list-align:\s*stretch/)
    expect(tokenBlock).toMatch(/:where\(ui-list\[align='baseline'\]\)\s*\{\s*--ui-list-align:\s*baseline/)
  })

  it('justify → justify-content keywords (between/around/evenly → space-*)', () => {
    expect(tokenBlock).toMatch(/:where\(ui-list\[justify='between'\]\)\s*\{\s*--ui-list-justify:\s*space-between/)
    expect(tokenBlock).toMatch(/:where\(ui-list\[justify='around'\]\)\s*\{\s*--ui-list-justify:\s*space-around/)
    expect(tokenBlock).toMatch(/:where\(ui-list\[justify='evenly'\]\)\s*\{\s*--ui-list-justify:\s*space-evenly/)
  })

  it('gap → the SHARED density-responsive --ui-space ladder, read ONLY in the token block', () => {
    // every non-none step repoints --ui-list-gap to a --ui-space-{step} (anti-vacuous: the steps were found)
    const steps = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
    for (const step of steps) {
      expect(tokenBlock).toMatch(new RegExp(`:where\\(ui-list\\[gap='${step}'\\]\\)\\s*\\{\\s*--ui-list-gap:\\s*var\\(--ui-space-${step}\\)`))
    }
    // the --ui-space ladder is read on the DECLARATION side only — NEVER in @scope (the hygiene law below)
    expect(stylesBlock).not.toContain('--ui-space-')
  })

  it('wrap → flex-wrap (boolean presence)', () => {
    expect(tokenBlock).toMatch(/:where\(ui-list\[wrap\]\)\s*\{\s*--ui-list-wrap:\s*wrap/)
  })
})

// ── @scope: the vertical stack + token hygiene + NO control height ────────────────────────────────────────
describe('list.css — @scope layout + hygiene (s5)', () => {
  it('@scope is a flex COLUMN consuming the own chain (the ui-column specialization)', () => {
    expect(stylesBlock).toMatch(/display:\s*flex/)
    expect(stylesBlock).toMatch(/flex-direction:\s*column/) // the vertical stack — the list's identity
    expect(stylesBlock).toMatch(/align-items:\s*var\(--ui-list-align\)/)
    expect(stylesBlock).toMatch(/justify-content:\s*var\(--ui-list-justify\)/)
    expect(stylesBlock).toMatch(/gap:\s*var\(--ui-list-gap\)/) // the density-bearing quantity
    expect(stylesBlock).toMatch(/flex-wrap:\s*var\(--ui-list-wrap\)/)
  })

  it('NO control height — a Container/layout primitive never reads --ui-height-* (geometry.md)', () => {
    // target a CONSUMPTION (`var(--ui-height-…)`), not prose — a comment may name the ramp it deliberately
    // avoids (the text-field opacity-probe precedent: bar the declaration, allow the documentary mention).
    expect(css).not.toMatch(/var\(--ui-height-/) // spacing rides --ui-space × [density], never the control ramp
    expect(css).not.toMatch(/block-size:/) // no vertical frame lever
  })

  it('@scope CONSUMES only --ui-list-* (no raw --c-*, no --ui-space-*, no fleet leak)', () => {
    expect(foreignScopeRefs(stylesBlock)).toEqual([])
    // anti-vacuous: the own chain IS consumed
    const allRefs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)
    expect(allRefs.some((v) => /^--ui-list-/.test(v))).toBe(true)
  })

  it('NEGATIVE control: a planted raw --ui-space-* / --c-* ref in @scope is CAUGHT by the hygiene predicate', () => {
    const planted = "@scope (ui-list) { :scope { gap: var(--ui-space-md); background: var(--c-neutral-surface); } }"
    expect(foreignScopeRefs(planted)).toEqual(['--ui-space-md', '--c-neutral-surface'])
  })
})
