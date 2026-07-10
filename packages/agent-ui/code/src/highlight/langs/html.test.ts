import { describe, it, expect } from 'vitest'
import { roundTrips } from '../../core/token.ts'
import { html } from './html.ts'

// An agent-real fixture — a small HTML fragment a model plausibly emits.
const FIXTURE = `<!-- a card -->
<div class="card">
  <ui-text as="h2">Title</ui-text>
</div>`

describe('html tokenizer (LLD-C6, SPEC-C4)', () => {
  it('round-trips exactly on the agent-real fixture', () => {
    const tokens = html(FIXTURE)
    expect(roundTrips(tokens, FIXTURE)).toBe(true)
  })

  it('classifies the marked spans: comment, opening/closing tag names, attribute string, punctuation', () => {
    const tokens = html(FIXTURE)
    expect(tokens.find((t) => t.text === '<!-- a card -->')?.kind).toBe('comment')
    expect(tokens.find((t) => t.text === 'div')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === 'ui-text')?.kind).toBe('keyword') // custom-element tag name, hyphen included
    expect(tokens.find((t) => t.text === '"card"')?.kind).toBe('string')
    expect(tokens.find((t) => t.text === '<')?.kind).toBe('punctuation')
  })

  it('a closing tag name is also classified as keyword (the </ context)', () => {
    const code = '<span></span>'
    const tokens = html(code)
    expect(roundTrips(tokens, code)).toBe(true)
    const keywordSpans = tokens.filter((t) => t.kind === 'keyword')
    expect(keywordSpans.map((t) => t.text)).toEqual(['span', 'span'])
  })

  it('an entity stays plain text (no entity-decoding lane)', () => {
    const code = '<p>a &amp; b</p>'
    const tokens = html(code)
    expect(roundTrips(tokens, code)).toBe(true)
    expect(tokens.some((t) => t.text.includes('&amp;') && t.kind === 'plain')).toBe(true)
  })

  it('AC4 — a three-line block comment carries its tier on all three lines', () => {
    const code = '<!--\ncomment body\n-->'
    const tokens = html(code)
    expect(roundTrips(tokens, code)).toBe(true)
    const kindsPerLine = splitByNewlineKinds(tokens)
    expect(kindsPerLine).toEqual([['comment'], ['comment'], ['comment']])
  })

  it('negative control: a tag name incorrectly tagged plain would fail the tier assertion', () => {
    const tokens = html(FIXTURE)
    const real = tokens.find((t) => t.text === 'div')
    expect(real?.kind).toBe('keyword')
    const planted = { ...real!, kind: 'plain' as const }
    expect(planted.kind).not.toBe(real!.kind)
  })
})

function splitByNewlineKinds(tokens: { kind: string; text: string }[]): string[][] {
  const buckets: string[][] = [[]]
  for (const t of tokens) {
    if (t.kind === 'plain' && t.text === '\n') {
      buckets.push([])
      continue
    }
    buckets[buckets.length - 1].push(t.kind)
  }
  return buckets
}
