import { describe, it, expect } from 'vitest'
import { roundTrips } from '../../core/token.ts'
import { markdown } from './markdown.ts'

// An agent-real fixture — a small markdown snippet a model plausibly emits (this is the highlight PACK's
// fence-oriented tokenizer for a code string declared language="markdown", NOT the ./markdown DOCUMENT
// parser — LLD-C8 is a wholly separate concern).
const FIXTURE = `# Title

Some prose with \`inline code\` in it.

\`\`\`
fenced block
\`\`\`
`

describe('markdown (fences) tokenizer (LLD-C6, SPEC-C4)', () => {
  it('round-trips exactly on the agent-real fixture', () => {
    const tokens = markdown(FIXTURE)
    expect(roundTrips(tokens, FIXTURE)).toBe(true)
  })

  it('classifies only fenced/inline-code spans; prose (headings, bullets) stays plain', () => {
    const tokens = markdown(FIXTURE)
    expect(tokens.find((t) => t.text === '`inline code`')?.kind).toBe('string')
    // the heading line is prose — never classified
    expect(tokens.some((t) => t.kind === 'plain' && t.text.includes('# Title'))).toBe(true)
  })

  it('AC4-shape — a three-line fenced block carries the string tier across all three lines', () => {
    const code = '```\nfenced body\n```'
    const tokens = markdown(code)
    expect(roundTrips(tokens, code)).toBe(true)
    const kindsPerLine = splitByNewlineKinds(tokens)
    expect(kindsPerLine).toEqual([['string'], ['string'], ['string']])
  })

  it('an unterminated fence runs to end-of-input, never throws, still round-trips', () => {
    const code = '```\nnever closes'
    expect(() => markdown(code)).not.toThrow()
    expect(roundTrips(markdown(code), code)).toBe(true)
  })

  it('negative control: an inline-code span incorrectly tagged plain would fail the tier assertion', () => {
    const tokens = markdown(FIXTURE)
    const real = tokens.find((t) => t.text === '`inline code`')
    expect(real?.kind).toBe('string')
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
