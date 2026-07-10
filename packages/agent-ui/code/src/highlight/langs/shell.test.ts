import { describe, it, expect } from 'vitest'
import { roundTrips } from '../../core/token.ts'
import { shell } from './shell.ts'

// An agent-real fixture — a small shell pipeline a model plausibly emits.
const FIXTURE = `# run the checks
if [ -f package.json ]; then
  npm run check | grep -i error
fi
`

describe('shell tokenizer (LLD-C6, SPEC-C4)', () => {
  it('round-trips exactly on the agent-real fixture', () => {
    const tokens = shell(FIXTURE)
    expect(roundTrips(tokens, FIXTURE)).toBe(true)
  })

  it('classifies the marked spans: line comment, keyword, punctuation', () => {
    const tokens = shell(FIXTURE)
    expect(tokens.find((t) => t.text === '# run the checks')?.kind).toBe('comment')
    expect(tokens.find((t) => t.text === 'if')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === 'then')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === 'fi')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === '|')?.kind).toBe('punctuation')
  })

  it('$VAR stays plain — no variable-interpolation lane', () => {
    const code = 'echo $HOME'
    const tokens = shell(code)
    expect(roundTrips(tokens, code)).toBe(true)
    expect(tokens.find((t) => t.text === '$')?.kind).toBe('punctuation')
    expect(tokens.find((t) => t.text === 'HOME')?.kind).toBe('plain')
  })

  it('a quoted string round-trips and classifies as string', () => {
    const code = 'echo "hello world"'
    const tokens = shell(code)
    expect(roundTrips(tokens, code)).toBe(true)
    expect(tokens.find((t) => t.text === '"hello world"')?.kind).toBe('string')
  })

  it('negative control: a keyword incorrectly tagged plain would fail the tier assertion', () => {
    const tokens = shell(FIXTURE)
    const real = tokens.find((t) => t.text === 'if')
    expect(real?.kind).toBe('keyword')
    const planted = { ...real!, kind: 'plain' as const }
    expect(planted.kind).not.toBe(real!.kind)
  })
})
