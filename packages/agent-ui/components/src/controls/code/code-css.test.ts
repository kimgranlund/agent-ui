import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// code-css.test.ts — code.css static structural + token-hygiene probe (LLD-C6, content-family.lld.md §3;
// SPEC-R2/R19/R20). Mirrors the bar-chart-css.test.ts / text-css.test.ts precedent: pin the STRUCTURE (the
// two sectioned blocks, `:where()` declares `--ui-code-*`, `@scope` consumes ONLY its own chain ∪ the
// shared `--md-sys-*` namespace, no `[size]`/`[scale]` selector, a forced-colors block exists). The
// rendered-px PROOF (overflow/scroll/whole-shape) is code.browser.test.ts.

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/code/code.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-code) {'), css.indexOf('@scope (ui-code) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-code) {'))

describe('code.css — structure + token hygiene', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-code\)/)
  })

  it('the :where(ui-code) block declares every --ui-code-* token this file consumes', () => {
    const declared = new Set([...tokenBlock.matchAll(/(--ui-code-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set([...stylesBlock.matchAll(/var\((--ui-code-[\w-]+)/g)].map((m) => m[1]))
    expect(declared.size).toBeGreaterThan(0) // anti-vacuous
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('declares exactly the seven LLD-C6 tokens — font/size/line-height/ink/surface/radius/pad-inline/pad-block', () => {
    const names = new Set([...tokenBlock.matchAll(/(--ui-code-[\w-]+)\s*:/g)].map((m) => m[1]))
    expect(names).toEqual(
      new Set([
        '--ui-code-font',
        '--ui-code-size',
        '--ui-code-line-height',
        '--ui-code-ink',
        '--ui-code-surface',
        '--ui-code-radius',
        '--ui-code-pad-inline',
        '--ui-code-pad-block',
      ]),
    )
  })

  it('--ui-code-surface repoints the cross-family --ui-container-bg seam, with the same seeded-default fallback ui-card uses — never a bare seam reference (component-review finding: a bare var(--ui-container-bg) with no ancestor seeding it computes transparent) and never an unrelated raw --md-sys-color-* role', () => {
    const rule = (tokenBlock.match(/--ui-code-surface:\s*([^;]+);/) ?? [])[1]
    expect(rule).toBe('var(--ui-container-bg, var(--md-sys-color-neutral-surface))')
  })

  it('--ui-code-radius rides the fleet --ui-radius-base referent', () => {
    const rule = (tokenBlock.match(/--ui-code-radius:\s*([^;]+);/) ?? [])[1]
    expect(rule).toBe('var(--ui-radius-base)')
  })

  it('the @scope styles block consumes ONLY --ui-code-* ∪ the shared --md-sys-* namespace — no cross-control reach', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0) // anti-vacuous
    for (const v of refs) {
      const allowed = v.startsWith('--ui-code-') || v.startsWith('--md-sys-')
      expect(allowed, `@scope consumed an out-of-family token: ${v}`).toBe(true)
    }
  })

  it('SPEC-R20: no [size] or [scale] attribute selector anywhere — Display class takes neither, no size attribute lever', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/\[size\b/)
    expect(bare).not.toMatch(/\[scale\b/)
  })

  it('no --ui-height-* or [density] lever anywhere — Display class has no control-height/rhythm lever (ADR-0113 cl.2: every quantity is density-invariant)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '') // comment-stripped — a prose mention must not trip this
    expect(bare).not.toMatch(/--ui-height-/)
    expect(bare).not.toMatch(/\[density\b/)
  })

  it('white-space: pre + overflow-x: auto + max-inline-size: 100% on :scope — the ADR-0102 Lane A overflow law (SPEC-R2)', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).toMatch(/white-space:\s*pre\s*;/)
    expect(baseRule).toMatch(/overflow-x:\s*auto\s*;/)
    expect(baseRule).toMatch(/max-inline-size:\s*100%\s*;/)
  })

  it('font-family reads --ui-code-font (the --ui-mono repoint)', () => {
    expect(tokenBlock).toMatch(/--ui-code-font:\s*var\(--ui-mono\)\s*;/)
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).toMatch(/font-family:\s*var\(--ui-code-font\)\s*;/)
  })

  it('no control-frame law (per-glyph padding-block centering) — density-invariant fixed padding instead (Display, not Control)', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).toMatch(/padding:\s*var\(--ui-code-pad-block\)\s+var\(--ui-code-pad-inline\)\s*;/)
  })

  it('a forced-colors block paints CanvasText on Canvas with a CanvasText border (SPEC-R19)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const whcm = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(whcm).toMatch(/color:\s*CanvasText\s*;/)
    expect(whcm).toMatch(/background:\s*Canvas\s*;/)
    expect(whcm).toMatch(/border:\s*1px solid CanvasText\s*;/)
  })

  it('no highlighting/tokenizer/clipboard CSS hooks anywhere (SPEC-R6 fence)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/clipboard|tokeniz|highlight/i)
  })
})
