// selection-guidance.test.ts: the COVERAGE GATE for the catalogs' `selection.json` sidecars (the
// selection guidance `agent/selection-guidance.ts` loads). Coverage is a gate, never a hand-listed table:
//
//  1. Every sidecar on disk loads under the loader's caps and rules (no self edge, no restatement, ...).
//  2. Bijection: the default and a2ui-basic sidecars carry exactly one entry per catalog type, so a new
//     emittable type without guidance reds, and so does an orphan entry for a removed type.
//  3. Every edge renders: each clause resolves its notFor targets against its own catalog.
//  4. Reciprocity: inside default, inside a2ui-basic, and inside each persona fragment, an edge A -> B
//     implies B -> A (each direction carries its own why). A persona edge to a type present in BOTH bases
//     is exempt, since a base cannot name persona types.
//  5. Personas: for every shipped manifest and every base it targets, the derived catalog's guidance
//     covers every fragment type and every clause renders. This also holds the loader's hard-coded persona
//     list equal to `SHIPPED_PERSONA_CATALOG_MANIFESTS`, together with the orphan leg below.
//  6. Orphans: every `selection.json` under `src/catalog/` belongs to default, a2ui-basic, or a shipped
//     persona.
//
// Each NEGATIVE CONTROL plants its defect into a copy and asserts the SAME predicate the real-tree leg
// uses reports it. The predicates live in `tools/testkit/catalog-gates.ts` (T-0011), shared with the A2UI
// test kit's seeded catalog fixture, so both run one copy of each rule. Test files are exempt from the
// gates.test.ts composition-containment leg, so this file may import the loader from `src/agent/`.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import type { Catalog } from './catalog.ts'
import { defaultCatalog } from './default/index.ts'
import { a2uiBasicCatalog } from './a2ui-basic/index.ts'
import { composeCatalog } from './compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from './personas/manifests.ts'
import { loadSelectionGuidance, selectionGuidanceFor, SelectionGuidanceErrorCode } from '../agent/selection-guidance.ts'
import type { SelectionEntry } from '../agent/selection-guidance.ts'
import { loadDefect, missingEntries, bijectionDefects, renderDefects, reciprocityDefects, orphanDirs } from '../../tools/testkit/catalog-gates.ts'

declare const process: { cwd(): string }
const CATALOG_DIR = `${process.cwd()}/packages/agent-ui/a2ui/src/catalog`

const BASES: Readonly<Record<string, Catalog>> = { 'agent-ui': defaultCatalog, 'a2ui-basic': a2uiBasicCatalog }

/** Types present in both bases: the only base types a persona edge may target one-way. */
const SHARED_BASE_TYPES: ReadonlySet<string> = new Set(
  Object.keys(defaultCatalog.components).filter((t) => Object.hasOwn(a2uiBasicCatalog.components, t)),
)

const PERSONA_DIRS = SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => `personas/${m.personaId}`)
const SIDECAR_DIRS = ['default', 'a2ui-basic', ...PERSONA_DIRS]

/** A sidecar's parsed document, a fresh deep copy each call (safe to plant defects into). */
function readDoc(dir: string): { types: Record<string, { intents: string[]; notFor: { type: string; why: string }[] }> } {
  return JSON.parse(readFileSync(`${CATALOG_DIR}/${dir}/selection.json`, 'utf8'))
}

/** Every `selection.json` under `src/catalog/`, as its directory relative to the catalog root. */
function sidecarDirsOnDisk(dir: string = CATALOG_DIR, rel = ''): string[] {
  const out: string[] = []
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${d.name}` : d.name
    if (d.isDirectory()) out.push(...sidecarDirsOnDisk(`${dir}/${d.name}`, childRel))
    else if (d.name === 'selection.json') out.push(rel)
  }
  return out
}

// ---- real-tree legs ----

describe('selection.json sidecars: load, bijection, render, reciprocity', () => {
  it('every shipped sidecar loads under the caps and rules', () => {
    for (const dir of SIDECAR_DIRS) expect(loadDefect(readDoc(dir)), dir).toBeNull()
  })

  for (const [id, catalog] of Object.entries(BASES)) {
    describe(`base catalog "${id}"`, () => {
      const guidance = selectionGuidanceFor(catalog)

      it('the guidance keys are a bijection with the catalog components', () => {
        expect(bijectionDefects(guidance, Object.keys(catalog.components))).toEqual([])
      })

      it('every edge renders against the catalog', () => {
        expect(renderDefects(guidance, catalog)).toEqual([])
      })

      it('every edge is reciprocal', () => {
        expect(reciprocityDefects(guidance, new Set())).toEqual([])
      })
    })
  }
})

describe('persona fragments: every shipped manifest, every targeted base', () => {
  it('ships at least one persona manifest (a vacuous loop proves nothing)', () => {
    expect(SHIPPED_PERSONA_CATALOG_MANIFESTS.length).toBeGreaterThan(0)
  })

  for (const m of SHIPPED_PERSONA_CATALOG_MANIFESTS) {
    const fragmentTypes = Object.keys(m.fragment.components)

    it(`${m.personaId}: its sidecar is a bijection with the fragment and reciprocal inside it`, () => {
      const own = loadSelectionGuidance(readDoc(`personas/${m.personaId}`))
      expect(bijectionDefects(own, fragmentTypes)).toEqual([])
      expect(reciprocityDefects(own, SHARED_BASE_TYPES)).toEqual([])
    })

    // Absent or empty `targetCatalogs` means `['agent-ui']` alone (compose.ts `targetsFor`).
    const targets = m.targetCatalogs !== undefined && m.targetCatalogs.length > 0 ? m.targetCatalogs : ['agent-ui']
    for (const baseId of targets) {
      it(`${m.personaId} on ${baseId}: the derived guidance covers every fragment type and renders`, () => {
        const base = BASES[baseId]
        expect(base, `unknown target base "${baseId}"`).toBeDefined()
        const derived = composeCatalog(base!, m.fragment, m.personaId)
        const guidance = selectionGuidanceFor(derived)
        expect(missingEntries(guidance, fragmentTypes)).toEqual([])
        expect(renderDefects(guidance, derived)).toEqual([])
      })
    }
  }
})

describe('orphans', () => {
  it('every selection.json under src/catalog/ is default, a2ui-basic, or a shipped persona', () => {
    const onDisk = sidecarDirsOnDisk()
    expect(onDisk.length).toBeGreaterThanOrEqual(SIDECAR_DIRS.length)
    expect(orphanDirs(onDisk, SIDECAR_DIRS)).toEqual([])
  })
})

// ---- negative controls: each plants a defect into a copy and runs the real-tree predicate ----

describe('negative controls', () => {
  const defaultTypes = Object.keys(defaultCatalog.components)
  const realDefault = (): Record<string, SelectionEntry> => ({ ...selectionGuidanceFor(defaultCatalog) })

  it('NEGATIVE CONTROL: missing entry - deleting one default entry reds the bijection predicate', () => {
    expect(bijectionDefects(realDefault(), defaultTypes)).toEqual([])
    const planted = realDefault()
    delete planted.Badge
    expect(bijectionDefects(planted, defaultTypes)).toEqual(['missing entry for "Badge"'])
  })

  it('NEGATIVE CONTROL: extra entry - an entry for a non-catalog type reds the bijection predicate', () => {
    const planted = { ...realDefault(), Ghost: { intents: ['a job'], notFor: [] } }
    expect(bijectionDefects(planted, defaultTypes)).toEqual(['extra entry "Ghost" is not a catalog type'])
  })

  it('NEGATIVE CONTROL: self edge - a type naming itself in notFor fails the load predicate', () => {
    const planted = readDoc('default')
    expect(loadDefect(planted)).toBeNull()
    planted.types.Badge!.notFor = [{ type: 'Badge', why: 'a different axis' }]
    expect(loadDefect(planted)).toBe(SelectionGuidanceErrorCode.MALFORMED)
  })

  it('NEGATIVE CONTROL: one-way edge - dropping a reverse edge reds the reciprocity predicate', () => {
    const planted = realDefault()
    const [a, entry] = Object.entries(planted).find(([, e]) => e.notFor.length > 0)!
    const b = entry.notFor[0]!.type
    planted[b] = { ...planted[b]!, notFor: planted[b]!.notFor.filter((e) => e.type !== a) }
    expect(reciprocityDefects(planted, new Set())).toEqual([`${a} -> ${b} has no ${b} -> ${a} edge`])
  })

  it('NEGATIVE CONTROL: restating intent - an intent equal to the type name fails the load predicate', () => {
    const planted = readDoc('default')
    planted.types.TextField!.intents = ['text field']
    expect(loadDefect(planted)).toBe(SelectionGuidanceErrorCode.MALFORMED)
  })

  it('NEGATIVE CONTROL (persona): an edge to a default-only type reds render on the a2ui-basic derivation', () => {
    const m = SHIPPED_PERSONA_CATALOG_MANIFESTS[0]!
    const derived = composeCatalog(a2uiBasicCatalog, m.fragment, m.personaId)
    const planted: Record<string, SelectionEntry> = { ...selectionGuidanceFor(derived) }
    const t = Object.keys(m.fragment.components)[0]!
    planted[t] = { ...planted[t]!, notFor: [{ type: 'Badge', why: 'a status chip' }] }
    expect(renderDefects(planted, derived)).toHaveLength(1)
    expect(reciprocityDefects({ [t]: planted[t]! }, SHARED_BASE_TYPES)).toEqual([`${t} -> Badge has no Badge -> ${t} edge`])
  })

  it('NEGATIVE CONTROL (orphan): a sidecar under an unshipped persona dir reds the orphan predicate', () => {
    expect(orphanDirs([...SIDECAR_DIRS, 'personas/ghost'], SIDECAR_DIRS)).toEqual(['personas/ghost'])
  })
})
