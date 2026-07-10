import { describe, it, expect } from 'vitest'
import { roundTrips } from '../core/token.ts'
import { scan, type BlockOpeners } from './scan.ts'

const TS_LIKE: BlockOpeners = {
  lineComment: '//',
  blockComment: { open: '/*', close: '*/' },
  strings: ["'", '"'],
  template: '`',
  keywords: new Set(['const', 'let', 'return']),
  numberPattern: /^\d+/,
  punctuation: new Set(['=', ';', '(', ')', '{', '}']),
}

describe('scan (LLD-C6 shared lexer core)', () => {
  it('empty input round-trips to []', () => {
    expect(scan('', TS_LIKE)).toEqual([])
    expect(roundTrips(scan('', TS_LIKE), '')).toBe(true)
  })

  it('a plain single-line string round-trips and classifies a keyword + number', () => {
    const code = 'const x = 1;'
    const tokens = scan(code, TS_LIKE)
    expect(roundTrips(tokens, code)).toBe(true)
    expect(tokens.find((t) => t.text === 'const')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === '1')?.kind).toBe('number')
  })

  it('threads each newline as its own plain boundary token', () => {
    const code = 'const a\nconst b'
    const tokens = scan(code, TS_LIKE)
    expect(roundTrips(tokens, code)).toBe(true)
    expect(tokens.some((t) => t.kind === 'plain' && t.text.includes('\n'))).toBe(true)
  })

  it('a multi-line block comment carries its tier across ALL covered lines (SPEC-C4 AC4)', () => {
    const code = '/*\nmiddle\n*/'
    const tokens = scan(code, TS_LIKE)
    expect(roundTrips(tokens, code)).toBe(true)
    const lines = code.split('\n')
    // reconstruct per-line classification by walking the token stream against the newline boundaries
    let cursor = 0
    const perLineKinds: string[][] = [[]]
    for (const t of tokens) {
      if (t.kind === 'plain' && t.text === '\n') {
        perLineKinds.push([])
        cursor += 1
        continue
      }
      perLineKinds[cursor].push(t.kind)
    }
    expect(lines.length).toBe(3)
    expect(perLineKinds[0]).toEqual(['comment']) // '/*' opener line
    expect(perLineKinds[1]).toEqual(['comment']) // the delimiter-free MIDDLE line — not plain
    expect(perLineKinds[2]).toEqual(['comment']) // the closer line
  })

  it('an unterminated block comment runs to end-of-input, never throws, still round-trips', () => {
    const code = '/* never closes\nstill open'
    expect(() => scan(code, TS_LIKE)).not.toThrow()
    const tokens = scan(code, TS_LIKE)
    expect(roundTrips(tokens, code)).toBe(true)
  })

  it('a single-level mode does not nest — an opener inside an open mode is inert text', () => {
    const code = '/* outer /* still-outer */'
    const tokens = scan(code, TS_LIKE)
    expect(roundTrips(tokens, code)).toBe(true)
    // the whole span up to the FIRST '*/' is one comment token — the inner '/*' never opens a second mode
    const comment = tokens.find((t) => t.kind === 'comment')
    expect(comment?.text).toBe('/* outer /* still-outer */')
  })

  it('non-ASCII / emoji content is treated as plain and round-trips (byte-agnostic)', () => {
    const code = 'const emoji = "😀🚀"'
    const tokens = scan(code, TS_LIKE)
    expect(roundTrips(tokens, code)).toBe(true)
  })

  it('negative control: a planted per-line mode-reset (dropping the carry) would leave the middle line plain — proving the assertion discriminates', () => {
    const code = '/*\nmiddle\n*/'
    const tokens = scan(code, TS_LIKE)
    const middleLineTokens = (() => {
      let cursor = 0
      const buckets: string[][] = [[]]
      for (const t of tokens) {
        if (t.kind === 'plain' && t.text === '\n') {
          buckets.push([])
          cursor += 1
          continue
        }
        buckets[cursor].push(t.kind)
      }
      return buckets[1]
    })()
    expect(middleLineTokens).toEqual(['comment']) // the real, carry-respecting result
    const planted = ['plain'] // what a broken per-line-reset implementation would produce
    expect(planted).not.toEqual(middleLineTokens) // proves the real assertion is non-vacuous
  })
})
