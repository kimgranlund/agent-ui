// agent-admin-schema-derived-catalog.test.ts — SPEC-R3 (`persona-catalog-composition.spec.md`):
// `sanitizeCatalog` recognizes every registered DERIVED catalog id, across every base a shipped
// persona fragment targets, without regressing the base picker's existing 2-entry allowlist.

import { describe, it, expect } from 'vitest'
import { derivedCatalogIdsFor, SHIPPED_PERSONA_CATALOGS } from '@agent-ui/a2ui'
import {
  sanitizeCatalog,
  sanitizeDomains,
  resolveEffectiveCatalogId,
  A2UI_CATALOG_OPTIONS,
  A2UI_DOMAINS_KEY,
  DEFAULT_A2UI_CATALOG_ID,
  DOMAIN_ALIASES,
} from './agent-admin-schema.ts'

describe('sanitizeCatalog — SPEC-R3 AC1/AC2/AC3 (derived-id recognition)', () => {
  const derivedIds = derivedCatalogIdsFor(SHIPPED_PERSONA_CATALOGS)

  it('anti-vacuous: the fixture persona package contributes at least two derived ids (both shipped bases)', () => {
    expect(derivedIds.length).toBeGreaterThanOrEqual(2)
  })

  it('AC1 — every derived id registered for either base passes through unchanged, not the default', () => {
    for (const id of derivedIds) {
      expect(sanitizeCatalog(id), id).toBe(id)
      expect(sanitizeCatalog(id), id).not.toBe(DEFAULT_A2UI_CATALOG_ID)
    }
  })

  it('AC2 — the existing 2-entry allowlist behavior for agent-ui/a2ui-basic is byte-identical (additive, not a rewrite)', () => {
    for (const option of A2UI_CATALOG_OPTIONS) expect(sanitizeCatalog(option.id)).toBe(option.id)
    expect(sanitizeCatalog('not-a-catalog')).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(sanitizeCatalog(42)).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(sanitizeCatalog(undefined)).toBe(DEFAULT_A2UI_CATALOG_ID)
  })

  it('AC3 — a single persona\'s fragment targeting BOTH bases contributes two independently-recognized derived ids', () => {
    const fixture = SHIPPED_PERSONA_CATALOGS.find((p) => (p.targetCatalogs?.length ?? 0) > 1)
    expect(fixture, 'the fixture-demo package must target more than one base to exercise this AC').toBeDefined()
    const idsForFixture = (fixture!.targetCatalogs ?? []).map((base) => `${base}--${fixture!.personaId}`)
    expect(idsForFixture.length).toBeGreaterThanOrEqual(2)
    for (const id of idsForFixture) expect(sanitizeCatalog(id)).toBe(id)
  })

  it('a derived-looking id that was never actually registered still fails closed to the default', () => {
    expect(sanitizeCatalog('agent-ui--nobody-shipped-this')).toBe(DEFAULT_A2UI_CATALOG_ID)
  })
})

// T-0202 (catalog architecture CA-R3, D6): the domains selection key, its fail-closed sanitizer and the one-wave
// alias table. No domain ships in W0, so the positive paths run on seeded domains passed in.
describe('sanitizeDomains and the domains effective id (CA-R3)', () => {
  const seeded = [
    { domainId: 'games', targetCatalogs: ['agent-ui', 'a2ui-basic'] },
    { domainId: 'hospitality' },
    { domainId: 'design' },
  ]

  it('a shipped selection reads back as the canonical sorted, deduplicated tail', () => {
    expect(sanitizeDomains('games', seeded)).toBe('games')
    expect(sanitizeDomains('hospitality+design', seeded)).toBe('design+hospitality')
    expect(sanitizeDomains('games+games', seeded)).toBe('games')
  })

  it('D6: an old persona-fragment id reads as its domain through the alias table', () => {
    expect(DOMAIN_ALIASES).toEqual({ croupier: 'games', quizmaster: 'games', concierge: 'hospitality', stylist: 'design' })
    expect(sanitizeDomains('croupier', seeded)).toBe('games')
    expect(sanitizeDomains('croupier+quizmaster', seeded)).toBe('games')
    expect(sanitizeDomains('concierge+stylist', seeded)).toBe('design+hospitality')
  })

  it('fail-closed: an unknown domain, a non-string or an empty value drops the whole selection to none', () => {
    expect(sanitizeDomains('games+ghost', seeded)).toBeUndefined()
    expect(sanitizeDomains('', seeded)).toBeUndefined()
    expect(sanitizeDomains(['games'], seeded)).toBeUndefined()
    expect(sanitizeDomains(undefined, seeded)).toBeUndefined()
  })

  it('W0 ships no domain: an alias resolves to games, which is not shipped, so the selection is none', () => {
    expect(sanitizeDomains('croupier')).toBeUndefined()
    expect(resolveEffectiveCatalogId('agent-ui', undefined, 'croupier')).toBe('agent-ui')
    expect(resolveEffectiveCatalogId('agent-ui', 'croupier', 'croupier')).toBe('agent-ui--croupier')
  })

  it('the effective id composes every selected domain onto the base, and degrades to the base when one does not target it', () => {
    expect(resolveEffectiveCatalogId('agent-ui', undefined, 'hospitality+design', seeded)).toBe('agent-ui--design+hospitality')
    expect(resolveEffectiveCatalogId('a2ui-basic', undefined, 'games', seeded)).toBe('a2ui-basic--games')
    expect(resolveEffectiveCatalogId('a2ui-basic', undefined, 'games+design', seeded)).toBe('a2ui-basic')
    expect(resolveEffectiveCatalogId('agent-ui', 'stylist', 'games', seeded), 'a domains selection wins over the local set').toBe('agent-ui--games')
    expect(resolveEffectiveCatalogId('agent-ui', 'stylist', undefined, seeded)).toBe('agent-ui--stylist')
  })

  it('sanitizeCatalog refuses a domain id while no domain ships, and any non-canonical spelling', () => {
    expect(sanitizeCatalog('agent-ui--games')).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(sanitizeCatalog('agent-ui--games+design')).toBe(DEFAULT_A2UI_CATALOG_ID)
    expect(A2UI_DOMAINS_KEY).toBe('a2uiDomains')
  })
})
