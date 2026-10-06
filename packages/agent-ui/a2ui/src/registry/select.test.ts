// select.test.ts: selectCapabilities ranks a view's types by their selection intents and never pads.

import { describe, it, expect } from 'vitest'
import { composeRegistry, registryViewFor } from './compose.ts'
import { selectCapabilities } from './select.ts'
import type { RegistrySources } from './types.ts'

const guide = (...intents: string[]) => ({ intents, notFor: [] })

const SOURCES: RegistrySources = {
  catalogs: [{ catalogId: 'agent-ui', components: { Button: {}, Text: {}, Unguided: {} }, functions: {} }],
  fragments: [{ personaId: 'croupier', fragment: { components: { PlayingCard: {} }, functions: {} }, targetCatalogs: ['agent-ui'] }],
  guidance: {
    base: { 'agent-ui': { Button: guide('press to submit the form'), Text: guide('show some plain copy') } },
    persona: { croupier: { PlayingCard: guide('show one playing card', 'deal a card face down') } },
  },
  miniSkills: [],
}

const reg = composeRegistry(SOURCES)

describe('selectCapabilities', () => {
  it('ranks the persona type first for its own intent in the derived view', () => {
    const view = registryViewFor(reg, 'agent-ui--croupier')
    const picked = selectCapabilities('show one playing card', view, 3)
    expect(picked[0]!.name).toBe('PlayingCard')
    for (const row of picked) expect(view.types).toContain(row) // never a row outside the view
  })

  it('the base view never returns a persona-only type for the same intent', () => {
    const picked = selectCapabilities('show one playing card', registryViewFor(reg, 'agent-ui'), 3)
    expect(picked.map((r) => r.name)).not.toContain('PlayingCard')
  })

  it('never pads: an intent sharing no token scores zero and returns nothing; a type with no intents never ranks', () => {
    const view = registryViewFor(reg, 'agent-ui--croupier')
    expect(selectCapabilities('zzqx wibble', view, 5)).toEqual([])
    expect(selectCapabilities('unguided', view, 5).map((r) => r.name)).not.toContain('Unguided')
  })

  it('honours the cap, and a non-positive cap returns nothing', () => {
    const view = registryViewFor(reg, 'agent-ui--croupier')
    expect(selectCapabilities('show', view, 1)).toHaveLength(1)
    expect(selectCapabilities('show', view, 0)).toEqual([])
  })

  it('is deterministic: equal scores break on the row id', () => {
    const tied: RegistrySources = { ...SOURCES, guidance: { base: { 'agent-ui': { Button: guide('alpha beta'), Text: guide('alpha beta') } }, persona: {} } }
    const view = registryViewFor(composeRegistry(tied), 'agent-ui')
    expect(selectCapabilities('alpha beta', view, 2).map((r) => r.name)).toEqual(['Button', 'Text'])
  })
})
