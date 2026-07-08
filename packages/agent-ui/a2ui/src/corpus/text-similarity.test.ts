// text-similarity.test.ts — the shared TF-IDF/cosine primitive extracted for ADR-0091 §2. `retrieve.ts`'s
// own suite (retrieve.test.ts) already proves the math is behavior-unchanged post-extraction; this file
// covers `topKByCosine` directly, plus the `floor` parameter `retrieve()` never exercises (it always
// calls with the default `-Infinity`) but `selectMiniSkills` does (ADR-0091 §2 — never pad a per-turn
// selection with a genuinely unrelated, zero-score item).

import { describe, it, expect } from 'vitest'
import { tokenize, termCounts, topKByCosine } from './text-similarity.ts'

describe('tokenize/termCounts', () => {
  it('lowercases and splits on non-alphanumeric runs', () => {
    expect(tokenize('A Login-Form, please!')).toEqual(['a', 'login', 'form', 'please'])
  })

  it('counts repeated terms', () => {
    expect(termCounts(['a', 'b', 'a'])).toEqual(new Map([['a', 2], ['b', 1]]))
  })
})

interface Doc {
  id: string
  text: string
}

const tieBreak = (a: Doc, b: Doc): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

describe('topKByCosine — degrade-to-empty (mirrors retrieve.ts:99)', () => {
  it('an empty items input returns []', () => {
    expect(topKByCosine<Doc>([], (d) => d.text, 'anything', 5, tieBreak)).toEqual([])
  })

  it('k <= 0 returns [] without throwing', () => {
    const docs: Doc[] = [{ id: 'a', text: 'a login form' }]
    expect(() => topKByCosine(docs, (d) => d.text, 'a login form', 0, tieBreak)).not.toThrow()
    expect(topKByCosine(docs, (d) => d.text, 'a login form', 0, tieBreak)).toEqual([])
    expect(topKByCosine(docs, (d) => d.text, 'a login form', -3, tieBreak)).toEqual([])
  })

  it('a query with zero vocabulary overlap returns [] (no genuine match, not an arbitrary top-k)', () => {
    const docs: Doc[] = [{ id: 'a', text: 'alpha beta gamma' }]
    expect(topKByCosine(docs, (d) => d.text, 'zzz qqq xyz', 5, tieBreak)).toEqual([])
  })

  it('ranks the best textual match first and breaks exact ties via tieBreak', () => {
    const docs: Doc[] = [
      { id: 'b', text: 'a login form with a submit button' },
      { id: 'a', text: 'a login form with a submit button' },
      { id: 'unrelated', text: 'a completely unrelated calendar widget' },
    ]
    const result = topKByCosine(docs, (d) => d.text, 'a login form with a submit button', 2, tieBreak)
    expect(result.map((d) => d.id)).toEqual(['a', 'b']) // tie broken ascending by id
  })
})

describe('topKByCosine — the `floor` parameter (ADR-0091 §2, selectMiniSkills\'s stricter degrade)', () => {
  it('default (-Infinity): pads the top-k with a zero-score item when fewer than k truly match (retrieve.ts\'s existing behavior)', () => {
    const docs: Doc[] = [
      { id: 'match', text: 'login form username password' },
      { id: 'zero', text: 'a completely unrelated calendar widget' },
    ]
    const result = topKByCosine(docs, (d) => d.text, 'login form username password', 2, tieBreak)
    expect(result.map((d) => d.id)).toEqual(['match', 'zero']) // zero-score padding included — no floor
  })

  it('floor = 0: excludes a zero-score item even when it would otherwise pad out to k', () => {
    const docs: Doc[] = [
      { id: 'match', text: 'login form username password' },
      { id: 'zero', text: 'a completely unrelated calendar widget' },
    ]
    const result = topKByCosine(docs, (d) => d.text, 'login form username password', 2, tieBreak, 0)
    expect(result.map((d) => d.id)).toEqual(['match']) // the zero-score item is dropped, not padded in
  })
})
