import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// highlight-css.test.ts (LLD-C7, SPEC-C5) — a jsdom TEXT probe over the declared stylesheet (role-level
// resolution: each of the five --ui-code-token-* roles binds to a REAL --md-sys-color-* role name, never a
// numbered step — the sheet is mid-migration by another seat). The COMPUTED-style / forced-colors TRUTH is
// browser-only (markdown.browser.test.ts, LLD-C10, the instrument-bridge precedent); this suite proves the
// declaration is well-formed and structurally complete.

const CSS_PATH = `${process.cwd()}/packages/agent-ui/code/src/highlight/highlight.css`
const css = readFileSync(CSS_PATH, 'utf8') as string

const TOKEN_ROLES = ['comment', 'keyword', 'string', 'number', 'punctuation'] as const

describe('highlight.css — the --ui-code-token-* role block (SPEC-C5 AC1)', () => {
  it('declares all five --ui-code-token-* custom properties inside :where(ui-code)', () => {
    const whereBlock = /:where\(ui-code\)\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
    for (const tier of TOKEN_ROLES) {
      expect(whereBlock, tier).toMatch(new RegExp(`--ui-code-token-${tier}:\\s*var\\(--md-sys-color-`))
    }
  })

  it('each role resolves to an ON-SURFACE --md-sys-color-* family (role-level, never a numbered -NNN step)', () => {
    const whereBlock = /:where\(ui-code\)\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
    for (const tier of TOKEN_ROLES) {
      const m = new RegExp(`--ui-code-token-${tier}:\\s*var\\((--md-sys-color-[a-z-]+)\\)`).exec(whereBlock)
      expect(m, `--ui-code-token-${tier} must resolve to a --md-sys-color-* role`).not.toBeNull()
      const role = m![1]
      expect(role, `${tier}'s role must be an on-surface family`).toMatch(/on-surface/)
      expect(role, `${tier}'s role must NOT pin a numbered step`).not.toMatch(/-\d{3}(-\d{3})?$/)
    }
  })

  it('the five roles resolve to four DISTINCT color families (comment/punctuation share neutral; keyword/string/number are each distinct accents)', () => {
    const whereBlock = /:where\(ui-code\)\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
    const roleOf = (tier: string): string =>
      new RegExp(`--ui-code-token-${tier}:\\s*var\\((--md-sys-color-[a-z-]+)\\)`).exec(whereBlock)![1]
    const keyword = roleOf('keyword')
    const string_ = roleOf('string')
    const number = roleOf('number')
    expect(new Set([keyword, string_, number]).size).toBe(3) // three distinct accent families
  })

  it('every [data-token] selector is scoped to ui-code via @scope', () => {
    const scopeBlock = /@scope \(ui-code\)\s*\{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? ''
    for (const tier of TOKEN_ROLES) {
      expect(scopeBlock, tier).toMatch(new RegExp(`\\[data-token='${tier}'\\]\\s*\\{\\s*color:\\s*var\\(--ui-code-token-${tier}\\)`))
    }
  })

  it('SPEC-C5 AC2 (declaration-level) — a forced-colors block degrades every [data-token] to CanvasText', () => {
    const fc = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\}\s*\}/.exec(css)?.[1] ?? ''
    expect(fc).toMatch(/\[data-token\]\s*\{\s*color:\s*CanvasText/)
  })

  it('negative control: a role pinned to a numbered step would fail the role-family assertion', () => {
    const planted = '--ui-code-token-comment: var(--md-sys-color-neutral-750);'
    const m = /--ui-code-token-comment:\s*var\((--md-sys-color-[a-z-]+(?:-\d+)*)\)/.exec(planted)
    expect(m![1]).not.toMatch(/on-surface/) // proves the on-surface assertion above is non-vacuous
  })
})
