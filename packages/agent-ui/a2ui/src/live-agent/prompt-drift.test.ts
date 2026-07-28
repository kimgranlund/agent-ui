// prompt-drift.test.ts — LLD-C8 / SPEC-R6 AC1: the coherence gate (PRD-G6). The machine system prompt's
// component inventory is DERIVED from the catalog, so it can never advertise a component the catalog
// lacks, and a catalog row added without regeneration surfaces automatically. Deterministic, no model.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import type { Catalog } from '../catalog/catalog.ts'
import { dogfoodInventory, dogfoodInventoryTags, DOGFOOD_INVENTORY_CHAR_BUDGET } from '../agent/dogfood-inventory.ts'

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

  // GH #288 (root-caused by #286) — each prop line now carries its declared type/enum
  // (`describePropType`, catalog.ts), not just its bare name. Real shipped catalog rows already prove
  // this end-to-end (Text.variant/emphasis below); a planted component covers every remaining
  // type-shape a catalog can declare, the same "plant + rebuild" technique the tests above use.
  it('each prop line names its declared type/enum, not just the bare prop name (SPEC-R6 grounding, GH #288)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    // Text.variant is a declared enum; Text.emphasis is a declared boolean — the #286 root cause's own
    // two properties, now grounded instead of silently name-only.
    expect(prompt).toContain('variant: h1|h2|h3|h4|h5|caption|body')
    expect(prompt).toContain('emphasis: boolean')
  })

  it('a planted component covers every remaining type-shape (string/number/unconstrained) in one inventory line', () => {
    const planted: Catalog = {
      ...defaultCatalog,
      components: {
        ...defaultCatalog.components,
        PlantedTypeShapes: {
          name: 'PlantedTypeShapes',
          properties: {
            aString: { type: { type: 'string' }, mapsTo: 'aString' },
            aNumber: { type: { type: 'number' }, mapsTo: 'aNumber' },
            anyShape: { type: {}, mapsTo: 'anyShape' },
          },
        },
      },
    }
    const prompt = buildSystemPrompt(planted, [])
    expect(prompt).toContain('- PlantedTypeShapes (props: aString: string, aNumber: number, anyShape: any)')
  })
})

// genui-surface.spec.md SPEC-R13(b) AC1 — the dogfood segment's DERIVED fleet inventory drift gate
// (LLD-C3 leaf 10). `independentlyScannedTags` re-implements the "which controls have a `tag:` fence"
// question from scratch (a bare regex read over the SAME committed tree, never importing
// `dogfood-inventory.ts`'s own discovery function) so this test is a genuine second derivation path —
// a real regression in `dogfoodInventoryTags()` (a missed directory, an over-eager filter) fails HERE
// even though both paths read the same files, because the two implementations diverge independently.
function independentlyScannedTags(): Set<string> {
  const controlsDir = `${process.cwd()}/packages/agent-ui/components/src/controls`
  const tags = new Set<string>()
  for (const dirName of readdirSync(controlsDir)) {
    const dirPath = `${controlsDir}/${dirName}`
    if (!statSync(dirPath).isDirectory()) continue
    for (const fileName of readdirSync(dirPath)) {
      if (!fileName.endsWith('.md')) continue
      const src = readFileSync(`${dirPath}/${fileName}`, 'utf8')
      const m = /^tag:\s*(\S+)/m.exec(src)
      if (m) tags.add(m[1]!)
    }
  }
  return tags
}

describe('dogfoodInventory drift gate (LLD-C3 leaf 10 / SPEC-R13(b) AC1)', () => {
  it('the derived inventory names EXACTLY the descriptor-declared tags — set equality, an independent re-scan', () => {
    expect(new Set(dogfoodInventoryTags())).toEqual(independentlyScannedTags())
  })

  it('every descriptor-declared attribute for a sampled control appears in the derived inventory line', () => {
    const inv = dogfoodInventory()
    const buttonLine = inv.split('\n').find((l) => l.startsWith('- ui-button — '))
    expect(buttonLine).toBeDefined()
    for (const attr of ['variant', 'size', 'disabled', 'iconOnly']) {
      expect(buttonLine).toContain(`${attr}:`)
    }
  })

  it('stays within the SPEC-R13(b) budget (≤ 16 000 chars)', () => {
    expect(dogfoodInventory().length).toBeLessThanOrEqual(DOGFOOD_INVENTORY_CHAR_BUDGET)
  })
})
