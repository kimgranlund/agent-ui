// T-0222: the offline replay runs produce() with the semantic checks the dev proxy runs. Its Node-safe list
// (`PERSONA_SEMANTIC_CHECKS`, `DOMAIN_SEMANTIC_CHECKS`) must name every shipped persona's and domain's checks and
// nothing else.
import { describe, expect, it } from 'vitest'
import { SHIPPED_DOMAIN_CATALOG_MANIFESTS } from '../../../packages/agent-ui/a2ui/src/catalog/domains/manifests.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../../../packages/agent-ui/a2ui/src/catalog/personas/manifests.ts'
import { semanticChecksDeps } from '../../../packages/agent-ui/a2ui/tools/agent/chat-validation.ts'
import { nodeCatalogResolver } from '../../../packages/agent-ui/a2ui/tools/testkit/load.node.ts'
import { DOMAIN_SEMANTIC_CHECKS, PERSONA_SEMANTIC_CHECKS, replaySemanticChecks, routingSeen } from './trace.ts'

describe('offline replay semantic checks', () => {
  it('name exactly the shipped personas that declare checks', () => {
    const shipped = Object.fromEntries(SHIPPED_PERSONA_CATALOG_MANIFESTS.filter((m) => (m.semanticChecks ?? []).length > 0).map((m) => [m.personaId, m.semanticChecks]))
    expect(PERSONA_SEMANTIC_CHECKS).toEqual(shipped)
    for (const [id, checks] of Object.entries(shipped)) expect(PERSONA_SEMANTIC_CHECKS[id]).toBe(checks)
  })

  it('name exactly the shipped domains that declare checks (T-0197)', () => {
    const shipped = Object.fromEntries(SHIPPED_DOMAIN_CATALOG_MANIFESTS.filter((m) => (m.semanticChecks ?? []).length > 0).map((m) => [m.domainId, m.semanticChecks]))
    expect(DOMAIN_SEMANTIC_CHECKS).toEqual(shipped)
    for (const [id, checks] of Object.entries(shipped)) expect(DOMAIN_SEMANTIC_CHECKS[id]).toBe(checks)
  })

  it('resolve the same checks the dev proxy passes for a persona catalog and a base catalog', () => {
    const resolve = nodeCatalogResolver(process.cwd())
    for (const id of ['agent-ui--croupier', 'agent-ui--hospitality', 'agent-ui']) {
      const catalog = resolve(id)
      expect(replaySemanticChecks(catalog).map((c) => c.id)).toEqual((semanticChecksDeps(catalog).semanticChecks ?? []).map((c) => c.id))
    }
    expect(replaySemanticChecks(resolve('agent-ui--croupier')).length).toBeGreaterThan(0)
    expect(replaySemanticChecks(resolve('agent-ui--hospitality')).map((c) => c.id)).toContain('concierge-booking-field-paths')
    expect(replaySemanticChecks(resolve('agent-ui')).length).toBeGreaterThan(0) // T-0208: the composite-moment checks
  })
})

// T-0260: `routing-expect` reads the turn's trace line through this flattening.
describe('routingSeen', () => {
  const routing = {
    catalog: { id: 'agent-ui--croupier', base: 'agent-ui', persona: 'croupier', domains: [] },
    references: [{ kind: 'resource', name: 'blackjack', load: 'index-only', via: 'index' }],
    sections: [{ id: 'grammar', chars: 10, cache: 'stable' }, { id: 'persona', chars: 5, cache: 'volatile' }],
  }

  it('reads persona and domains, framed exemplars, section ids and references', () => {
    const line = { routing, trace: { exemplarIds: ['retrieved'] }, events: { framedExemplarIds: ['framed'] } }
    expect(routingSeen(line)).toEqual({ domains: ['croupier'], exemplars: ['framed'], sections: ['grammar', 'persona'], references: [{ name: 'blackjack', load: 'index-only' }] })
  })

  it('falls back to the retrieved ids before T-0259 events, and to nothing without a routing block', () => {
    const multi = { ...routing, catalog: { id: 'agent-ui--games+hospitality', base: 'agent-ui', domains: ['games', 'hospitality'] } }
    expect(routingSeen({ routing: multi, trace: { exemplarIds: ['retrieved'] } })).toMatchObject({ domains: ['games', 'hospitality'], exemplars: ['retrieved'] })
    expect(routingSeen({ trace: { exemplarIds: ['retrieved'] } })).toBeUndefined()
  })
})
