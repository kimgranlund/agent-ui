import { describe, it, expect } from 'vitest'
// Read grid.css / container.css as text (vite strips `.css?raw`; no `@types/node` devDep — same readFileSync
// approach as the button/text-field css probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// s6 — grid.css static structural check (ADR-0003 sectioning + token hygiene; ADR-0016 cl.3/4 the intrinsic
// auto-fit/minmax reflow; ADR-0015 the surface). The rendered-px track-count CHANGE is grid.browser.test.ts;
// here we pin the STRUCTURE: the two sectioned blocks, that `:where()` DECLARES the `--ui-grid-*` chain (the
// track floor + the --ui-space gap), that `@scope` CONSUMES only `--ui-grid-*`, the auto-fit/minmax template,
// NO `@container` rule (the reflow is intrinsic, NOT a wrap rule like ui-row), no control height, and that the
// surface + forced-colors are the SHARED controls/_surface/container.css's job (not duplicated here).

const CTRL = `${process.cwd()}/packages/agent-ui/components/src/controls`
const css = readFileSync(`${CTRL}/grid/grid.css`, 'utf8') as string
const containerCss = readFileSync(`${CTRL}/_surface/container.css`, 'utf8') as string

const tokenBlock = css.slice(css.indexOf(':where(ui-grid) {'), css.indexOf('@scope (ui-grid) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-grid) {'))
// Comment-stripped CSS for the ABSENCE assertions (the header comment legitimately NAMES @container /
// --ui-height-* / the surface seam / forced-colors when explaining what grid.css does NOT do — those mentions
// must not trip an absence check, which is about real RULES, not prose).
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('grid.css — structure + token hygiene (s6)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-grid\)/)
  })

  it('the :where() block DECLARES the track floor + the --ui-space gap, and [gap=step] repoints it', () => {
    expect(tokenBlock).toMatch(/--ui-grid-min:\s*\S+/) // a default track floor (a concrete length)
    expect(tokenBlock).toMatch(/--ui-grid-gap:\s*var\(--ui-space-none\)/) // default gap = none
    expect(tokenBlock).toMatch(/ui-grid\[gap='md'\][^}]*--ui-grid-gap:\s*var\(--ui-space-md\)/s)
    expect(tokenBlock).toMatch(/ui-grid\[gap='2xl'\][^}]*--ui-grid-gap:\s*var\(--ui-space-2xl\)/s)
  })

  it('@scope is the INTRINSIC auto-fit/minmax track grid (ADR-0016 cl.3/4) — no explicit column count', () => {
    expect(stylesBlock).toMatch(/display:\s*grid/)
    // the load-bearing template: auto-fit reflows by width, minmax floored on --ui-grid-min, each track 1fr.
    expect(stylesBlock).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(var\(--ui-grid-min\),\s*1fr\)\)/)
    expect(stylesBlock).toMatch(/gap:\s*var\(--ui-grid-gap\)/)
  })

  it('the reflow is INTRINSIC, NOT an @container wrap rule (unlike ui-row/ui-column) — anti-vacuous', () => {
    expect(code).not.toContain('@container') // auto-fit IS the responsiveness; no breakpoint/wrap rule
    expect(code).not.toMatch(/grid-template-columns:\s*repeat\(\d/) // no explicit integer column count
  })

  it('@scope CONSUMES only --ui-grid-* (token hygiene — no raw --md-sys-color-* role, no --ui-space-* leak)', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0) // anti-vacuous: the styles block really reads tokens
    for (const v of refs) expect(v, `@scope reads a non-grid token: ${v}`).toMatch(/^--ui-grid-/)
    expect(code).not.toMatch(/var\(--md-sys-color-/) // colour roles enter only via the SHARED surface sheet, never here
  })

  it('carries NO control height — a Container/layout primitive (geometry.md)', () => {
    expect(code).not.toMatch(/--ui-height-/) // spacing rides --ui-space × density, never the control-height ramp
  })
})

describe('grid.css — surface + forced-colors are the SHARED container.css (not duplicated)', () => {
  it('the shared sheet covers ui-grid for the surface seam AND forced-colors survival', () => {
    // controls/_surface/container.css owns the elevation×brightness seam + the WHCM survival for the family;
    // grid.css must NOT re-implement them (one source). Anti-vacuous: ui-grid is named in BOTH shared lists.
    expect(containerCss).toMatch(/:where\([^)]*\bui-grid\b[^)]*\)\s*{[\s\S]*--ui-container-bg/)
    const forced = containerCss.slice(containerCss.indexOf('forced-colors: active'))
    expect(forced).toMatch(/\bui-grid\b/)
  })

  it('grid.css does NOT redeclare the surface seam or a forced-colors block (layout-only)', () => {
    expect(code).not.toMatch(/--ui-container-bg|--ui-container-tint/) // the surface seam stays in the shared sheet
    expect(code).not.toMatch(/forced-colors/) // WHCM survival is the shared sheet's job; grid.css owns layout only
  })
})
