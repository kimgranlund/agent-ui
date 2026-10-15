// selection-guidance.test.ts: the COVERAGE GATE for the catalogs' `selection.json` sidecars (the
// selection guidance `agent/selection-guidance.ts` loads). Coverage is a gate, never a hand-listed table:
//
//  1. Every sidecar on disk loads under the loader's caps and rules (no self edge, no restatement, ...).
//  2. Bijection: the default and a2ui-basic sidecars carry exactly one entry per catalog type, so a new
//     emittable type without guidance reds, and so does an orphan entry for a removed type.
//  3. Every edge renders: each clause resolves its notFor targets against its own catalog.
//  4. Reciprocity: inside default, inside a2ui-basic, and inside each persona fragment, an edge A -> B
//     implies B -> A (each direction carries its own why). A persona edge to a type present in EVERY base
//     that persona targets is exempt, since a base cannot name persona types.
//  5. Personas: for every shipped manifest and every base it targets, the derived catalog's guidance
//     covers every fragment type and every clause renders. This also holds the loader's hard-coded persona
//     list equal to `SHIPPED_PERSONA_CATALOG_MANIFESTS`, together with the orphan leg below.
//  6. Orphans: every `selection.json` under `src/catalog/` belongs to default, a2ui-basic, a shipped
//     persona, or a shipped domain.
//  7. Domains (T-0202, catalog architecture CA-R4, CA-R9, D8): a domain sidecar is a bijection with its fragment,
//     reciprocal inside it (base types exempt), names no other domain's type (cross-domain), never replaces a
//     base entry (no-replace), and only appends edges onto base entries that point at its own types
//     (append-only). Appended edges are exempt from reciprocity. No domain ships in W0, so each rule is proven on
//     a seeded sidecar below; the real-tree leg covers every domain from W1 on.
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
import { composeCatalog, composeDomainCatalog } from './compose.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from './personas/manifests.ts'
import { SHIPPED_DOMAIN_CATALOG_MANIFESTS } from './domains/manifests.ts'
import {
  composeSelectionGuidance,
  loadAppendedEdges,
  loadSelectionGuidance,
  selectionGuidanceFor,
  selectionGuidanceForId,
  SelectionGuidanceError,
  SelectionGuidanceErrorCode,
} from '../agent/selection-guidance.ts'
import type { SelectionEntry } from '../agent/selection-guidance.ts'
import {
  loadDefect,
  missingEntries,
  bijectionDefects,
  renderDefects,
  reciprocityDefects,
  orphanDirs,
  replaceDefects,
  crossDomainDefects,
  appendDefects,
} from '../../tools/testkit/catalog-gates.ts'

declare const process: { cwd(): string }
const CATALOG_DIR = `${process.cwd()}/packages/agent-ui/a2ui/src/catalog`

const BASES: Readonly<Record<string, Catalog>> = { 'agent-ui': defaultCatalog, 'a2ui-basic': a2uiBasicCatalog }

/** Types present in every base in `targets`: the only base types a persona edge may target one-way. */
const baseTypesIn = (targets: readonly string[]): ReadonlySet<string> =>
  new Set(Object.keys(defaultCatalog.components).filter((t) => targets.every((id) => Object.hasOwn(BASES[id]!.components, t))))

const PERSONA_DIRS = SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => `personas/${m.personaId}`)
const DOMAIN_DIRS = SHIPPED_DOMAIN_CATALOG_MANIFESTS.map((m) => `domains/${m.domainId}`)
const SIDECAR_DIRS = ['default', 'a2ui-basic', ...PERSONA_DIRS, ...DOMAIN_DIRS]

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

    // Absent or empty `targetCatalogs` means `['agent-ui']` alone (compose.ts `targetsFor`).
    const targets = m.targetCatalogs !== undefined && m.targetCatalogs.length > 0 ? m.targetCatalogs : ['agent-ui']

    it(`${m.personaId}: its sidecar is a bijection with the fragment and reciprocal inside it`, () => {
      const own = loadSelectionGuidance(readDoc(`personas/${m.personaId}`))
      expect(bijectionDefects(own, fragmentTypes)).toEqual([])
      expect(reciprocityDefects(own, baseTypesIn(targets))).toEqual([])
    })
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

describe('domain sidecars: every shipped domain, every targeted base (CA-R4)', () => {
  it('every domain folder on disk is a shipped domain manifest, and the reverse (none ship before W1)', () => {
    const onDisk = readdirSync(`${CATALOG_DIR}/domains`, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `domains/${d.name}`)
    expect(onDisk.sort()).toEqual([...DOMAIN_DIRS].sort())
  })

  for (const m of SHIPPED_DOMAIN_CATALOG_MANIFESTS) {
    const fragmentTypes = Object.keys(m.fragment.components)
    const targets = m.targetCatalogs !== undefined && m.targetCatalogs.length > 0 ? m.targetCatalogs : ['agent-ui']
    const doc = (): unknown => readDoc(`domains/${m.domainId}`)

    it(`${m.domainId}: a bijection with the fragment, reciprocal inside it, and inside the edge law`, () => {
      const own = loadSelectionGuidance(doc())
      const append = loadAppendedEdges(doc())
      const base = baseTypesIn(targets)
      expect(bijectionDefects(own, fragmentTypes)).toEqual([])
      expect(reciprocityDefects(own, base)).toEqual([])
      expect(replaceDefects(m.domainId, own, base)).toEqual([])
      expect(crossDomainDefects(m.domainId, own, append, base)).toEqual([])
      for (const baseId of targets) expect(appendDefects(m.domainId, append, selectionGuidanceFor(BASES[baseId]!))).toEqual([])
    })
    for (const baseId of targets) {
      it(`${m.domainId} on ${baseId}: the derived guidance covers every domain type and renders`, () => {
        const derived = composeDomainCatalog(BASES[baseId]!, [m])
        const guidance = selectionGuidanceFor(derived)
        expect(missingEntries(guidance, fragmentTypes)).toEqual([])
        expect(renderDefects(guidance, derived)).toEqual([])
      })
    }
  }
})

describe('orphans', () => {
  it('every selection.json under src/catalog/ is default, a2ui-basic, a shipped persona or a shipped domain', () => {
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
    expect(m.targetCatalogs).toEqual(['agent-ui', 'a2ui-basic'])
    expect(reciprocityDefects({ [t]: planted[t]! }, baseTypesIn(m.targetCatalogs!))).toEqual([`${t} -> Badge has no Badge -> ${t} edge`])
  })

  it('NEGATIVE CONTROL (orphan): a sidecar under an unshipped persona dir reds the orphan predicate', () => {
    expect(orphanDirs([...SIDECAR_DIRS, 'personas/ghost'], SIDECAR_DIRS)).toEqual(['personas/ghost'])
    expect(orphanDirs([...SIDECAR_DIRS, 'domains/ghost'], SIDECAR_DIRS)).toEqual(['domains/ghost'])
  })
})

// ---- T-0202: the domain edge law on a seeded `games` domain (Dice) beside a seeded `design` domain (Palette) ----

describe('domain edge law (CA-R4 AC1, CA-R9, D8): seeded sidecars', () => {
  const seededDoc = () => ({
    domainId: 'games',
    types: {
      Dice: { intents: ['roll for a random number'], notFor: [{ type: 'Card', why: 'a static container, not a draw' }] },
    },
    appendNotFor: { Card: [{ type: 'Dice', why: 'a random draw shown as it lands' }] },
  })
  const base = selectionGuidanceFor(defaultCatalog)
  const baseTypes = new Set(Object.keys(defaultCatalog.components))
  const games = { domainId: 'games', fragment: { components: { Dice: { name: 'Dice', properties: {} } }, functions: {} } }
  const loaded = () => ({ types: loadSelectionGuidance(seededDoc()), append: loadAppendedEdges(seededDoc()) })

  it('the seeded sidecar loads and sits inside every rule (the controls below each break one)', () => {
    expect(loadDefect(seededDoc())).toBeNull()
    const { types, append } = loaded()
    expect(reciprocityDefects(types, baseTypes)).toEqual([])
    expect(replaceDefects('games', types, baseTypes)).toEqual([])
    expect(crossDomainDefects('games', types, append, baseTypes)).toEqual([])
    expect(appendDefects('games', append, base)).toEqual([])
  })

  it('composes onto the base: the domain type joins, the base entry gains the edge after its own, its intents unchanged', () => {
    const composed = composeSelectionGuidance(base, [['games', loaded()]])
    expect(composed.Dice!.intents).toEqual(['roll for a random number'])
    expect(composed.Card!.intents).toEqual(base.Card!.intents)
    expect(composed.Card!.notFor.slice(0, base.Card!.notFor.length)).toEqual(base.Card!.notFor)
    expect(composed.Card!.notFor.at(-1)).toEqual({ type: 'Dice', why: 'a random draw shown as it lands' })
    expect(base.Card!.notFor.some((e) => e.type === 'Dice'), 'the bare base never sees the edge').toBe(false)
    expect(renderDefects(composed, composeDomainCatalog(defaultCatalog, [games]))).toEqual([])
    expect(renderDefects(composed, defaultCatalog), 'the appended edge cannot render on the bare base').not.toEqual([])
  })

  it('NEGATIVE CONTROL (cross-domain): a domain entry naming another domain type reds', () => {
    const planted = loaded()
    const types = { ...planted.types, Dice: { ...planted.types.Dice!, notFor: [{ type: 'Palette', why: 'a color set' }] } }
    expect(crossDomainDefects('games', types, planted.append, baseTypes)).toEqual(['domain "games": Dice -> Palette names a type outside the domain and its base'])
    const append = { Card: [{ type: 'Palette', why: 'a color set' }] }
    expect(crossDomainDefects('games', planted.types, append, baseTypes)).toEqual(['domain "games": appended Card -> Palette names a type the domain does not declare'])
  })

  it('NEGATIVE CONTROL (no-replace): a domain types key naming a base type reds, and composition refuses it', () => {
    const doc = seededDoc() as { types: Record<string, unknown> }
    doc.types.Button = { intents: ['press to roll'], notFor: [] }
    const types = loadSelectionGuidance(doc)
    expect(replaceDefects('games', types, baseTypes)).toEqual(['domain "games" replaces the base entry "Button"'])
    expect(() => composeSelectionGuidance(base, [['games', { types, append: {} }]])).toThrow(/replaces the entry for "Button"/)
  })

  it('NEGATIVE CONTROL (append-only): an append onto a non-base type, a repeated base edge and a cap overflow each red', () => {
    expect(appendDefects('games', { Dice: [{ type: 'Card', why: 'x' }] }, base)).toEqual(['domain "games" appends to "Dice", which is not a base entry'])
    const existing = base.Card!.notFor[0]!
    expect(appendDefects('games', { Card: [existing] }, base)).toContain(`domain "games" repeats the base edge Card -> ${existing.type}`)
    const full = Object.entries(base).find(([, e]) => e.notFor.length === 4)
    expect(full, 'anti-vacuous: some default entry carries the full 4 edges').toBeDefined()
    expect(appendDefects('games', { [full![0]]: [{ type: 'Dice', why: 'a random draw' }] }, base)).toEqual([`domain "games" leaves "${full![0]}" with 5 notFor edges (0..4)`])
    expect(() => composeSelectionGuidance(base, [['games', { types: loaded().types, append: { [full![0]]: [{ type: 'Dice', why: 'a random draw' }] } }]])).toThrow(SelectionGuidanceError)
  })

  it('NEGATIVE CONTROL (loader): appendNotFor is a domain-only key, and its edges obey the edge rules', () => {
    const persona = { personaId: 'games', types: seededDoc().types, appendNotFor: seededDoc().appendNotFor }
    expect(loadDefect(persona)).toBe(SelectionGuidanceErrorCode.MALFORMED)
    const selfEdge = { ...seededDoc(), appendNotFor: { Card: [{ type: 'Card', why: 'a different axis' }] } }
    expect(loadDefect(selfEdge)).toBe(SelectionGuidanceErrorCode.MALFORMED)
    const empty = { ...seededDoc(), appendNotFor: { Card: [] } }
    expect(loadDefect(empty)).toBe(SelectionGuidanceErrorCode.MALFORMED)
  })

  it('a domain id with no shipped domain resolves to the base guidance (fail-closed), never to an empty map', () => {
    expect(selectionGuidanceForId('agent-ui--games')).toEqual(selectionGuidanceForId('agent-ui'))
    expect(selectionGuidanceForId('agent-ui--design+games')).toEqual(selectionGuidanceForId('agent-ui'))
  })
})
