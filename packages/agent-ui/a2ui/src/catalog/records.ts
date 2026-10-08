// records.ts: the built-in lazy catalog records (ADR-0241 cl.1-2 and its Amendment, Option C). The renderer
// registers no catalog eagerly and records these by id: the default `agent-ui` catalog, a2ui-basic under its short id
// and its canonical-URI alias (ADR-0169 cl.13), and every shipped persona over each base it targets
// (`<base>--<persona>`, ADR-0172 cl.2).
// A record is the eager manifest (the id, a copy of the body's normalized `catalog.functions`, the tags of its
// submit-gate factories) plus `load`, a dynamic import of the body. An explicit list in the manner of
// `personas/index.ts`, with no generator: `records.test.ts` is the bijection gate that holds it equal to the
// shipped catalog folders, the persona pairings and each loaded body.
//
// Import rule: nothing here imports `default/*`, `controls.ts`, `a2ui-basic/*`, `personas/*` or `compose.ts`
// statically, or that body rides the eager bundle again; `app/src/catalog-lazy.bundle.test.ts` catches it. Each
// record is a module-level singleton because `loader.ts` memoizes a body by record identity, so every renderer
// shares one fetch.

import type { FunctionDef, JsonSchema } from './catalog.ts'
import type { CatalogEntry, LazyCatalogRecord } from './types.ts'

/** The upstream canonical URI a2ui-basic is also recorded under (`A2UI_BASIC_CANONICAL_URI`, held equal by the test). */
const A2UI_BASIC_CANONICAL_ID = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'

const S: JsonSchema = { type: 'string' }
const N: JsonSchema = { type: 'number' }
const B: JsonSchema = { type: 'boolean' }
const ANY: JsonSchema = {}
const fn = (args: Record<string, JsonSchema>, returns: JsonSchema): FunctionDef => ({ args, returns, callableFrom: 'clientOnly' })

/** The default catalog's `catalog.functions` as `loadCatalog` normalizes it. */
const DEFAULT_FUNCTIONS: Readonly<Record<string, FunctionDef>> = {
  required: fn({ value: { type: ['string', 'null'] } }, { type: 'object' }),
  email: fn({ value: S }, { type: 'object' }),
  regex: fn({ value: S, pattern: S }, { type: 'object' }),
  ping: { args: {}, returns: B, callableFrom: 'clientOrRemote' },
  formatCurrency: fn({ value: N, currency: S }, S),
}

/** a2ui-basic's `catalog.functions` as `loadCatalog` normalizes it (`callableFrom` defaulted). */
const A2UI_BASIC_FUNCTIONS: Readonly<Record<string, FunctionDef>> = {
  formatString: fn({ value: S }, S),
  required: fn({ value: ANY }, B),
  regex: fn({ value: S, pattern: S }, B),
  length: fn({ value: S, min: N, max: N }, B),
  numeric: fn({ value: ANY, min: N, max: N }, B),
  email: fn({ value: S }, B),
  formatNumber: fn({ value: N, decimals: N, grouping: B }, S),
  formatCurrency: fn({ value: N, currency: S, decimals: N, grouping: B }, S),
  formatDate: fn({ value: S, format: S }, S),
  pluralize: fn({ value: N, other: S, zero: S, one: S, two: S, few: S, many: S }, S),
  and: fn({ values: { type: 'array', items: B } }, B),
  or: fn({ values: { type: 'array', items: B } }, B),
  not: fn({ value: B }, B),
}

/** The a2ui-basic body under the short id or the canonical-URI alias; both share one chunk and one factory table. */
const loadA2uiBasic = (canonical: boolean) => (): Promise<CatalogEntry> =>
  import('./a2ui-basic/body.ts').then((m) => ({
    catalog: canonical ? m.a2uiBasicCatalogCanonical : m.a2uiBasicCatalog,
    factories: m.a2uiBasicFactories,
    functions: m.a2uiBasicFunctions,
    controls: m.controls,
  }))

/** The default body: its document, factory table and the built-in control loader, in one chunk. */
const loadDefault = (): Promise<CatalogEntry> =>
  import('./default/body.ts').then((m) => ({ catalog: m.defaultCatalog, factories: m.defaultFactories, controls: m.controls }))

/** The two composable bases (SPEC-N5): the manifest a derived record inherits and how to get the base entry. */
const BASES = {
  'agent-ui': { functions: DEFAULT_FUNCTIONS, submitGate: ['ui-form-provider'], entry: loadDefault },
  'a2ui-basic': { functions: A2UI_BASIC_FUNCTIONS, submitGate: [], entry: loadA2uiBasic(false) },
} as const

/** Each shipped persona: its id, the bases its `targetCatalogs` names, and its own submit-gate factory tags. */
const PERSONAS: readonly (readonly [string, readonly (keyof typeof BASES)[], readonly string[]])[] = [
  ['fixture-demo', ['agent-ui', 'a2ui-basic'], []],
  ['concierge', ['agent-ui', 'a2ui-basic'], ['ui-form-provider']],
  ['croupier', ['agent-ui', 'a2ui-basic'], []],
]

/** A derived record: the base's functions (a shipped fragment declares none), the union of both gate lists. */
function derivedRecord(baseId: keyof typeof BASES, personaId: string, submitGate: readonly string[]): LazyCatalogRecord {
  const base = BASES[baseId]
  return {
    id: `${baseId}--${personaId}`,
    functions: base.functions,
    submitGate: [...new Set([...base.submitGate, ...submitGate])],
    load: () => Promise.all([base.entry(), import('./personas/body.ts')]).then(([entry, m]) => m.shippedPersonaEntry(personaId, entry)),
  }
}

/** Every built-in catalog the renderer records rather than registers (ADR-0241 cl.2 and its Amendment). */
export const BUILTIN_CATALOG_RECORDS: readonly LazyCatalogRecord[] = [
  { id: 'agent-ui', functions: DEFAULT_FUNCTIONS, submitGate: ['ui-form-provider'], load: loadDefault },
  { id: 'a2ui-basic', functions: A2UI_BASIC_FUNCTIONS, submitGate: [], load: loadA2uiBasic(false) },
  { id: A2UI_BASIC_CANONICAL_ID, functions: A2UI_BASIC_FUNCTIONS, submitGate: [], load: loadA2uiBasic(true) },
  ...PERSONAS.flatMap(([personaId, targets, submitGate]) => targets.map((baseId) => derivedRecord(baseId, personaId, submitGate))),
]
