// T-0222: the offline replay runs produce() with the semantic checks the dev proxy runs. Its Node-safe list
// (`PERSONA_SEMANTIC_CHECKS`) must name every shipped persona's checks and nothing else, and no domain may
// declare checks the replay would skip.
import { describe, expect, it } from 'vitest'
import { SHIPPED_DOMAIN_CATALOG_MANIFESTS } from '../../../packages/agent-ui/a2ui/src/catalog/domains/manifests.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../../../packages/agent-ui/a2ui/src/catalog/personas/manifests.ts'
import { semanticChecksDeps } from '../../../packages/agent-ui/a2ui/tools/agent/chat-validation.ts'
import { nodeCatalogResolver } from '../../../packages/agent-ui/a2ui/tools/testkit/load.node.ts'
import { PERSONA_SEMANTIC_CHECKS, replaySemanticChecks } from './trace.ts'

describe('offline replay semantic checks', () => {
  it('name exactly the shipped personas that declare checks', () => {
    const shipped = Object.fromEntries(SHIPPED_PERSONA_CATALOG_MANIFESTS.filter((m) => (m.semanticChecks ?? []).length > 0).map((m) => [m.personaId, m.semanticChecks]))
    expect(PERSONA_SEMANTIC_CHECKS).toEqual(shipped)
    for (const [id, checks] of Object.entries(shipped)) expect(PERSONA_SEMANTIC_CHECKS[id]).toBe(checks)
  })

  it('no shipped domain declares checks the replay would skip', () => {
    expect(SHIPPED_DOMAIN_CATALOG_MANIFESTS.filter((m) => (m.semanticChecks ?? []).length > 0).map((m) => m.domainId)).toEqual([])
  })

  it('resolve the same checks the dev proxy passes for a persona catalog and a base catalog', () => {
    const resolve = nodeCatalogResolver(process.cwd())
    for (const id of ['agent-ui--croupier', 'agent-ui--concierge', 'agent-ui']) {
      const catalog = resolve(id)
      expect(replaySemanticChecks(catalog).map((c) => c.id)).toEqual((semanticChecksDeps(catalog).semanticChecks ?? []).map((c) => c.id))
    }
    expect(replaySemanticChecks(resolve('agent-ui--croupier')).length).toBeGreaterThan(0)
    expect(replaySemanticChecks(resolve('agent-ui')).length).toBeGreaterThan(0) // T-0208: the composite-moment checks
  })
})
