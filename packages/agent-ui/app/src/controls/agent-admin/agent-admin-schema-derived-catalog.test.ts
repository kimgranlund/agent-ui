// agent-admin-schema-derived-catalog.test.ts — SPEC-R3 (`persona-catalog-composition.spec.md`):
// `sanitizeCatalog` recognizes every registered DERIVED catalog id, across every base a shipped
// persona fragment targets, without regressing the base picker's existing 2-entry allowlist.

import { describe, it, expect } from 'vitest'
import { derivedCatalogIdsFor, SHIPPED_PERSONA_CATALOGS } from '@agent-ui/a2ui'
import { sanitizeCatalog, A2UI_CATALOG_OPTIONS, DEFAULT_A2UI_CATALOG_ID } from './agent-admin-schema.ts'

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
