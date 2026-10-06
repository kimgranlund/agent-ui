// registry-wiring.test.ts: the capability registry's wiring gates over the REAL tree (GH #1807). Each leg
// holds one join the registry makes, and each ships a negative control that plants the defect into a
// synthetic copy and asserts the SAME predicate the real-tree leg uses reports it:
//
//  1. Tag parity: the pure tag rule equals `WidgetFactory.tag` for every default catalog type, and every
//     persona type the registry tags renders exactly that tag. (A persona type is often a composition
//     of existing controls, so the rule is NOT asserted over persona factories wholesale.)
//  2. Fleet join: the loader's controls are exactly the components registry's tags (with equal `uses`),
//     every a2ui-basic and persona factory tag is a fleet control, and every default derived tag is a
//     fleet control or a sub-element alias the built-in loader serves.
//  3. Scope: every mini-skill and corpus shard names a catalog id somebody registers.
//  4. Exclusion single source: every descriptor `catalog: excluded` is on the one allowlist, and the
//     coverage gate no longer defines a second map.
//  5. Personas: the loader's hard-coded persona list equals `SHIPPED_PERSONA_CATALOG_MANIFESTS`, and the
//     composed views agree with `selectionGuidanceForId` (the registry is never a second derivation).
//  6. Opt-in: the root barrel carries no registry symbol.
//
// Test files are exempt from the layering and composition-containment legs, so this file may import the
// Node loader and the producer toolkit. The preset `localPatterns` leg lives in
// `site/lib/capability-registry.test.ts`, beside the presets it reads.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import * as rootBarrel from '@agent-ui/a2ui'
import { CONTROLS } from '@agent-ui/components/registry'
import { parseDescriptor, splitFrontmatter } from '@agent-ui/components/descriptor'
import { a2uiBasicFactories } from '../catalog/a2ui-basic/factories.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import { EXCLUSION_ALLOWLIST } from '../catalog/default/exclusions.ts'
import { conciergeFactories } from '../catalog/personas/concierge/factories.ts'
import { croupierFactories } from '../catalog/personas/croupier/factories.ts'
import { fixtureDemoFactories } from '../catalog/personas/fixture-demo/factories.ts'
import { SHIPPED_PERSONA_CATALOGS } from '../catalog/personas/index.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from '../catalog/personas/manifests.ts'
import { BUILTIN_CONTROL_RECORDS } from '../catalog/controls.ts'
import { derivedCatalogIdsFor } from '../catalog/compose.ts'
import { isVariantDispatch } from '../catalog/variant.ts'
import type { VariantDispatch, WidgetFactory } from '../catalog/types.ts'
import { selectionGuidanceForId } from '../agent/selection-guidance.ts'
import { PERSONA_FRAGMENTS, loadRegistrySources } from '../../tools/registry/load.ts'
import { composeRegistry, registryViewFor, tagForType, typeForTag } from './compose.ts'
import { selectCapabilities } from './select.ts'

declare const process: { cwd(): string }
const ROOT = process.cwd()
const A2UI_DIR = `${ROOT}/packages/agent-ui/a2ui`
const read = (p: string): string => readFileSync(p, 'utf8') as string

type Table = Readonly<Record<string, WidgetFactory | VariantDispatch>>

const SOURCES = loadRegistrySources(ROOT)
const REGISTRY = composeRegistry(SOURCES)
const REGISTRY_DERIVED_IDS: string[] = Object.entries(REGISTRY.personas).flatMap(([personaId, rows]) =>
  (rows.find((r) => r.kind === 'fragment')?.targetCatalogs ?? []).map((base) => `${base}--${personaId}`),
)

// ── predicates, shared by the real-tree legs and the negative controls ──────────────────────────────────

const tagsOf = (slot: WidgetFactory | VariantDispatch): string[] =>
  isVariantDispatch(slot) ? [slot.fallback.tag, ...Object.values(slot.variants).map((f) => f.tag)] : [slot.tag]

/** Types whose factory tag disagrees with the pure rule (a null rule means no `ui-*` tag at all). */
function tagMismatches(table: Table): string[] {
  const out: string[] = []
  for (const [type, slot] of Object.entries(table)) {
    const rule = tagForType(type)
    const tags = tagsOf(slot)
    const ok = rule === null ? tags.every((t) => !t.startsWith('ui-')) : tags.includes(rule)
    if (!ok) out.push(`${type}: rule ${String(rule)} vs factory ${tags.join('|')}`)
  }
  return out
}

/** Persona type rows carrying a `tag` that their factory does not mint (a tag claim the factory contradicts). */
function taggedButMismatched(rows: readonly { name?: string; tag?: string }[], table: Table): string[] {
  return rows
    .filter((r) => r.tag !== undefined)
    .filter((r) => !Object.hasOwn(table, r.name!) || !tagsOf(table[r.name!]!).includes(r.tag!))
    .map((r) => `${r.name}: row tag ${r.tag}`)
}

/** `ui-*` tags a table mints that are not fleet controls. */
const unknownTags = (table: Table, controlTags: ReadonlySet<string>): string[] =>
  [...new Set(Object.values(table).flatMap(tagsOf))].filter((t) => t.startsWith('ui-') && !controlTags.has(t))

/** Scoped rows naming a catalog id nobody registers. */
const unregistered = (scoped: readonly { name: string; catalogId: string }[], registered: ReadonlySet<string>): string[] =>
  scoped.filter((s) => !registered.has(s.catalogId)).map((s) => `${s.name} -> ${s.catalogId}`)

/** Descriptor-excluded types missing from the allowlist. */
const excludedButNotAllowlisted = (excludedTags: readonly string[], allowlist: ReadonlyMap<string, string>): string[] =>
  excludedTags.filter((tag) => !allowlist.has(typeForTag(tag) ?? tag))

// ── 1 · tag parity ──────────────────────────────────────────────────────────────────────────────────────

describe('tag parity: the pure rule equals the factory tag', () => {
  it('anti-vacuous: the tables are real and non-trivial', () => {
    expect(Object.keys(defaultFactories).length).toBeGreaterThanOrEqual(80)
    expect(tagForType('Button')).toBe('ui-button')
  })

  it('every default catalog type', () => {
    expect(tagMismatches(defaultFactories)).toEqual([])
  })

  it.each([
    ['concierge', conciergeFactories],
    ['croupier', croupierFactories],
    ['fixture-demo', fixtureDemoFactories],
  ] as const)('every %s persona type the registry tags renders exactly that tag', (persona, table) => {
    const rows = (REGISTRY.personas[persona] ?? []).filter((r) => r.kind === 'type')
    expect(rows.length).toBeGreaterThan(0)
    expect(Object.keys(table).sort()).toEqual(rows.map((r) => r.name!).sort()) // the fragment and its factories agree on the type set
    expect(taggedButMismatched(rows, table)).toEqual([])
  })

  it('the persona tag join is not vacuous: PlayingCard is tagged, the composition types are not', () => {
    const tagged = Object.values(REGISTRY.personas).flat().filter((r) => r.kind === 'type' && r.tag !== undefined).map((r) => r.name)
    expect(tagged).toEqual(['PlayingCard'])
    expect(Object.keys(conciergeFactories).sort()).toEqual(['BookingConfirmation', 'BookingForm'])
  })

  it('NEGATIVE: a planted type with a wrong tag, a wrong null, and a variant that lacks the rule tag are all reported', () => {
    const create = (): HTMLElement => document.createElement('div')
    const applyProp = (): void => {}
    const factory = (tag: string): WidgetFactory => ({ tag, create, applyProp })
    expect(tagMismatches({ Button: factory('ui-button') })).toEqual([])
    expect(tagMismatches({ Button: factory('ui-btn') })).toHaveLength(1)
    expect(tagMismatches({ Option: factory('ui-option') })).toHaveLength(1) // a null rule forbids any ui-* tag
    expect(tagMismatches({ Option: factory('div[role=option]') })).toEqual([])
    const dispatch: VariantDispatch = { variantProp: 'variant', variants: { a: factory('ui-select') }, fallback: factory('ui-select') }
    expect(tagMismatches({ ChoicePicker: dispatch })).toHaveLength(1)
    expect(tagMismatches({ Select: dispatch })).toEqual([])
    // a persona row whose tag claim its factory contradicts, and one it honours
    expect(taggedButMismatched([{ name: 'PlayingCard', tag: 'ui-playing-card' }], { PlayingCard: factory('ui-card') })).toHaveLength(1)
    expect(taggedButMismatched([{ name: 'PlayingCard', tag: 'ui-playing-card' }], { PlayingCard: factory('ui-playing-card') })).toEqual([])
    expect(taggedButMismatched([{ name: 'BookingForm' }], { BookingForm: factory('ui-form-provider') })).toEqual([]) // untagged: no claim
  })
})

// ── 2 · fleet join ──────────────────────────────────────────────────────────────────────────────────────

describe('fleet join: the registry joins descriptors, the components registry and the factories', () => {
  const controlRows = REGISTRY.base.filter((r) => r.kind === 'control')
  const controlTags = new Set(Object.keys(CONTROLS))

  it('the loader enumerates exactly the components registry tags', () => {
    expect(controlRows.length).toBeGreaterThan(70)
    expect(controlRows.map((r) => r.tag).sort()).toEqual([...controlTags].sort())
  })

  it("each control row's `uses` equals its components registry record", () => {
    for (const row of controlRows) expect([...(row.uses ?? [])].sort(), row.tag).toEqual([...(CONTROLS[row.tag!]!.uses ?? [])].sort())
  })

  it('every derived tag resolves: a persona tag to a fleet control, a default tag to a control or a sub-element alias', () => {
    const rows = [...REGISTRY.base, ...Object.values(REGISTRY.personas).flat()].filter((r) => r.kind === 'type' && r.tag !== undefined)
    expect(rows.length).toBeGreaterThan(70)
    const aliasOnly = (tag: string): boolean => !controlTags.has(tag) && Object.hasOwn(BUILTIN_CONTROL_RECORDS, tag)
    expect(rows.filter((r) => r.scope !== 'agent-ui').filter((r) => !controlTags.has(r.tag!)).map((r) => r.id)).toEqual([])
    expect(rows.filter((r) => r.scope === 'agent-ui').filter((r) => !controlTags.has(r.tag!) && !aliasOnly(r.tag!)).map((r) => r.id)).toEqual([])
    // anti-vacuous: the sub-element alias arm is exercised (Card regions, Tabs, Drill panels)
    expect(rows.filter((r) => aliasOnly(r.tag!)).length).toBeGreaterThan(0)
  })

  it('every `ui-*` tag an a2ui-basic or persona factory mints is a fleet control', () => {
    for (const table of [a2uiBasicFactories, conciergeFactories, croupierFactories, fixtureDemoFactories]) {
      expect(unknownTags(table, controlTags)).toEqual([])
    }
  })

  it('NEGATIVE: a planted factory tag outside the fleet is reported', () => {
    const create = (): HTMLElement => document.createElement('div')
    const planted: Table = { Ghost: { tag: 'ui-ghost', create, applyProp: () => {} } }
    expect(unknownTags(planted, controlTags)).toEqual(['ui-ghost'])
  })
})

// ── 3 · scope ───────────────────────────────────────────────────────────────────────────────────────────

describe('scope: every mini-skill and corpus shard names a registered catalog id', () => {
  const baseIds = SOURCES.catalogs.map((c) => c.catalogId)
  const registered = new Set([...baseIds, ...SOURCES.fragments.flatMap((f) => f.targetCatalogs.filter((b) => baseIds.includes(b)).map((b) => `${b}--${f.personaId}`))])

  it('every mini-skill', () => {
    expect(SOURCES.miniSkills.length).toBeGreaterThan(0)
    expect(unregistered(SOURCES.miniSkills.map((m) => ({ name: m.id, catalogId: m.catalogId })), registered)).toEqual([])
  })

  it('every corpus shard, by its filename and by every record it holds', () => {
    expect((SOURCES.corpusShards ?? []).length).toBeGreaterThan(0)
    expect(unregistered((SOURCES.corpusShards ?? []).map((s) => ({ name: s.path, catalogId: s.catalogId })), registered)).toEqual([])
    for (const shard of SOURCES.corpusShards ?? []) {
      const lines = read(`${ROOT}/${shard.path}`).split('\n').filter((l) => l.trim() !== '')
      expect(lines.length, shard.path).toBe(shard.records)
      for (const line of lines) expect((JSON.parse(line) as { meta?: { catalogId?: string } }).meta?.catalogId, shard.path).toBe(shard.catalogId)
    }
  })

  it('NEGATIVE: a planted mini-skill and shard naming `ghost` are reported', () => {
    expect(unregistered([{ name: 'planted-skill', catalogId: 'ghost' }], registered)).toEqual(['planted-skill -> ghost'])
    expect(unregistered([{ name: 'planted-shard', catalogId: 'agent-ui--nobody' }], registered)).toHaveLength(1)
    expect(unregistered([{ name: 'real', catalogId: 'agent-ui--croupier' }], registered)).toEqual([])
  })
})

// ── 4 · exclusion single source ─────────────────────────────────────────────────────────────────────────

describe('exclusion single source', () => {
  const controlsDir = `${ROOT}/packages/agent-ui/components/src/controls`
  const descriptorExcluded: string[] = []
  for (const dir of readdirSync(controlsDir) as string[]) {
    let files: string[]
    try {
      files = (readdirSync(`${controlsDir}/${dir}`) as string[]).filter((f) => f.endsWith('.md'))
    } catch {
      continue
    }
    for (const f of files) {
      try {
        const parsed = parseDescriptor(splitFrontmatter(read(`${controlsDir}/${dir}/${f}`)).fence)
        if (parsed.scalars.get('catalog') === 'excluded') descriptorExcluded.push(parsed.scalars.get('tag')!)
      } catch {
        // not a descriptor
      }
    }
  }

  it('anti-vacuous: the descriptor scan finds the one `catalog: excluded` line', () => {
    expect(descriptorExcluded).toContain('ui-command-modal')
  })

  it('every descriptor `catalog: excluded` is on the one allowlist', () => {
    expect(excludedButNotAllowlisted(descriptorExcluded, EXCLUSION_ALLOWLIST)).toEqual([])
  })

  it('every allowlist entry names a real fleet control (a control rename cannot strand a reason)', () => {
    const typeNames = new Set(REGISTRY.base.filter((r) => r.kind === 'control').map((r) => typeForTag(r.tag!)))
    expect([...EXCLUSION_ALLOWLIST.keys()].filter((t) => !typeNames.has(t))).toEqual([])
  })

  it("the loader's control states come from that one allowlist: each excluded control has an allowlist reason", () => {
    const excluded = REGISTRY.base.filter((r) => r.kind === 'control' && r.status.state === 'excluded')
    expect(excluded.length).toBeGreaterThan(0)
    for (const row of excluded) expect(row.status.reason, row.tag).toBe(EXCLUSION_ALLOWLIST.get(typeForTag(row.tag!)!))
  })

  it('the coverage gate imports the allowlist and defines no second map', () => {
    const src = read(`${A2UI_DIR}/src/catalog/default/index.test.ts`)
    expect(src).toMatch(/from '\.\/exclusions\.ts'/)
    expect(src).not.toMatch(/EXCLUSION_ALLOWLIST\s*(?::[^=]+)?=\s*new Map/)
  })

  it('NEGATIVE: a planted `catalog: excluded` descriptor with no allowlist entry is reported', () => {
    expect(excludedButNotAllowlisted(['ui-planted-chrome'], EXCLUSION_ALLOWLIST)).toEqual(['ui-planted-chrome'])
    expect(excludedButNotAllowlisted(['ui-command-modal'], EXCLUSION_ALLOWLIST)).toEqual([])
  })
})

// ── 5 · personas ────────────────────────────────────────────────────────────────────────────────────────

describe('personas: the loader list equals the shipped manifests, and the views equal the guidance resolver', () => {
  it('the hard-coded persona list and targets equal SHIPPED_PERSONA_CATALOG_MANIFESTS', () => {
    const shipped = SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => ({ personaId: m.personaId, targetCatalogs: [...(m.targetCatalogs ?? [])] })).sort((a, b) => (a.personaId < b.personaId ? -1 : 1))
    const loader = PERSONA_FRAGMENTS.map((p) => ({ personaId: p.personaId, targetCatalogs: [...p.targetCatalogs] })).sort((a, b) => (a.personaId < b.personaId ? -1 : 1))
    expect(shipped.length).toBeGreaterThan(0)
    expect(loader).toEqual(shipped)
  })

  it('the derived ids the registry offers equal the ids the renderer registers (`derivedCatalogIdsFor`)', () => {
    const baseIds = new Set(SOURCES.catalogs.map((c) => c.catalogId))
    const offered = REGISTRY_DERIVED_IDS.filter((id) => !baseIds.has(id)).sort()
    expect(offered.length).toBeGreaterThan(0)
    expect(offered).toEqual([...derivedCatalogIdsFor(SHIPPED_PERSONA_CATALOGS)].sort())
  })

  it("each loaded fragment's types and functions equal the shipped manifest fragment's", () => {
    for (const m of SHIPPED_PERSONA_CATALOG_MANIFESTS) {
      const loaded = SOURCES.fragments.find((f) => f.personaId === m.personaId)!
      expect(Object.keys(loaded.fragment.components).sort(), m.personaId).toEqual(Object.keys(m.fragment.components).sort())
      expect(Object.keys(loaded.fragment.functions).sort(), m.personaId).toEqual(Object.keys(m.fragment.functions).sort())
    }
  })

  it('every shipped derived id: the view carries exactly the types `selectionGuidanceForId` carries guidance for', () => {
    const ids = ['agent-ui', 'a2ui-basic', ...derivedCatalogIdsFor(SHIPPED_PERSONA_CATALOGS)]
    for (const id of ids) {
      const viewTypes = registryViewFor(REGISTRY, id).types.filter((r) => r.intents !== undefined).map((r) => r.name!).sort()
      expect(viewTypes, id).toEqual(Object.keys(selectionGuidanceForId(id)).sort())
    }
  })

  it('the croupier view holds every default type plus PlayingCard, with base and persona guidance', () => {
    const view = registryViewFor(REGISTRY, 'agent-ui--croupier')
    const base = registryViewFor(REGISTRY, 'agent-ui')
    expect(view.types.length).toBe(base.types.length + 1)
    expect(view.personaOnlyTypes).toEqual(['PlayingCard'])
    expect(view.types.find((r) => r.name === 'PlayingCard')!.intents).toEqual(selectionGuidanceForId('agent-ui--croupier').PlayingCard!.intents)
    expect(view.types.find((r) => r.name === 'Button')!.intents).toEqual(selectionGuidanceForId('agent-ui').Button!.intents)
  })

  it('an unknown persona is the base view, and persona-only types never leak into the base', () => {
    const base = registryViewFor(REGISTRY, 'agent-ui')
    expect(registryViewFor(REGISTRY, 'agent-ui--nobody').types).toEqual(base.types)
    expect(base.types.map((r) => r.name)).not.toContain('PlayingCard')
  })

  it('the ruled SPEC-R6 exact filter shows through: a derived id retrieves none of the base mini-skills or shards', () => {
    expect(registryViewFor(REGISTRY, 'agent-ui').retrievable.length).toBeGreaterThan(0)
    expect(registryViewFor(REGISTRY, 'agent-ui--croupier').retrievable).toEqual([])
  })

  it('selectCapabilities ranks PlayingCard first in the croupier view and never in the base view', () => {
    const intent = selectionGuidanceForId('agent-ui--croupier').PlayingCard!.intents[0]!
    expect(selectCapabilities(intent, registryViewFor(REGISTRY, 'agent-ui--croupier'), 3)[0]!.name).toBe('PlayingCard')
    expect(selectCapabilities(intent, registryViewFor(REGISTRY, 'agent-ui'), 3).map((r) => r.name)).not.toContain('PlayingCard')
  })

  it('NEGATIVE: a planted persona list that drops a shipped persona is not equal', () => {
    const planted = PERSONA_FRAGMENTS.slice(1).map((p) => p.personaId).sort()
    expect(planted).not.toEqual(SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => m.personaId).sort())
  })
})

// ── 6 · opt-in ──────────────────────────────────────────────────────────────────────────────────────────

describe('the registry is opt-in: the root barrel carries no registry symbol', () => {
  it('the root barrel source never mentions the registry subpath, and exposes no registry symbol', () => {
    const rootIndex = read(`${A2UI_DIR}/src/index.ts`)
    expect(rootIndex).not.toMatch(/from\s+['"][^'"]*registry\/[^'"]*['"]/)
    for (const sym of ['composeRegistry', 'registryViewFor', 'selectCapabilities', 'tagForType', 'typeForTag']) {
      expect(rootBarrel, `root barrel must not expose "${sym}"`).not.toHaveProperty(sym)
    }
  })

  it('src/registry imports no node:* and nothing from src/agent/ (the pure subpath contract)', () => {
    const dir = `${A2UI_DIR}/src/registry`
    const files = (readdirSync(dir) as string[]).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const src = read(`${dir}/${f}`)
      expect(src, f).not.toMatch(/from\s+['"]node:/)
      expect(src, f).not.toMatch(/from\s+['"][^'"]*\/agent\//)
    }
  })
})
