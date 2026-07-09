import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// table-css.test.ts — table.css static structural + token-hygiene probe (LLD-C3, report-family.lld.md §2).
// Mirrors the bar-chart-css.test.ts precedent: pin the STRUCTURE (the two sectioned blocks, `:where()`
// declares `--ui-table-*`, `@scope` consumes ONLY its own chain ∪ the shared `--md-sys-*`/`--ui-space-*`
// namespaces, no `[size]`/`[scale]` selector — SPEC-R17 AC2). The rendered-px PROOF (scroll preservation,
// overflow, RTL, WHCM) is table.browser.test.ts.

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/table/table.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-table) {'), css.indexOf('@scope (ui-table) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-table) {'))

describe('table.css — structure + token hygiene', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-table\)/)
  })

  it('the :where(ui-table) block declares every --ui-table-* token this file consumes', () => {
    const declared = new Set([...tokenBlock.matchAll(/(--ui-table-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set([...stylesBlock.matchAll(/var\((--ui-table-[\w-]+)/g)].map((m) => m[1]))
    expect(declared.size).toBeGreaterThan(0) // anti-vacuous
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('every --ui-table-* token declaration points at a role or a shared ramp token — no raw primitive', () => {
    const bad = [...tokenBlock.matchAll(/--md-sys-color-[\w-]+/g)].map((m) => m[0]).filter((t) => /-\d{3}/.test(t))
    expect(bad).toEqual([])
  })

  it('the @scope styles block consumes ONLY --ui-table-* ∪ the shared --md-sys-*/--ui-space-* namespaces — no cross-control reach', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0) // anti-vacuous
    for (const v of refs) {
      const allowed = v.startsWith('--ui-table-') || v.startsWith('--md-sys-') || v.startsWith('--ui-space-')
      expect(allowed, `@scope consumed an out-of-family token: ${v}`).toBe(true)
    }
  })

  it('SPEC-R17 AC2: no [size] or [scale] attribute selector anywhere — Display class takes neither', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/\[size\b/)
    expect(bare).not.toMatch(/\[scale\b/)
  })

  it('no --ui-height-* DECLARATION/consumption anywhere (Display class has no control-height lever)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/--ui-height-/)
  })

  it('the scroll container owns overflow (SPEC-R5) — overflow-x: auto on [data-part=\'scroll\']', () => {
    const scrollRule = (stylesBlock.match(/:scope \[data-part='scroll'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(scrollRule).toMatch(/overflow-x:\s*auto/)
  })

  it('the stamped table owns the UA-default reset — border-collapse + inline-size 100% + font: inherit', () => {
    const tableRule = (stylesBlock.match(/:scope table\s*\{[^}]*\}/) ?? [''])[0]
    expect(tableRule).toMatch(/border-collapse:\s*collapse/)
    expect(tableRule).toMatch(/inline-size:\s*100%/)
    expect(tableRule).toMatch(/font:\s*inherit/)
  })

  it('number-column cells end-align, use tabular numerals, and never wrap (SPEC-R3 row 9/14, SPEC-R16)', () => {
    const numRule = (stylesBlock.match(/:scope \[data-type='number'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(numRule).toMatch(/text-align:\s*end/)
    expect(numRule).toMatch(/font-variant-numeric:\s*tabular-nums/)
    expect(numRule).toMatch(/white-space:\s*nowrap/)
  })

  it('non-number cells wrap huge unbroken strings (overflow-wrap: anywhere, SPEC-R3 row 14)', () => {
    const cellRule = (stylesBlock.match(/:scope th,\s*\n?\s*:scope td\s*\{[^}]*\}/) ?? [''])[0]
    expect(cellRule).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('only logical CSS properties are used — no physical left/right/top/bottom anywhere (RTL is free, SPEC-R16)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/[:\s](left|right)\s*:/)
    expect(bare).toMatch(/border-block-end/)
  })

  it('no dedicated forced-colors block (SPEC-R15) — every separator is a real border, no fill to lose', () => {
    expect(css).not.toMatch(/@media \(forced-colors: active\)/)
  })

  it('no control-frame law (padding-block on the host) — this is Display, not Control', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).not.toMatch(/padding-block:/)
  })
})
