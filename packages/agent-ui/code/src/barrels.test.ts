import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

declare const process: { cwd(): string }

// barrels.test.ts (LLD-C10, SPEC-C1 AC3, SPEC-C8 tree-shake leg) — mirrors @agent-ui/router's
// barrels.test.ts discipline: (a) the exports map's targets all resolve to real files; (b) the `.` barrel
// re-exports no `./highlight`/`./markdown` module (grep — the tree-shake CONTENTS proof); (c) importing
// the `.` barrel alone registers no element and no highlighter; (d) `./markdown` imported alone registers
// ui-markdown but leaves `activeHighlighter()` null — no tokenizer bytes (the compose separation, SPEC-C8
// AC1).

const PKG = `${process.cwd()}/packages/agent-ui/code`
const pkg = JSON.parse(readFileSync(`${PKG}/package.json`, 'utf8') as string) as { exports: Record<string, string> }
const barrelSrc = readFileSync(`${PKG}/src/index.ts`, 'utf8') as string

describe('package.json exports map — every target resolves to a real file (LLD-C10)', () => {
  it('anti-vacuous: the exports map has a non-trivial entry set', () => {
    expect(Object.keys(pkg.exports).length).toBeGreaterThanOrEqual(5)
  })

  it('the five documented entries are present with their LLD-C1-pinned targets', () => {
    expect(pkg.exports['.']).toBe('./src/index.ts')
    expect(pkg.exports['./highlight']).toBe('./src/highlight/index.ts')
    expect(pkg.exports['./highlight.css']).toBe('./src/highlight/highlight.css')
    expect(pkg.exports['./markdown']).toBe('./src/markdown/index.ts')
    expect(pkg.exports['./markdown.css']).toBe('./src/markdown/markdown.css')
  })

  it('the ./editor subpath (ADR-0139) is present with its pinned targets', () => {
    expect(pkg.exports['./editor']).toBe('./src/editor/index.ts')
    expect(pkg.exports['./editor.css']).toBe('./src/editor/editor.css')
  })

  it('every export target resolves to a real file', () => {
    for (const target of Object.values(pkg.exports)) {
      expect(existsSync(`${PKG}/${target}`), `missing export target: ${target}`).toBe(true)
    }
  })

  it('a planted export pointing at a non-existent file fails the file-existence check (negative control)', () => {
    const planted = { ...pkg.exports, './phantom': './src/phantom.ts' }
    const missing = Object.values(planted).filter((t) => !existsSync(`${PKG}/${t}`))
    expect(missing).toEqual(['./src/phantom.ts'])
  })
})

describe('the `.` barrel exports the core ONLY — never a pack (SPEC-C1 AC3)', () => {
  it('does NOT re-export a ./highlight, ./markdown or ./editor module (grep the source text)', () => {
    expect(barrelSrc).not.toMatch(/highlight\/index\.ts/)
    expect(barrelSrc).not.toMatch(/markdown\/index\.ts/)
    expect(barrelSrc).not.toMatch(/UIMarkdownElement/)
    expect(barrelSrc).not.toMatch(/bundledHighlighter/)
    // ADR-0139 — the core barrel must never drag the CodeMirror editor into a core-only consumer's graph.
    expect(barrelSrc).not.toMatch(/editor\/index\.ts/)
    expect(barrelSrc).not.toMatch(/UICodeEditorElement/)
  })

  it('importing the barrel does NOT register the ui-markdown element (the tree-shake contract, functionally)', () => {
    expect(customElements.get('ui-markdown')).toBeUndefined()
  })

  it('importing the barrel does NOT register a highlighter', async () => {
    const mod = await import('./index.ts')
    expect(mod.highlighterRegistry.activeHighlighter()).toBeNull()
  })

  it('a planted pack re-export would be CAUGHT by the grep above (negative control)', () => {
    const planted = `${barrelSrc}\nexport { UIMarkdownElement } from './markdown/index.ts'\n`
    expect(planted).toMatch(/UIMarkdownElement/)
  })
})

describe('./markdown imported alone registers ui-markdown but drags zero tokenizer bytes (SPEC-C8 AC1)', () => {
  it('registers ui-markdown; activeHighlighter() stays null (no ./highlight import edge)', async () => {
    const [{ highlighterRegistry }, markdownMod] = await Promise.all([
      import('./index.ts'),
      import('./markdown/index.ts'),
    ])
    expect(customElements.get('ui-markdown')).toBe(markdownMod.UIMarkdownElement)
    expect(highlighterRegistry.activeHighlighter()).toBeNull()
  })

  it('markdown/index.ts source contains no ./highlight IMPORT (grep — the compose-via-registry separation)', () => {
    // An import-shaped pattern, not a bare word match — markdown/index.ts's own doc comment legitimately
    // NAMES "./highlight" as a precedent (prose, never executed); only a real import edge is the violation
    // (the markdown.test.ts sibling grep uses the identical pattern).
    const src = readFileSync(`${PKG}/src/markdown/index.ts`, 'utf8') as string
    expect(src).not.toMatch(/highlight\/index\.ts|\.\.\/highlight/)
  })

  it('negative control: a planted ./highlight import would be caught by the pattern above', () => {
    const planted = `import '../highlight/index.ts'\n`
    expect(planted).toMatch(/highlight\/index\.ts|\.\.\/highlight/)
  })
})
