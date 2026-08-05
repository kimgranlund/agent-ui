import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// pagination-css.test.ts — pagination.css static structural + token-hygiene probe (table-css.test.ts
// precedent): pin the STRUCTURE (the two sectioned blocks, `:where()` declares `--ui-pagination-*`,
// `@scope` consumes ONLY its own chain ∪ the shared `--md-sys-*` namespace, no `[size]`/`[scale]` selector —
// ADR-0163 cl.6: no new geometry row of its own).

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/pagination/pagination.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-pagination) {'), css.indexOf('@scope (ui-pagination) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-pagination) {'))

describe('pagination.css — structure + token hygiene', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-pagination\)/)
  })

  it('the :where(ui-pagination) block declares every --ui-pagination-* token this file consumes', () => {
    const declared = new Set([...tokenBlock.matchAll(/(--ui-pagination-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set([...stylesBlock.matchAll(/var\((--ui-pagination-[\w-]+)/g)].map((m) => m[1]))
    expect(declared.size).toBeGreaterThan(0) // anti-vacuous
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('the @scope styles block consumes ONLY --ui-pagination-* ∪ the shared --md-sys-* namespace', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    for (const v of refs) {
      const allowed = v.startsWith('--ui-pagination-') || v.startsWith('--md-sys-')
      expect(allowed, `@scope consumed an out-of-family token: ${v}`).toBe(true)
    }
  })

  it('no [size] or [scale] attribute selector anywhere — cl.6: no new geometry row of its own', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/\[size\b/)
    expect(bare).not.toMatch(/\[scale\b/)
  })

  it('every --ui-pagination-* token declaration points at a role or a shared ramp token — no raw primitive', () => {
    const bad = [...tokenBlock.matchAll(/--md-sys-color-[\w-]+/g)].map((m) => m[0]).filter((t) => /-\d{3}/.test(t))
    expect(bad).toEqual([])
  })

  it('the host lays stops out as an inline-flex row with a token-driven gap', () => {
    const baseRule = (stylesBlock.match(/:scope\s*\{[^}]*\}/) ?? [''])[0]
    expect(baseRule).toMatch(/display:\s*inline-flex/)
    expect(baseRule).toMatch(/gap:\s*var\(--ui-pagination-gap\)/)
  })
})
