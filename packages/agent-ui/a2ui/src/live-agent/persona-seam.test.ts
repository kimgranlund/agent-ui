// persona-seam.test.ts — ADR-0138's pure-seam gates: the persona parameter on `buildSystemPrompt` +
// `ProduceOptions.personaSystem`. The load-bearing claims: (1) ABSENT/EMPTY persona is byte-identical to
// the pre-seam composition (the ADR-0090 `mode`-absent precedent — prompt-equivalence.test.ts's baseline
// stays green because of exactly this); (2) a present persona lands as the FINAL section, after the
// mini-skills block, carrying the fixed precedence sentence; (3) the persona text rides verbatim.
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

const base = (): string => buildSystemPrompt(defaultCatalog, [])

describe('buildSystemPrompt — the ADR-0138 persona seam', () => {
  it('absent persona: byte-identical to the four-arg composition (zero regression)', () => {
    expect(buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined)).toBe(base())
  })

  it('EMPTY/whitespace persona: also byte-identical — never an empty trailing section', () => {
    expect(buildSystemPrompt(defaultCatalog, [], undefined, undefined, '')).toBe(base())
    expect(buildSystemPrompt(defaultCatalog, [], undefined, undefined, '   \n  ')).toBe(base())
  })

  it('a present persona is the FINAL section: ## Persona + the fixed precedence sentence + the text verbatim', () => {
    const persona = 'You are The Croupier, a blackjack dealer.\n\nAlways play on ONE surface.'
    const composed = buildSystemPrompt(defaultCatalog, [], undefined, undefined, persona)
    expect(composed.startsWith(base())).toBe(true) // strictly additive — everything before it untouched
    const tail = composed.slice(base().length)
    expect(tail).toContain('## Persona')
    expect(tail).toContain('remain authoritative') // the precedence sentence
    expect(tail.endsWith(persona)).toBe(true) // verbatim, trailing
    expect(tail.indexOf('## Persona')).toBeLessThan(tail.indexOf(persona.slice(0, 20)))
  })
})
