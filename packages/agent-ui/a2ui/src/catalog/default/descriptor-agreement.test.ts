// descriptor-agreement.test.ts — the ADR-0173 cl.5/OF3 catalog↔descriptor AGREEMENT gate. Closes the one
// drift class `index.test.ts`'s SPEC-N2 fleet-derived COVERAGE gate does not check: whether a catalog
// `PropDef` whose `mapsTo` names a real descriptor-declared attribute agrees with the descriptor on TYPE
// KIND and (for enums) MEMBER SET — the descriptor being, post-inversion, the props ground truth for that
// control (ADR-0173 cl.1). Lands WITH the first props-generator conversion (OF3), and runs FLEET-WIDE from
// day one — the gate's domain (a catalog row vs. a descriptor) is independent of props-generation/conversion
// status (both exist today, unconditionally), so it is not scoped to only the wave's converted controls.
//
// Never touches catalog row CONTENT (cl.5 rules catalog generation out categorically) — this file only
// READS both sides and asserts agreement. Curated OMISSIONS stay legal by construction (a subset of a
// control's real props is the point of curation); a `mapsTo` target OUTSIDE the descriptor's attribute names
// (`textContent`, a controller-owned action, ADR-0161 value-mark plumbing) is outside this gate's domain,
// skipped exactly as cl.5 names. Any REMAINING disagreement is either a deliberate, cited divergence (a
// recorded AGREEMENT_EXCEPTIONS entry — the ADR-0087 include-or-recorded-exclusion shape, one level down)
// or a real fleet defect this build is not authorized to fix (catalog content is untouched) — the first
// fleet-wide run of this gate found three such rows; two (TextField.type missing ADR-0123's 'color',
// TimelineItem.status missing ADR-0146 F7's 'warning') were genuine pre-existing catalog staleness, fixed
// by GH #502 (the catalog rows now carry those members, so the gate passes them without an exception). The
// remaining row is recorded below with its own citation.

import { describe, it, expect } from 'vitest'
import { defaultCatalog } from './index.ts'
import { splitFrontmatter, parseDescriptor } from '@agent-ui/components/descriptor'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const CONTROLS_ROOT = `${ROOT}/packages/agent-ui/components/src/controls`
const read = (p: string): string => readFileSync(p, 'utf8') as string

type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }

/** Recursively list every file under `dir` (absolute paths) — the index.test.ts `walk` precedent. */
function walk(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
  } catch {
    return []
  }
  const files: string[] = []
  for (const e of entries) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) files.push(...walk(full))
    else if (e.isFile()) files.push(full)
  }
  return files
}

/** `ui-{kebab}` → PascalCase (e.g. `ui-text-field` → `TextField`) — the index.test.ts `pascal` precedent,
 *  duplicated here (this is a standalone gate, cl.5's own new file — not an edit to index.test.ts). */
const pascal = (tag: string): string =>
  tag.slice('ui-'.length).split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('')

/** Every real component descriptor's attributes, keyed by its catalog PascalCase name. */
function fleetDescriptors(): Map<string, Map<string, ParsedAttribute>> {
  const out = new Map<string, Map<string, ParsedAttribute>>()
  for (const file of walk(CONTROLS_ROOT)) {
    if (!file.endsWith('.md')) continue
    let fence: string
    try {
      fence = splitFrontmatter(read(file)).fence
    } catch {
      continue // a .md with no frontmatter fence is not a descriptor
    }
    const desc = parseDescriptor(fence)
    const tag = desc.scalars.get('tag')
    if (typeof tag !== 'string' || !tag.startsWith('ui-')) continue
    const byName = new Map<string, ParsedAttribute>()
    for (const attr of desc.attributes) if (attr.name !== undefined) byName.set(attr.name, attr)
    out.set(pascal(tag), byName)
  }
  return out
}

/** A catalog `PropDef.type` JSON-Schema fragment's `type` keyword, normalized to an array (handles both the
 *  single-string and the `anyOf`-style array-union forms, e.g. Table.sort's `["object","null"]`). */
function catalogKinds(type: unknown): string[] {
  if (typeof type !== 'object' || type === null) return []
  const t = (type as { type?: unknown }).type
  if (Array.isArray(t)) return t.map(String)
  return typeof t === 'string' ? [t] : []
}

function catalogEnum(type: unknown): string[] | undefined {
  if (typeof type !== 'object' || type === null) return undefined
  const e = (type as { enum?: unknown }).enum
  return Array.isArray(e) ? e.map(String) : undefined
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && new Set(a).size === new Set(b).size && a.every((v) => b.includes(v))

/**
 * Whether a catalog PropDef's declared type agrees with the descriptor attribute it `mapsTo`s — TOTAL, pure
 * (drives the negative controls below with synthetic inputs). EXACT agreement by default: an enum's member
 * SET must match exactly (a narrower or wider catalog enum is a recorded exception, cl.5's own "any
 * deliberate narrowing... enters a recorded per-prop exception table" — extended here to any exact-match
 * miss, so a widening is equally visible, not silently tolerated by a permissive subset rule).
 */
function propAgrees(attr: ParsedAttribute, catalogType: unknown): boolean {
  const kinds = catalogKinds(catalogType)
  switch (attr.type) {
    case 'enum': {
      const enumMembers = catalogEnum(catalogType)
      return kinds.length === 1 && kinds[0] === 'string' && enumMembers !== undefined && attr.values !== undefined && sameSet(enumMembers, attr.values)
    }
    case 'boolean':
      return kinds.includes('boolean')
    case 'number':
      return kinds.includes('number')
    case 'string':
      return kinds.includes('string') && catalogEnum(catalogType) === undefined
    case 'json':
      return kinds.some((k) => k === 'array' || k === 'object')
    default:
      return false
  }
}

interface AgreementException {
  component: string
  prop: string
  reason: string
}

/** Recorded, cited divergences the gate's first fleet-wide run surfaced (ADR-0087 include-or-recorded-
 *  exclusion, one level down, per cl.5). Catalog row CONTENT is untouched by this build — these are NOT
 *  fixes, they are an honest paper trail. `propAgrees` is deliberately PERMISSIVE on the base type KIND for
 *  a JSON-Schema type UNION (a catalog `["string","number"]` agrees with a descriptor `string` prop — a real,
 *  common, deliberate wire-tolerance shape, e.g. Tabs.selected/Stat.value/Swiper.active all documented in
 *  their own descriptor comments as accepting either a key/index string or a raw number) — that permissiveness
 *  is why those do NOT need an exception entry. It is EXACT on enum member sets (no subset/superset
 *  tolerance) — a narrower OR wider catalog enum is always a visible disagreement, recorded here or fixed,
 *  never silently passed. The one exception below is a bespoke-factory value TRANSLATION the mapsTo-name
 *  heuristic cannot itself tell apart from a literal passthrough. The other two rows this gate's first
 *  fleet-wide run caught were genuine pre-existing catalog staleness (TextField.type, TimelineItem.status) —
 *  fixed by GH #502, not carried here as exceptions. */
const AGREEMENT_EXCEPTIONS: readonly AgreementException[] = [
  {
    component: 'Text',
    prop: 'variant',
    reason:
      'DELIBERATE — mapsTo:"variant" coincides in NAME with a real live prop but is not a 1:1 value passthrough: ' +
      "textFactory (factories.ts) fans the catalog's h1..h5/caption/body wire vocabulary through TEXT_VARIANT_TABLE " +
      "onto the control's as/variant/size triple. The catalog vocabulary and the descriptor's own variant enum " +
      '(display/headline/title/body/label/kicker/overline/quote/lead) are two intentionally different value spaces.',
  },
]
const EXCEPTION_KEYS = new Set(AGREEMENT_EXCEPTIONS.map((e) => `${e.component}.${e.prop}`))

interface Disagreement {
  component: string
  prop: string
  mapsTo: string
  descriptorKind: string | undefined
  catalogType: unknown
}

/** Every catalog PropDef whose `mapsTo` names a real descriptor attribute of its own component, but whose
 *  declared type disagrees — pure, so the negative controls can drive it with synthetic inputs. */
function findDisagreements(
  components: Record<string, { properties: Record<string, { type: unknown; mapsTo: string }> }>,
  descriptors: ReadonlyMap<string, ReadonlyMap<string, ParsedAttribute>>,
): Disagreement[] {
  const out: Disagreement[] = []
  for (const [componentName, def] of Object.entries(components)) {
    const attrs = descriptors.get(componentName)
    if (!attrs) continue // no shipped descriptor for this catalog component (e.g. a2ui-basic-only shapes; N/A here)
    for (const [prop, propDef] of Object.entries(def.properties)) {
      const attr = attrs.get(propDef.mapsTo)
      if (!attr) continue // mapsTo targets outside the props surface (textContent / action / value-mark plumbing) — outside this gate's domain
      if (!propAgrees(attr, propDef.type)) out.push({ component: componentName, prop, mapsTo: propDef.mapsTo, descriptorKind: attr.type, catalogType: propDef.type })
    }
  }
  return out
}

describe('descriptor-agreement — pure predicate negative controls (synthetic, not fleet data)', () => {
  it('propAgrees: exact kind + enum-member-set matches agree; everything else disagrees', () => {
    expect(propAgrees({ type: 'string' }, { type: 'string' })).toBe(true)
    expect(propAgrees({ type: 'string' }, { type: 'number' })).toBe(false)
    expect(propAgrees({ type: 'boolean' }, { type: 'boolean' })).toBe(true)
    expect(propAgrees({ type: 'number' }, { type: 'number' })).toBe(true)
    expect(propAgrees({ type: 'json' }, { type: 'array' })).toBe(true)
    expect(propAgrees({ type: 'json' }, { type: 'object' })).toBe(true)
    expect(propAgrees({ type: 'json' }, { type: 'string' })).toBe(false)
    expect(propAgrees({ type: 'enum', values: ['a', 'b'] }, { type: 'string', enum: ['a', 'b'] })).toBe(true)
    expect(propAgrees({ type: 'enum', values: ['a', 'b'] }, { type: 'string', enum: ['a'] })).toBe(false) // narrower — must be a RECORDED exception, not silently accepted
    expect(propAgrees({ type: 'enum', values: ['a', 'b'] }, { type: 'string', enum: ['a', 'b', 'c'] })).toBe(false) // wider — same
    expect(propAgrees({ type: 'string' }, { type: 'string', enum: ['a'] })).toBe(false) // a plain string prop vs. a catalog enum disagrees on KIND
  })

  it('findDisagreements: bites on a real synthetic mismatch, stays clean on agreement, skips outside-domain mapsTo', () => {
    const descriptors = new Map([['Zz', new Map<string, ParsedAttribute>([['live', { name: 'live', type: 'string' }]])]])
    const mismatched = findDisagreements({ Zz: { properties: { wire: { type: { type: 'number' }, mapsTo: 'live' } } } }, descriptors)
    expect(mismatched).toEqual([{ component: 'Zz', prop: 'wire', mapsTo: 'live', descriptorKind: 'string', catalogType: { type: 'number' } }])

    const agreeing = findDisagreements({ Zz: { properties: { wire: { type: { type: 'string' }, mapsTo: 'live' } } } }, descriptors)
    expect(agreeing).toEqual([])

    const outsideDomain = findDisagreements({ Zz: { properties: { wire: { type: { type: 'number' }, mapsTo: 'textContent' } } } }, descriptors)
    expect(outsideDomain).toEqual([]) // "textContent" names no descriptor attribute — outside the gate's domain, not a disagreement
  })
})

describe('descriptor-agreement — the real default catalog vs. the real fleet descriptors (ADR-0173 cl.5/OF3)', () => {
  const descriptors = fleetDescriptors()
  const disagreements = findDisagreements(
    defaultCatalog.components as unknown as Record<string, { properties: Record<string, { type: unknown; mapsTo: string }> }>,
    descriptors,
  )
  const unexplained = disagreements.filter((d) => !EXCEPTION_KEYS.has(`${d.component}.${d.prop}`))

  it('anti-vacuous: real fleet descriptors were found, and real catalog↔descriptor comparisons ran', () => {
    expect(descriptors.size).toBeGreaterThan(50)
    expect(descriptors.has('Button')).toBe(true)
    expect(descriptors.has('Table')).toBe(true)
    // a real, known-agreeing pair proves the comparison isn't vacuously skipping everything
    expect(findDisagreements({ Button: defaultCatalog.components.Button as never }, descriptors).length).toBe(0)
  })

  it('every catalog PropDef whose mapsTo names a real descriptor attribute agrees — minus the recorded exceptions', () => {
    expect(unexplained).toEqual([])
  })

  it('the exception table carries NO residue — every recorded entry is a REAL, currently-live disagreement (never a stale, already-fixed exception)', () => {
    const residue = AGREEMENT_EXCEPTIONS.filter((e) => !disagreements.some((d) => d.component === e.component && d.prop === e.prop))
    expect(residue).toEqual([])
  })
})
