// site/lib/a2ui-catalog-selector.test.ts: the A2UI Catalog page's catalog selector model (T-0064). The options are
// the capability registry's ids, each one a catalog the renderer records, and every type a non-default option
// previews has an example seed or a documented exemption: the page-side mirror of the every-catalog coverage
// gate (`packages/agent-ui/a2ui/src/examples/every-catalog-coverage.test.ts`).
import { describe, it, expect } from 'vitest'
import { createRenderer, A2UI_BASIC_CANONICAL_URI, domainCatalogIdsFor, isDerivedCatalogId } from '@agent-ui/a2ui'
import { SHIPPED_DOMAIN_CATALOGS } from '@agent-ui/a2ui/catalogs'
import { REGISTRY, catalogIds } from './capability-registry.ts'
import { CATALOG_OPTIONS, catalogFromSearch, domainFor, exampleSeedFor, exemptionFor, typesFor } from './a2ui-catalog-selector.ts'

describe('a2ui-catalog-selector', () => {
  it('the selector options are the capability registry catalog ids, agent-ui first, then the shipped domain ids', () => {
    const domainIds = [...domainCatalogIdsFor(SHIPPED_DOMAIN_CATALOGS)].sort()
    expect(CATALOG_OPTIONS).toEqual([...catalogIds(REGISTRY), ...domainIds])
    expect(CATALOG_OPTIONS[0]).toBe('agent-ui')
    expect(CATALOG_OPTIONS).toContain('a2ui-basic')
    expect(CATALOG_OPTIONS, 'anti-vacuous: the hospitality domain is offered (T-0432)').toContain('agent-ui--hospitality')
  })

  it('a domain option previews its fragment types; a persona option is no domain (T-0432)', () => {
    const hospitality = SHIPPED_DOMAIN_CATALOGS.find((d) => d.domainId === 'hospitality')!
    expect(typesFor('agent-ui--hospitality')).toEqual(Object.keys(hospitality.fragment.components).sort((a, b) => a.localeCompare(b)))
    expect(domainFor('agent-ui--croupier')).toBeUndefined()
    expect(domainFor('agent-ui')).toBeUndefined()
  })

  it('every option is a catalog id the renderer records, and the canonical-URI alias is never one', async () => {
    // The renderer's public recorded-id check: `preload` resolves for a registered or recorded id and rejects
    // with a CatalogLoadError for any other (ADR-0241).
    const host = createRenderer()
    for (const id of CATALOG_OPTIONS) {
      await expect(host.preload(id), `${id} is not a catalog the renderer records`).resolves.toBeUndefined()
    }
    await expect(host.preload('no-such-catalog'), 'anti-vacuous: an unrecorded id must reject').rejects.toThrow()
    expect(CATALOG_OPTIONS).not.toContain(A2UI_BASIC_CANONICAL_URI)
    host.dispose()
  })

  it('every type of every non-default option has an example seed or a documented exemption', () => {
    const others = CATALOG_OPTIONS.filter((id) => id !== 'agent-ui')
    expect(others.some(isDerivedCatalogId), 'anti-vacuous: at least one derived option').toBe(true)
    const missing: string[] = []
    for (const id of others) {
      const types = typesFor(id)
      expect(types.length, `${id} previews no types`).toBeGreaterThan(0)
      for (const type of types) {
        if (exampleSeedFor(id, type) === undefined && exemptionFor(id, type) === undefined) missing.push(`${id}:${type}`)
      }
    }
    expect(missing, 'types with neither an example seed nor an exemption').toEqual([])
    expect(exemptionFor('a2ui-basic', 'Card'), 'anti-vacuous: a2ui-basic Card resolves to an exemption').toBeTypeOf('string')
  })

  it('an unknown or missing catalog query value falls back to agent-ui', () => {
    expect(catalogFromSearch('')).toBe('agent-ui')
    expect(catalogFromSearch('?catalog=no-such-catalog')).toBe('agent-ui')
    expect(catalogFromSearch('?other=1')).toBe('agent-ui')
    expect(catalogFromSearch('?catalog=a2ui-basic')).toBe('a2ui-basic')
  })
})
