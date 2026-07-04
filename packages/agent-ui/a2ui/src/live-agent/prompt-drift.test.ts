// prompt-drift.test.ts — LLD-C8 / SPEC-R6 AC1: the coherence gate (PRD-G6). The machine system prompt's
// component inventory is DERIVED from the catalog, so it can never advertise a component the catalog
// lacks, and a catalog row added without regeneration surfaces automatically. Deterministic, no model.

import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../../tools/agent/system-prompt.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import type { Catalog } from '../catalog/catalog.ts'

// Extract the `- Id (…` inventory ids from ONE named `## <header>` section of the prompt (up to the next
// `## ` or end). Reading each section independently means the components inventory is asserted as SET
// EQUALITY (not merely ⊇) without the GRAMMAR's inline example component names ("Button") leaking into
// the count, and the functions inventory gets its own equally-strict gate.
function sectionIds(prompt: string, header: string): Set<string> {
  const marker = `## ${header}`
  const start = prompt.indexOf(marker)
  if (start === -1) return new Set()
  const rest = prompt.slice(start + marker.length)
  const end = rest.indexOf('\n## ')
  const body = end === -1 ? rest : rest.slice(0, end)
  const ids = new Set<string>()
  for (const m of body.matchAll(/^- (.+?) \(/gm)) ids.add(m[1]!)
  return ids
}

describe('buildSystemPrompt drift gate (LLD-C4 / SPEC-R6)', () => {
  it('derives the inventory from the catalog — every component + its props appear in the prompt', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    for (const id of Object.keys(defaultCatalog.components)) {
      expect(prompt).toContain(id)
    }
    // Every prop of a sampled component is surfaced (props are derived, not hand-listed either).
    const sample = Object.keys(defaultCatalog.components)[0]!
    for (const prop of Object.keys(defaultCatalog.components[sample]!.properties)) {
      expect(prompt).toContain(prop)
    }
  })

  it('the inventory is SET-EQUAL to the catalog — advertises every component/function AND no ghost extras', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    // Equality, not ⊇: the components section lists EXACTLY the catalog's components (a stray hand-added
    // row not in the catalog would fail here just as a missing one would).
    expect(sectionIds(prompt, 'Available components')).toEqual(new Set(Object.keys(defaultCatalog.components)))
    // The functions inventory is derived + gated too (it was previously ungated).
    expect(sectionIds(prompt, 'Available functions')).toEqual(new Set(Object.keys(defaultCatalog.functions)))
  })

  it('the inventory TRACKS the catalog (derived, not hand-listed) — the gate bites on drift', () => {
    const real = buildSystemPrompt(defaultCatalog, [])
    // A component the catalog does NOT declare is absent from the prompt (not a hardcoded superset).
    expect(real).not.toContain('PlantedGhostComponent')

    // Plant a component and rebuild: it surfaces automatically. If buildSystemPrompt hand-listed a fixed
    // set, this would FAIL (the new row would be missing) — that failure IS the PRD-G6 coherence gate.
    const planted: Catalog = {
      ...defaultCatalog,
      components: {
        ...defaultCatalog.components,
        PlantedGhostComponent: {
          name: 'PlantedGhostComponent',
          properties: { ghostProp: { type: {}, mapsTo: 'ghostProp' } },
        },
      },
    }
    const withPlanted = buildSystemPrompt(planted, [])
    expect(withPlanted).toContain('PlantedGhostComponent')
    expect(withPlanted).toContain('ghostProp')
  })

  it('the FUNCTIONS inventory tracks the catalog too (derived, not hand-listed)', () => {
    expect(buildSystemPrompt(defaultCatalog, [])).not.toContain('plantedGhostFn')
    const planted: Catalog = {
      ...defaultCatalog,
      functions: {
        ...defaultCatalog.functions,
        plantedGhostFn: { args: {}, returns: {}, callableFrom: 'clientOnly' },
      },
    }
    const withPlanted = buildSystemPrompt(planted, [])
    expect(withPlanted).toContain('plantedGhostFn') // a new function row surfaces automatically
    expect(sectionIds(withPlanted, 'Available functions')).toContain('plantedGhostFn')
  })
})
