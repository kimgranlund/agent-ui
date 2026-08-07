// index.test.ts — a2ui-basic partition coverage gate (ADR-0169 cl.14, the ADR-0087 discipline applied
// to an UPSTREAM-pinned 18-type set): every upstream type is EITHER catalogued OR a recorded exclusion,
// never both, never neither; the catalog declares NO type outside the 18 (interop purity); the 13
// included functions are declared (openUrl is not, and every declared function is `clientOnly`); the
// sub-type-granularity gates (E5/E6) hold; and `register()` succeeds for both the primary catalog and
// the canonical-URI alias.

import { describe, it, expect } from 'vitest'
import { a2uiBasicCatalog, a2uiBasicCatalogCanonical, A2UI_BASIC_CANONICAL_URI } from './index.ts'
import { a2uiBasicFactories } from './factories.ts'
import { a2uiBasicFunctions } from './functions.ts'
import { Registry } from '../registry.ts'
import { resolveFactory } from '../variant.ts'
import { buildSystemPrompt } from '../../agent/system-prompt.ts'
import { defaultCatalog } from '../default/index.ts'
import { validateA2ui } from '../../renderer/validate.ts'
import type { A2uiComponent, A2uiServerMessage } from '../../protocol.ts'

// The 18 upstream A2UI v0.9.1 Basic Catalog `components` (ADR-0169 cl.14, machine-schema-pinned).
const UPSTREAM_BASIC_TYPES = [
  'Text', 'Image', 'Icon', 'Video', 'AudioPlayer', 'Row', 'Column', 'List', 'Card',
  'Tabs', 'Divider', 'Modal', 'Button', 'TextField', 'CheckBox', 'ChoicePicker', 'Slider', 'DateTimeInput',
] as const

const BASIC_TYPE_EXCLUSIONS: Record<string, string> = {
  Video: 'ADR-0169 E1 — no fleet media control',
  AudioPlayer: 'ADR-0169 E2 — no fleet media control',
  Tabs: 'ADR-0169 E3 — reference-typed prop items; no mount seam',
  Modal: 'ADR-0169 E4 — named-slot children pair; no grammar/mechanism',
}

// The 13 upstream `functions` this wave implements (cl.11); `openUrl` is the ONE deliberate exclusion (E7).
const IMPLEMENTED_FUNCTIONS = [
  'formatString', 'required', 'regex', 'length', 'numeric', 'email',
  'formatNumber', 'formatCurrency', 'formatDate', 'pluralize', 'and', 'or', 'not',
] as const

describe('a2ui-basic catalog (ADR-0169) — loads + exposes the typed Catalog', () => {
  it('a2uiBasicCatalog carries the local short id', () => {
    expect(a2uiBasicCatalog.catalogId).toBe('a2ui-basic')
    expect(a2uiBasicCatalog.protocolVersion).toBe('v1.0')
  })

  it('a2uiBasicCatalogCanonical is the SAME components/functions, keyed by the upstream canonical URI (cl.13 inbound alias)', () => {
    expect(a2uiBasicCatalogCanonical.catalogId).toBe(A2UI_BASIC_CANONICAL_URI)
    expect(A2UI_BASIC_CANONICAL_URI).toBe('https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json')
    expect(Object.keys(a2uiBasicCatalogCanonical.components)).toEqual(Object.keys(a2uiBasicCatalog.components))
    expect(Object.keys(a2uiBasicCatalogCanonical.functions)).toEqual(Object.keys(a2uiBasicCatalog.functions))
  })
})

describe('a2ui-basic — the partition coverage gate (ADR-0169 cl.14)', () => {
  const CATALOG_KEYS = new Set(Object.keys(a2uiBasicCatalog.components))
  const FACTORY_KEYS = new Set(Object.keys(a2uiBasicFactories))

  it('(1) every one of the 18 upstream types is EITHER a catalog key OR a recorded exclusion, never both, never neither', () => {
    for (const type of UPSTREAM_BASIC_TYPES) {
      const catalogued = CATALOG_KEYS.has(type)
      const excluded = type in BASIC_TYPE_EXCLUSIONS
      expect(catalogued || excluded, `${type}: neither catalogued nor excluded`).toBe(true)
      expect(catalogued && excluded, `${type}: BOTH catalogued and excluded`).toBe(false)
    }
    // Every catalogued type also has a factory (SPEC-R7 AC1 — the registry's own gate re-proven statically).
    for (const type of CATALOG_KEYS) expect(FACTORY_KEYS.has(type), type).toBe(true)
  })

  it('(2) the catalog declares NO type outside the 18 — a2ui-basic never grows fleet-only types (interop purity)', () => {
    const upstream = new Set<string>(UPSTREAM_BASIC_TYPES)
    for (const key of CATALOG_KEYS) expect(upstream.has(key), `${key} is not one of the 18 upstream types`).toBe(true)
  })

  it('the score is 14 INCLUDEd types + 4 EXCLUDEd/DEFERred', () => {
    expect(CATALOG_KEYS.size).toBe(14)
    expect(Object.keys(BASIC_TYPE_EXCLUSIONS).length).toBe(4)
  })

  it('(3) the 13 implemented functions are declared, openUrl is NOT, and every declared function is clientOnly', () => {
    const declared = new Set(Object.keys(a2uiBasicCatalog.functions))
    for (const fn of IMPLEMENTED_FUNCTIONS) expect(declared.has(fn), fn).toBe(true)
    expect(declared.has('openUrl')).toBe(false) // ADR-0169 cl.11 row 11 / exclusion E7
    expect(declared.size).toBe(IMPLEMENTED_FUNCTIONS.length)
    for (const fn of declared) expect(a2uiBasicCatalog.functions[fn]!.callableFrom, fn).toBe('clientOnly')
    // Every declared function also has an impl in the per-catalog override table (cl.8).
    for (const fn of declared) expect(Object.hasOwn(a2uiBasicFunctions, fn), fn).toBe(true)
  })

  it('(4) sub-type-granularity gates hold: ChoicePicker.variant is the WIDENED [\'mutuallyExclusive\', \'multipleSelection\'] enum (E6 DRAINED, GH #545/SPEC-R10); Icon.name is the closed string enum (E5, no {svgPath} arm)', () => {
    const choicePickerVariant = a2uiBasicCatalog.components.ChoicePicker!.properties.variant!.type as { enum?: unknown[] }
    expect(choicePickerVariant.enum).toEqual(['mutuallyExclusive', 'multipleSelection'])

    const iconName = a2uiBasicCatalog.components.Icon!.properties.name!
    expect((iconName.type as { type?: unknown }).type).toBe('string')
    expect(Array.isArray((iconName.type as { enum?: unknown }).enum)).toBe(true)
    expect((iconName.type as { enum: unknown[] }).enum.length).toBe(59) // the closed 59-identifier enum (ADR-0169 §9b Icon table)
  })

  it('(5) register() succeeds for BOTH the primary catalog and the canonical alias (SPEC-R7 AC1 — factory coverage enforced forever)', () => {
    const registry = new Registry()
    expect(() => registry.register(a2uiBasicCatalog, a2uiBasicFactories, a2uiBasicFunctions)).not.toThrow()
    expect(() => registry.register(a2uiBasicCatalogCanonical, a2uiBasicFactories, a2uiBasicFunctions)).not.toThrow()
    expect(registry.supportedCatalogIds()).toEqual(expect.arrayContaining(['a2ui-basic', A2UI_BASIC_CANONICAL_URI]))
  })
})

describe('a2ui-basic — the cl.9a common props (weight/accessibility) are declared on EVERY included type', () => {
  it('every catalogued component declares weight (number) + accessibility (object)', () => {
    for (const [name, def] of Object.entries(a2uiBasicCatalog.components)) {
      expect(def.properties.weight, `${name}.weight`).toEqual({ type: { type: 'number' }, mapsTo: 'weight' })
      expect(def.properties.accessibility, `${name}.accessibility`).toEqual({ type: { type: 'object' }, mapsTo: 'accessibility' })
    }
  })
})

describe('a2ui-basic — the cl.4 conditioned teaching line (only when catalog.catalogId !== \'agent-ui\')', () => {
  it('a2uiBasicCatalog composes the catalogId-authority teaching line', () => {
    const prompt = buildSystemPrompt(a2uiBasicCatalog, [])
    expect(prompt).toContain('Every createSurface this turn MUST carry "catalogId":"a2ui-basic"')
  })

  it('defaultCatalog composes NO teaching line — byte-identical to the pre-ADR-0169 composition', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).not.toContain('MUST carry "catalogId"')
  })
})

// a2ui-reviewer's adversarial pass (fix-413 reconciliation) proved three of the four exclusion arms
// are actually gate-encoded by `validateA2ui` and found the assertion missing from the suite; this
// closes that gap. `surface()` builds the minimal two-message envelope (createSurface + one
// updateComponents carrying a single `root`) each case needs.
function surface(components: readonly A2uiComponent[]): A2uiServerMessage[] {
  return [
    { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'a2ui-basic' } },
    { version: 'v1.0', updateComponents: { surfaceId: 's1', components } },
  ] as A2uiServerMessage[]
}

describe('a2ui-basic — the exclusion-gate coverage (E1/E5), each a CATALOG rejection', () => {
  it('(E1) a Video component — no fleet media control, not a catalog key at all — rejects', () => {
    const msgs = surface([{ id: 'root', component: 'Video', url: 'https://example.com/clip.mp4' }])
    expect(validateA2ui(msgs, a2uiBasicCatalog)).toEqual({ valid: false, failures: [{ code: 'CATALOG', path: 'root' }] })
  })

  it('(E5) Icon.name:{svgPath} — the closed string enum has no object arm — rejects', () => {
    const msgs = surface([{ id: 'root', component: 'Icon', name: { svgPath: 'M0 0L1 1' } }])
    expect(validateA2ui(msgs, a2uiBasicCatalog)).toEqual({ valid: false, failures: [{ code: 'CATALOG', path: 'root.name' }] })
  })

  it('positive control — the SAME shapes with the included variant pass (mutuallyExclusive / a plain string Icon name)', () => {
    const choice = surface([{ id: 'root', component: 'ChoicePicker', variant: 'mutuallyExclusive', options: [] }])
    expect(validateA2ui(choice, a2uiBasicCatalog)).toEqual({ valid: true, failures: [] })

    const icon = surface([{ id: 'root', component: 'Icon', name: 'star' }])
    expect(validateA2ui(icon, a2uiBasicCatalog)).toEqual({ valid: true, failures: [] })
  })

  // (E7) `Button.action:{functionCall:{...}}` — GH #429: gate-encoded at conformance via the narrow
  // `PropDef.rejectFunctionCall` extension (declared only on `a2ui-basic/catalog.json`'s `Button.action`,
  // conformance.ts's `matchesType`). Unlike E1/E5's type/enum closures this is NOT a general
  // `matchesSchemaType` descent into nested `properties`/`required` — that stays deliberately shallow,
  // fleet-wide, so ADR-0011's Postel tolerance arms (the `name` synonym, the bare-string arm, the cl.10
  // `{event}` arm) keep passing un-narrowed. It is one named key, checked only when the declaring PropDef
  // opts in — so it is CATALOG-scoped, not catalog-wide.
  it('(E7) Button.action:{functionCall:{...}} — the upstream client-side-execution Action arm — rejects loudly, not silently-dead', () => {
    const msgs = surface([{ id: 'root', component: 'Button', action: { functionCall: { name: 'openUrl', args: {} } } }])
    expect(validateA2ui(msgs, a2uiBasicCatalog)).toEqual({ valid: false, failures: [{ code: 'CATALOG', path: 'root.action' }] })
  })

  it('(E7 negative control) the SAME {functionCall} shape still VALIDATES on the default catalog — its Postel tolerance stays byte-identical (no `rejectFunctionCall` declared on `agent-ui`\'s Button.action)', () => {
    const msgs: A2uiServerMessage[] = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Button', action: { functionCall: { name: 'openUrl', args: {} } } }],
        },
      },
    ] as A2uiServerMessage[]
    expect(validateA2ui(msgs, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })
})

// GH #545 / multi-select-field.spec.md SPEC-R10 — the E6 drain. `ChoicePicker.variant`'s enum widened
// past `['mutuallyExclusive']` (ADR-0169's original E6 gate encoding) to also admit `'multipleSelection'`,
// routed by a NEW `VariantDispatch` factory arm to `ui-multi-select` rather than `ui-select`. The
// `mutuallyExclusive` arm's own conformance/render behavior is untouched (SPEC-R10 AC2 — proved in
// `factories.test.ts`'s regression describe block; this file re-proves it at the CATALOG-conformance
// layer, the same layer the old E6 rejection used to run at).
describe('a2ui-basic — SPEC-R10 (GH #545): the E6 drain — ChoicePicker.variant:"multipleSelection" now VALIDATES and renders via ui-multi-select', () => {
  it('(SPEC-R10 AC1) passes enum conformance — where it used to fail as E6', () => {
    const msgs = surface([{ id: 'root', component: 'ChoicePicker', variant: 'multipleSelection', options: [] }])
    expect(validateA2ui(msgs, a2uiBasicCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('(SPEC-R10 AC1) renders via the NEW ui-multi-select factory arm, resolved off the real registered table', () => {
    const registry = new Registry()
    registry.register(a2uiBasicCatalog, a2uiBasicFactories)
    const slot = registry.get('a2ui-basic')?.factories.ChoicePicker
    const node: A2uiComponent = { id: 'root', component: 'ChoicePicker', variant: 'multipleSelection', options: [] }
    expect(slot === undefined ? undefined : resolveFactory(slot, node)?.tag).toBe('ui-multi-select')
  })

  it('(SPEC-R10 AC2 — regression) the existing mutuallyExclusive arm still resolves to ui-select, unchanged', () => {
    const registry = new Registry()
    registry.register(a2uiBasicCatalog, a2uiBasicFactories)
    const slot = registry.get('a2ui-basic')?.factories.ChoicePicker
    const node: A2uiComponent = { id: 'root', component: 'ChoicePicker', variant: 'mutuallyExclusive', options: [] }
    expect(slot === undefined ? undefined : resolveFactory(slot, node)?.tag).toBe('ui-select')
  })
})
