// wellknown.test.ts — S7 checkpoint: the three arena card fixtures validate through serveAgentCard +
// discoverAgent (socket-free, injectable `get`); a broken card fails A2A_CARD at its path and is refused
// both for serving (fail-fast) and for discovery (SPEC-R5 AC1). Imports `tools/` relatively (LLD §9).
import { describe, expect, it } from 'vitest'
import { discoverAgent, serveAgentCard, wellKnownAgentCardPath } from '../../tools/wellknown.ts'
import type { A2aAgentCard } from '../protocol/types.ts'

import cardReferee from '../protocol/fixtures/card.referee.json?raw'
import cardSeatX from '../protocol/fixtures/card.seat-x.json?raw'
import cardSeatO from '../protocol/fixtures/card.seat-o.json?raw'

const CARDS: Record<string, string> = { referee: cardReferee, 'seat-x': cardSeatX, 'seat-o': cardSeatO }

describe('well-known card serving + discovery (LLD-C9, SPEC-R5 AC1)', () => {
  it('the path is the v0.3.0-renamed one (agent-card.json, NOT agent.json)', () => {
    expect(wellKnownAgentCardPath).toBe('/.well-known/agent-card.json')
  })

  for (const [name, raw] of Object.entries(CARDS)) {
    it(`${name}: serves + discovers clean, socket-free`, async () => {
      const card = JSON.parse(raw) as A2aAgentCard
      const served = serveAgentCard(card) // does not throw — the card is valid
      const discovered = await discoverAgent('https://example.com', {
        get: (url) => {
          expect(url).toBe(`https://example.com${wellKnownAgentCardPath}`)
          return Promise.resolve({ status: 200, text: () => Promise.resolve(served.body) })
        },
      })
      expect(discovered).toEqual({ ok: true, card })
    })
  }

  it('a card missing a required field fails A2A_CARD at its path, and is refused for serving (fail-fast)', () => {
    const bad = JSON.parse(cardReferee) as Record<string, unknown>
    delete bad.name
    expect(() => serveAgentCard(bad as unknown as A2aAgentCard)).toThrow(/refusing to serve an invalid card/)
  })

  it('discovery of an invalid card body returns {failures}, never a usable card', async () => {
    const bad = JSON.parse(cardReferee) as Record<string, unknown>
    delete bad.name
    const discovered = await discoverAgent('https://example.com', {
      get: () => Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify(bad)) }),
    })
    expect(discovered.ok).toBe(false)
    expect(!discovered.ok && discovered.failures.some((f) => f.code === 'A2A_CARD' && f.path.endsWith('/name'))).toBe(true)
  })

  it('discovery of a 404 / non-200 response returns {failures}, never a throw', async () => {
    await expect(
      discoverAgent('https://example.com', { get: () => Promise.resolve({ status: 404, text: () => Promise.resolve('') }) }),
    ).resolves.toMatchObject({ ok: false })
  })

  it('discovery surviving a fetch rejection returns {failures}, never a throw', async () => {
    await expect(
      discoverAgent('https://example.com', { get: () => Promise.reject(new Error('network down')) }),
    ).resolves.toMatchObject({ ok: false })
  })
})
