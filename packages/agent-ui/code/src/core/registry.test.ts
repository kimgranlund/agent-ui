import { describe, it, expect, vi, afterEach } from 'vitest'
import { Registry, highlighterRegistry, registerHighlighter, tokenize } from './registry.ts'
import type { Highlighter, Token } from './token.ts'

describe('Registry (LLD-C4, SPEC-C2)', () => {
  it('AC1 — an empty registry tokenizes verbatim (a single plain token)', () => {
    const r = new Registry()
    expect(r.tokenize('const x = 1', 'ts')).toEqual([{ kind: 'plain', text: 'const x = 1' }])
  })

  it('AC2 — two independent Registry instances are isolated', () => {
    const a = new Registry()
    const b = new Registry()
    a.registerHighlighter((code) => [{ kind: 'plain', text: code }])
    expect(a.activeHighlighter()).not.toBeNull()
    expect(b.activeHighlighter()).toBeNull()
    expect(b.tokenize('x', 'ts')).toEqual([{ kind: 'plain', text: 'x' }])
  })

  it('AC2 — a second registerHighlighter on the SAME registry replaces the first (last-wins)', () => {
    const r = new Registry()
    const first: Highlighter = (code) => [{ kind: 'keyword', text: code }]
    const second: Highlighter = (code) => [{ kind: 'string', text: code }]
    r.registerHighlighter(first)
    r.registerHighlighter(second)
    expect(r.activeHighlighter()).toBe(second)
    expect(r.tokenize('x', 'ts')).toEqual([{ kind: 'string', text: 'x' }])
  })

  describe('AC4 — the round-trip invariant is enforced at the tokenize boundary', () => {
    afterEach(() => vi.restoreAllMocks())

    it('a text-dropping highlighter is downgraded to a single plain token, code intact', () => {
      const r = new Registry()
      const dropping: Highlighter = (code) => [{ kind: 'comment', text: code.slice(0, -1) }] // drops the last char
      r.registerHighlighter(dropping)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(r.tokenize('const x = 1', 'ts')).toEqual([{ kind: 'plain', text: 'const x = 1' }])
      expect(warn).toHaveBeenCalledTimes(1) // exactly one console.warn
      expect(warn.mock.calls[0][0]).toContain('did not round-trip')
    })

    it('a THROWING highlighter is downgraded to a single plain token, code intact (review-driven — LLD §14, the "user never sees corrupted code" promise extends to a failed render, not just bad output)', () => {
      const r = new Registry()
      const throwing: Highlighter = () => {
        throw new Error('boom')
      }
      r.registerHighlighter(throwing)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(r.tokenize('const x = 1', 'ts')).toEqual([{ kind: 'plain', text: 'const x = 1' }])
      expect(warn).toHaveBeenCalledTimes(1) // exactly one console.warn — the SAME branch as bad output
      expect(warn.mock.calls[0][0]).toContain('did not round-trip')
    })

    it('a throwing highlighter on EMPTY code still downgrades and warns (the [] round-trips against \'\' trivially — a throw must not slip through that coincidence)', () => {
      const r = new Registry()
      const throwing: Highlighter = () => {
        throw new Error('boom')
      }
      r.registerHighlighter(throwing)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(r.tokenize('', 'ts')).toEqual([{ kind: 'plain', text: '' }])
      expect(warn).toHaveBeenCalledTimes(1)
    })

    it('names the offending highlighter by its function name', () => {
      const r = new Registry()
      function myBadEngine(code: string): Token[] {
        return [{ kind: 'plain', text: code + '!' }] // adds text — an overlap
      }
      r.registerHighlighter(myBadEngine)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      r.tokenize('x', 'ts')
      expect(warn.mock.calls[0][0]).toContain('myBadEngine')
    })

    it('a well-behaved highlighter fires NO warn (negative control — the downgrade bites only on a real breach)', () => {
      const r = new Registry()
      r.registerHighlighter((code) => [{ kind: 'plain', text: code }])
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      r.tokenize('const x = 1', 'ts')
      expect(warn).not.toHaveBeenCalled()
    })
  })
})

describe('the default singleton + sugar functions', () => {
  it('registerHighlighter/tokenize operate on highlighterRegistry', () => {
    const original = highlighterRegistry.activeHighlighter()
    try {
      registerHighlighter((code) => [{ kind: 'string', text: code }])
      expect(tokenize('x', 'ts')).toEqual([{ kind: 'string', text: 'x' }])
    } finally {
      // restore — other suites in this run may share the module singleton
      if (original) highlighterRegistry.registerHighlighter(original)
    }
  })
})
