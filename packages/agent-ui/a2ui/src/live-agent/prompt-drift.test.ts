// prompt-drift.test.ts — LLD-C8 / SPEC-R6 AC1: the coherence gate (PRD-G6). The machine system prompt's
// component inventory is DERIVED from the catalog, so it can never advertise a component the catalog
// lacks, and a catalog row added without regeneration surfaces automatically. Deterministic, no model.

import { describe, it, expect } from 'vitest'
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
// (LLD-C3 leaf 10).
//
// **This file used to carry its own source re-scan, and no longer does (GH #351 F4).** Once the ruled
// derivation grew the sibling `.define(` leg, that re-scan became a line-for-line TRANSCRIPTION of both
// `dogfood-inventory.ts` and `dogfood-tag-set-equality.test.ts`'s copy — same walk, same filters, same
// regex — so its "tags ≡ an independent re-scan" assertion asked the SAME question AC2's third leg
// already asks, and answered it with the same code. Two identical questions are one question. The tag
// set-equality leg lives at AC2 (`dogfood-tag-set-equality.test.ts`), which owns it against the real
// BUILT BUNDLE — the only genuinely independent answer available.
//
// What AC1 owns instead is a question no other gate asks: does the RENDERED PROSE — the actual bytes
// the model receives — carry exactly the tag set `dogfoodInventoryTags()` advertises? The two are
// computed by different code paths off the same discovery (`dogfoodInventory` renders rows and family
// clauses; `dogfoodInventoryTags` flat-maps tags), so a renderer that dropped a family clause, or a
// tags accessor that counted a sibling the prose never names, is a REAL divergence this catches and
// nothing else does.

/** Re-parse the composed inventory PROSE back into the tag set it actually teaches — parent tags from
 *  each row's `- <tag> — ` head, family tags from its trailing `(family: a, b)` clause. Deliberately
 *  parsed from the rendered string, never from the module's internals: this is the model's-eye view. */
function tagsNamedInRenderedProse(prose: string): Set<string> {
  const tags = new Set<string>()
  for (const line of prose.split('\n')) {
    const head = /^- (ui-[a-z0-9-]+) — /.exec(line)
    if (head) tags.add(head[1]!)
    const family = /\(family: ([^)]*)\)\s*$/.exec(line)
    if (family) for (const t of family[1]!.split(',')) tags.add(t.trim())
  }
  return tags
}

describe('dogfoodInventory drift gate (LLD-C3 leaf 10 / SPEC-R13(b) AC1)', () => {
  it('the RENDERED prose names exactly the tags the accessor advertises — rows + family clauses, round-tripped', () => {
    expect(tagsNamedInRenderedProse(dogfoodInventory())).toEqual(new Set(dogfoodInventoryTags()))
  })

  // NEGATIVE CONTROL — the round-trip must bite: a tag present in the accessor but absent from the prose
  // (a dropped family clause, the exact regression the renderer could introduce) fails the equality.
  it('NEGATIVE CONTROL — prose missing a family clause diverges from the advertised tag set', () => {
    const mutilated = dogfoodInventory().replace(' (family: ui-tab, ui-tab-panel)', '')
    expect(tagsNamedInRenderedProse(mutilated)).not.toEqual(new Set(dogfoodInventoryTags()))
  })

  // The GH #346 ruling's own leg: a family's prose-only sub-elements ride their PARENT descriptor's
  // row (never rows of their own — they have no descriptor, hence no summary and no attributes).
  it('teaches a compound family\'s sibling tags on the parent\'s row, not as free-floating rows', () => {
    const inv = dogfoodInventory()
    const cardLine = inv.split('\n').find((l) => l.startsWith('- ui-card — '))
    expect(cardLine).toContain('(family: ui-card-content, ui-card-footer, ui-card-header)')
    const tabsLine = inv.split('\n').find((l) => l.startsWith('- ui-tabs — '))
    expect(tabsLine).toContain('(family: ui-tab, ui-tab-panel)')
    for (const sibling of ['ui-card-header', 'ui-card-content', 'ui-card-footer', 'ui-tab', 'ui-tab-panel']) {
      expect(inv, `${sibling} must ride its parent's row, never open one`).not.toContain(`\n- ${sibling} — `)
    }
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
