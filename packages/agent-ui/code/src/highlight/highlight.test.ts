import { describe, it, expect, beforeEach } from 'vitest'
import { highlighterRegistry, Registry } from '../core/registry.ts'
import { bundledHighlighter, registerHighlight } from './index.ts'

describe('./highlight self-registration (LLD-C7, SPEC-C4 AC1)', () => {
  it('importing the module self-registers the bundled highlighter into the default singleton', () => {
    // side-effect already ran at module import time (top-level `registerHighlight()` in index.ts)
    expect(highlighterRegistry.activeHighlighter()).toBe(bundledHighlighter)
  })

  it('AC1 — dispatches ts and round-trips with comment/keyword/number tiers', () => {
    const code = '// hi\nconst x = 1'
    const tokens = highlighterRegistry.tokenize(code, 'ts')
    expect(tokens.map((t) => t.text).join('')).toBe(code)
    expect(tokens.find((t) => t.text === '// hi')?.kind).toBe('comment')
    expect(tokens.find((t) => t.text === 'const')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === '1')?.kind).toBe('number')
  })

  it('registerHighlight(registry) targets an explicit, isolated registry (not the default singleton)', () => {
    const isolated = new Registry()
    registerHighlight(isolated)
    expect(isolated.activeHighlighter()).toBe(bundledHighlighter)
  })
})

describe('bundledHighlighter dispatch (SPEC-C4)', () => {
  it('dispatches every v1 language key to its tokenizer', () => {
    for (const lang of ['ts', 'js', 'json', 'html', 'css', 'python', 'shell', 'markdown', 'md']) {
      const tokens = bundledHighlighter('x', lang)
      expect(Array.isArray(tokens)).toBe(true)
    }
  })

  it('is case-insensitive on the language key', () => {
    const tokens = bundledHighlighter('const x = 1', 'TS')
    expect(tokens.some((t) => t.kind === 'keyword')).toBe(true)
  })

  it('AC3 — an unknown language returns a single verbatim plain token, never throws', () => {
    expect(() => bundledHighlighter('some code', 'brainfuck')).not.toThrow()
    expect(bundledHighlighter('some code', 'brainfuck')).toEqual([{ kind: 'plain', text: 'some code' }])
  })
})

describe('end-to-end through the registry boundary (the round-trip invariant enforced live)', () => {
  beforeEach(() => {
    registerHighlight() // re-assert the bundled highlighter as active (other suites may have swapped it)
  })

  it('tokenize() through the singleton composes the pack with the core boundary check', () => {
    const code = '{"a": 1}'
    const tokens = highlighterRegistry.tokenize(code, 'json')
    expect(tokens.map((t) => t.text).join('')).toBe(code)
    expect(tokens.some((t) => t.kind === 'punctuation')).toBe(true)
  })
})
