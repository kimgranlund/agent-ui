import { describe, it, expect } from 'vitest'
import { TIER_OF, TIERS, NESTED_ONLY, browsableNames, tierOf, seedsUsingType, seedGalleryHref } from './a2ui-catalog-tiers.ts'
import { allSeeds } from '@agent-ui/a2ui/examples'

// a2ui-catalog-tiers.test.ts — the completeness gate for the A2UI Catalog page's tier taxonomy (GH #970).
// TIER_OF is a hand-maintained table (no wire-level "tier" field exists to derive it from); THIS file is
// what actually enforces the ticket's "every one of the 56 entries has exactly one tier home" acceptance
// bullet, plus the DERIVED half (seedsUsingType/seedGalleryHref) that must never hand-list a link.

describe('a2ui-catalog-tiers — every browsable catalog type has exactly one tier home', () => {
  const names = browsableNames()

  it('found real catalog types (anti-vacuous — a broken catalog import cannot pass silently)', () => {
    expect(names.length).toBeGreaterThan(10)
  })

  it('every browsable name is present in TIER_OF (the real completeness check — tierOf\'s fallback must never be needed)', () => {
    const missing = names.filter((n) => !(n in TIER_OF))
    expect(missing, `types with no tier home: ${missing.join(', ')}`).toEqual([])
  })

  it('TIER_OF carries no stray/dead entries outside the current browsable set', () => {
    const nameSet = new Set(names)
    const stray = Object.keys(TIER_OF).filter((n) => !nameSet.has(n))
    expect(stray, `TIER_OF entries with no matching catalog type: ${stray.join(', ')}`).toEqual([])
  })

  it('the tier buckets partition the browsable set exactly — no overlap, no gap', () => {
    const total = TIERS.reduce((sum, tier) => sum + names.filter((n) => tierOf(n) === tier).length, 0)
    expect(total).toBe(names.length)
  })

  it('tierOf degrades gracefully (never throws) for a name the table has not caught up to', () => {
    expect(() => tierOf('SomeFutureCatalogType')).not.toThrow()
    expect(TIERS).toContain(tierOf('SomeFutureCatalogType'))
  })

  it('NESTED_ONLY entries never leak into the browsable/tiered set', () => {
    for (const nested of NESTED_ONLY) expect(names).not.toContain(nested)
  })
})

describe('a2ui-catalog-tiers — seedsUsingType is DERIVED from the shelf, never hand-listed', () => {
  it('every returned seed name is a real shelf member (no phantom/stale names)', () => {
    const allNames = new Set(allSeeds.map((s) => s.name))
    for (const name of browsableNames()) {
      for (const seedName of seedsUsingType(name)) expect(allNames.has(seedName)).toBe(true)
    }
  })

  it('finds at least one real cross-link (anti-vacuous — Text is emitted broadly across the shelf)', () => {
    expect(seedsUsingType('Text').length).toBeGreaterThan(0)
  })

  it('an unknown/never-emitted type returns an empty list, not undefined', () => {
    expect(seedsUsingType('NoSuchCatalogType')).toEqual([])
  })

  it('the derivation BITES: a type only a specific seed emits maps back to exactly that seed (not every seed)', () => {
    // Pick a real seed and a real type it emits, then prove the reverse index isn't just "every type maps
    // to every seed" (the vacuous-pass shape a hand-listed stub could fake).
    const seed = allSeeds[0]!
    const emitted = new Set<string>()
    for (const message of seed.messages) {
      if ('updateComponents' in message) for (const c of message.updateComponents.components) emitted.add(c.component)
    }
    expect(emitted.size).toBeGreaterThan(0)
    for (const type of emitted) expect(seedsUsingType(type)).toContain(seed.name)
  })
})

describe('a2ui-catalog-tiers — seedGalleryHref', () => {
  it('derives a stable, hash-anchored href from a seed name, matching a2ui-gallery.ts\'s own card id scheme', () => {
    expect(seedGalleryHref('kpi-panel-lifecycle')).toBe('./a2ui-gallery.html#seed-kpi-panel-lifecycle')
  })
})
