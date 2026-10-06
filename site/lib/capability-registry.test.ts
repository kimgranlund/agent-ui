// site/lib/capability-registry.test.ts: the site half of the capability-registry gates (GH #1807).
//
//  1. The two committed projection copies are byte-identical (the sitemap two-copy vehicle). Their equality
//     with a FRESH generation is `a2ui/tools/registry/generate.test.ts`, which names `npm run generate:registry`.
//  2. The page model: a persona view lists its persona-only type with its tag, tier join and `use:` clause; a
//     base view lists none; the site's TIER_OF/NESTED_ONLY join stays page-side.
//  3. Every preset `localPatterns` names a shipped persona fragment. `resolveEffectiveCatalogId` degrades a
//     selection that names no registered fragment to the base id with no error, so this is the only place a
//     typo'd or retired persona id in a preset is caught.
import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (sitemap.test.ts precedent)
import { readFileSync } from 'node:fs'
import { resolveEffectiveCatalogId } from '@agent-ui/app/agent-admin-schema'
import { AGENT_PRESETS } from '../pages/agent-admin-presets.ts'
import { REGISTRY, catalogIds, pageModel } from './capability-registry.ts'
import type { CapabilityRegistry } from '@agent-ui/a2ui/registry'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const read = (p: string): string => readFileSync(`${ROOT}/${p}`, 'utf8') as string

describe('capability-registry projection copies', () => {
  it('the src-tree copy and the public copy are byte-identical', () => {
    expect(read('site/public/capability-registry.json')).toBe(read('site/capability-registry.json'))
  })

  it('anti-vacuous: the page imports a real registry', () => {
    expect(REGISTRY.base.filter((r) => r.kind === 'type' && r.scope === 'agent-ui').length).toBeGreaterThanOrEqual(80)
    expect(Object.keys(REGISTRY.personas)).toContain('croupier')
  })
})

describe('the page model', () => {
  it('lists every base id and every persona derived id the base is targeted by', () => {
    const ids = catalogIds(REGISTRY)
    expect(ids.slice(0, 2)).toEqual(['agent-ui', 'a2ui-basic'])
    expect(ids).toContain('agent-ui--croupier')
    expect(ids).toContain('a2ui-basic--concierge')
  })

  it('the croupier view lists PlayingCard with its tag, descriptor tier and use clause, marked persona-only', () => {
    const model = pageModel(REGISTRY, 'agent-ui--croupier')
    const card = model.lines.find((l) => l.name === 'PlayingCard')
    expect(card).toBeDefined()
    expect(card!.tag).toBe('ui-playing-card')
    expect(card!.descriptorTier).toBe('display')
    expect(card!.use).toContain('playing card')
    expect(card!.personaOnly).toBe(true)
    expect(card!.tier).toBe('') // the site's tier table is the default catalog's; a persona type has no row in it
    expect(model.personaOnlyTypes).toEqual(['PlayingCard'])
  })

  it('a base view and an unrelated persona view list no persona-only type, and the site tier joins page-side', () => {
    const base = pageModel(REGISTRY, 'agent-ui')
    expect(base.lines.map((l) => l.name)).not.toContain('PlayingCard')
    expect(base.personaOnlyTypes).toEqual([])
    const quant = pageModel(REGISTRY, 'agent-ui--quant') // The Quant ships no local pattern set: the unknown persona half is the base view
    expect(quant.lines.map((l) => l.name)).toEqual(base.lines.map((l) => l.name))
    const button = base.lines.find((l) => l.name === 'Button')!
    expect(button.tier).not.toBe('')
    expect(button.nestedOnly).toBe(false)
    expect(base.lines.find((l) => l.name === 'CardHeader')!.nestedOnly).toBe(true)
  })

  it("an unknown base id is the empty view (the page never lists a type for an id nobody registers)", () => {
    expect(pageModel(REGISTRY, 'nobody').lines).toEqual([])
  })
})

// ── presets → fragments ─────────────────────────────────────────────────────────────────────────────────

/** Preset ids whose `localPatterns` names no shipped fragment, or whose derived id nobody registers. */
function presetsNamingNoFragment(
  presets: readonly { id: string; localPatterns?: string }[],
  registry: CapabilityRegistry,
  effectiveId: (base: string, selection: unknown) => string,
): string[] {
  const ids = new Set(catalogIds(registry))
  return presets
    .filter((p) => p.localPatterns !== undefined)
    .filter((p) => !Object.hasOwn(registry.personas, p.localPatterns!) || !ids.has(effectiveId('agent-ui', p.localPatterns)))
    .map((p) => `${p.id} -> ${p.localPatterns}`)
}

describe('presets: every localPatterns names a shipped persona fragment', () => {
  it('anti-vacuous: at least two shipped presets select a local pattern set', () => {
    expect(AGENT_PRESETS.filter((p) => p.localPatterns !== undefined).length).toBeGreaterThanOrEqual(2)
  })

  it('every shipped preset resolves to a registered derived catalog id', () => {
    expect(presetsNamingNoFragment(AGENT_PRESETS, REGISTRY, resolveEffectiveCatalogId)).toEqual([])
  })

  it('every preset selection resolves to its own derived id, never the silent base fallback', () => {
    for (const p of AGENT_PRESETS) {
      if (p.localPatterns === undefined) continue
      expect(resolveEffectiveCatalogId('agent-ui', p.localPatterns), p.id).toBe(`agent-ui--${p.localPatterns}`)
    }
  })

  it('NEGATIVE: a planted preset naming `nobody` is reported, and a real one is not', () => {
    const planted = [{ id: 'planted', localPatterns: 'nobody' }]
    expect(presetsNamingNoFragment(planted, REGISTRY, resolveEffectiveCatalogId)).toEqual(['planted -> nobody'])
    expect(presetsNamingNoFragment([{ id: 'real', localPatterns: 'croupier' }], REGISTRY, resolveEffectiveCatalogId)).toEqual([])
    expect(presetsNamingNoFragment([{ id: 'none' }], REGISTRY, resolveEffectiveCatalogId)).toEqual([])
  })
})
