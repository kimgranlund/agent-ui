// selection.test.ts: the browser-safe selection projection is the Node loader's guidance, held equal (T-0025,
// GH #1815 item 3). Test files are exempt from the composition-containment leg, so this file may import the
// Node-side resolver `selectionGuidanceForId` from `../agent/` to be the independent derivation the projection
// is compared against: the resolver reads the build-time embed (`assets.gen.ts`), the projection reads the
// registry loader's disk read of the same sidecars, so equality is two derivations agreeing, not one read twice.
//
// The seam is typed: `selectionProjectionFor` must be assignable to the producer toolkit's `SelectionGuidance`
// (the structural-compatibility claim `types.ts` makes), and `SELECTION_PROJECTION` must be assignable to
// `RegistrySources['guidance']`, so a browser host can compose the registry's runtime tier with no `./agent`.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { selectionGuidanceForId } from '../agent/selection-guidance.ts'
import type { SelectionGuidance } from '../agent/selection-guidance.ts'
import { derivedCatalogIdsFor } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOGS } from '../catalog/personas/index.ts'
import { loadRegistrySources } from '../../tools/registry/load.ts'
import { composeRegistry, registryViewFor } from './compose.ts'
import { selectionProjectionFor } from './selection.ts'
import { SELECTION_PROJECTION } from './selection-projection.gen.ts'
import type { SelectionProjection } from './types.ts'

declare const process: { cwd(): string }
const ROOT = process.cwd()
const A2UI_DIR = 'packages/agent-ui/a2ui'
const SOURCES = loadRegistrySources(ROOT)

const SHIPPED_IDS = ['agent-ui', 'a2ui-basic', ...derivedCatalogIdsFor(SHIPPED_PERSONA_CATALOGS)]
// Ids the resolver rules name that no catalog registers: an unknown persona half, an unknown base half, an
// empty persona half, a bare unknown id, and the inbound-only canonical-URI alias.
const EDGE_IDS = ['agent-ui--ghost', 'ghost--croupier', 'ghost', 'agent-ui--', 'https://a2ui.org/specification/v0_9/basic_catalog.json']

/** The ids whose projection differs from `reference`'s guidance: the parity predicate the real leg and the controls share. */
function divergentIds(projection: SelectionProjection, ids: readonly string[]): string[] {
  return ids.filter((id) => JSON.stringify(selectionProjectionFor(id, projection)) !== JSON.stringify(selectionGuidanceForId(id)))
}

describe('selection projection: the committed module is a real, complete copy of the sidecars', () => {
  it('anti-vacuous: the projection carries both bases and every shipped persona, with real entries', () => {
    expect(Object.keys(SELECTION_PROJECTION.base).sort()).toEqual(['a2ui-basic', 'agent-ui'])
    expect(Object.keys(SELECTION_PROJECTION.persona).sort()).toEqual(['concierge', 'croupier', 'fixture-demo'])
    expect(Object.keys(SELECTION_PROJECTION.base['agent-ui']!).length).toBeGreaterThanOrEqual(80)
    expect(Object.keys(SELECTION_PROJECTION.base['a2ui-basic']!).length).toBeGreaterThanOrEqual(14)
    expect(SELECTION_PROJECTION.base['agent-ui']!.Button!.intents.length).toBeGreaterThan(0)
    expect(SELECTION_PROJECTION.base['agent-ui']!.Button!.notFor.length).toBeGreaterThan(0)
  })

  it('every sidecar on disk has a projection scope, and no scope lacks a sidecar', () => {
    const catalogDir = `${A2UI_DIR}/src/catalog`
    const personaIds = (readdirSync(`${catalogDir}/personas`) as string[]).filter((n) => !n.includes('.')).sort()
    const baseDirs = ['default', 'a2ui-basic']
    const pins = baseDirs.map((d) => (JSON.parse(readFileSync(`${catalogDir}/${d}/selection.json`, 'utf8') as string) as { catalogId: string }).catalogId)
    expect(Object.keys(SELECTION_PROJECTION.base).sort()).toEqual([...pins].sort())
    expect(Object.keys(SELECTION_PROJECTION.persona).sort()).toEqual(personaIds)
  })
})

describe('selection projection: `selectionProjectionFor` equals the Node resolver `selectionGuidanceForId`', () => {
  it('every shipped base and derived id resolves to the same guidance', () => {
    expect(SHIPPED_IDS.length).toBeGreaterThan(2)
    expect(divergentIds(SELECTION_PROJECTION, SHIPPED_IDS)).toEqual([])
  })

  it('every id the resolver rules name but no catalog registers resolves to the same guidance (base only, or empty)', () => {
    expect(divergentIds(SELECTION_PROJECTION, EDGE_IDS)).toEqual([])
    expect(selectionProjectionFor('agent-ui--ghost')).toEqual(selectionProjectionFor('agent-ui'))
    expect(selectionProjectionFor('ghost--croupier')).toEqual({})
    expect(selectionProjectionFor('https://a2ui.org/specification/v0_9/basic_catalog.json')).toEqual({})
  })

  it('a derived id is the base entries plus the persona fragment types, the persona type absent from the base', () => {
    const base = selectionProjectionFor('agent-ui')
    const derived = selectionProjectionFor('agent-ui--croupier')
    expect(Object.hasOwn(base, 'PlayingCard')).toBe(false)
    expect(derived.PlayingCard!.intents.length).toBeGreaterThan(0)
    expect(derived.Button).toEqual(base.Button)
  })

  it('NEGATIVE: one planted divergent `why`, a dropped persona and a dropped base are each reported', () => {
    const buttonEdge = SELECTION_PROJECTION.base['agent-ui']!.Button!.notFor[0]!
    const plantedWhy: SelectionProjection = {
      ...SELECTION_PROJECTION,
      base: {
        ...SELECTION_PROJECTION.base,
        'agent-ui': {
          ...SELECTION_PROJECTION.base['agent-ui']!,
          Button: { ...SELECTION_PROJECTION.base['agent-ui']!.Button!, notFor: [{ ...buttonEdge, why: `${buttonEdge.why} planted` }] },
        },
      },
    }
    // every id built on the agent-ui base carries the planted edge
    expect(divergentIds(plantedWhy, SHIPPED_IDS)).toEqual(SHIPPED_IDS.filter((id) => id.startsWith('agent-ui')))

    const { croupier: _dropped, ...otherPersonas } = SELECTION_PROJECTION.persona
    expect(divergentIds({ ...SELECTION_PROJECTION, persona: otherPersonas }, SHIPPED_IDS)).toEqual(SHIPPED_IDS.filter((id) => id.endsWith('--croupier')))

    const { 'a2ui-basic': _gone, ...onlyDefault } = SELECTION_PROJECTION.base
    expect(divergentIds({ ...SELECTION_PROJECTION, base: onlyDefault }, SHIPPED_IDS)).toEqual(SHIPPED_IDS.filter((id) => id.startsWith('a2ui-basic')))
  })
})

describe('selection projection: the typed seam', () => {
  it('`selectionProjectionFor` is assignable to the producer toolkit `SelectionGuidance`', () => {
    const guidance: SelectionGuidance = selectionProjectionFor('agent-ui--croupier')
    expect(Object.keys(guidance).length).toBeGreaterThan(80)
  })

  it('a browser host composes the registry runtime tier from the projection and gets the loader rows', () => {
    const viaProjection = composeRegistry({ ...SOURCES, guidance: SELECTION_PROJECTION })
    expect(JSON.stringify(viaProjection)).toBe(JSON.stringify(composeRegistry(SOURCES)))
    const view = registryViewFor(viaProjection, 'agent-ui--croupier')
    expect(view.types.find((r) => r.name === 'PlayingCard')!.intents).toEqual(selectionProjectionFor('agent-ui--croupier').PlayingCard!.intents)
    expect(view.types.filter((r) => r.intents !== undefined).length).toBe(view.types.length)
  })
})

describe('selection projection: the pure subpath contract', () => {
  it('the generated module and the resolver import no node:* and nothing from src/agent/', () => {
    for (const f of ['selection.ts', 'selection-projection.gen.ts']) {
      const src = readFileSync(`${A2UI_DIR}/src/registry/${f}`, 'utf8') as string
      expect(src, f).not.toMatch(/from\s+['"]node:/)
      expect(src, f).not.toMatch(/from\s+['"][^'"]*\/agent\//)
    }
  })

  it('NEGATIVE: the import predicate bites a planted node:* and a planted ./agent import', () => {
    expect("import { readFileSync } from 'node:fs'").toMatch(/from\s+['"]node:/)
    expect("import type { SelectionGuidance } from '../agent/selection-guidance.ts'").toMatch(/from\s+['"][^'"]*\/agent\//)
  })
})
