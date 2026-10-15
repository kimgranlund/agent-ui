// The two source patches that make the default catalog a lazy record, as pure string transforms. Each one throws unless
// its pattern matches exactly once, so a drifted tree fails loud instead of measuring something else.
// Used by prototype.mjs (in-memory, bundle size) and scratch-apply.mjs (written into a scratch clone, test churn).

const must = (src, re, to, what) => {
  const hits = src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))
  if (hits === null || hits.length !== 1) throw new Error(`patch "${what}" matched ${hits?.length ?? 0} times, expected exactly 1`)
  return src.replace(re, to)
}

/** renderer.ts: drop the three default-catalog imports and the eager register; the `registerLazy` loop takes the default. */
export function patchRenderer(src) {
  let out = src
  out = must(out, /^import \{ defaultCatalog \} from '\.\.\/catalog\/default\/index\.ts'\n/m, '', 'renderer: defaultCatalog import')
  out = must(out, /^import \{ defaultFactories \} from '\.\.\/catalog\/default\/factories\.ts'\n/m, '', 'renderer: defaultFactories import')
  out = must(out, /^import \{ builtinControls \} from '\.\.\/catalog\/controls\.ts'\n/m, '', 'renderer: builtinControls import')
  out = must(out, /^ *this\.#registry\.register\(defaultCatalog, defaultFactories, undefined, builtinControls\)\n/m, '', 'renderer: eager default register')
  return out
}

/**
 * records.ts: no static default/controls imports; a literal DEFAULT_FUNCTIONS manifest; `loadDefault`; the default record;
 * a2ui-basic takes `controls` from its lazy body. `defaultBody` / `basicBody` are the specifiers of the two body modules.
 */
export function patchRecords(src, defaultFunctions, { defaultBody, basicBody }) {
  let out = src
  out = must(out, /^import \{ builtinControls \} from '\.\/controls\.ts'\n/m, '', 'records: builtinControls import')
  out = must(out, /^import \{ defaultCatalog \} from '\.\/default\/index\.ts'\n/m, '', 'records: defaultCatalog import')
  out = must(out, /^import \{ defaultFactories \} from '\.\/default\/factories\.ts'\n/m, '', 'records: defaultFactories import')
  out = must(
    out,
    /^const A2UI_BASIC_FUNCTIONS:/m,
    `const DEFAULT_FUNCTIONS = ${JSON.stringify(defaultFunctions)} as unknown as Readonly<Record<string, FunctionDef>>\n\nconst A2UI_BASIC_FUNCTIONS:`,
    'records: DEFAULT_FUNCTIONS manifest',
  )
  out = must(
    out,
    /import\('\.\/a2ui-basic\/body\.ts'\)\.then\(\(m\) => \(\{\n( *)catalog: canonical \? m\.a2uiBasicCatalogCanonical : m\.a2uiBasicCatalog,\n *factories: m\.a2uiBasicFactories,\n *functions: m\.a2uiBasicFunctions,\n *controls: builtinControls,/,
    `import('${basicBody}').then((m) => ({\n$1catalog: canonical ? m.a2uiBasicCatalogCanonical : m.a2uiBasicCatalog,\n$1factories: m.a2uiBasicFactories,\n$1functions: m.a2uiBasicFunctions,\n$1controls: m.controls,`,
    'records: loadA2uiBasic controls from the lazy body',
  )
  out = must(
    out,
    /^\/\*\* The two composable bases/m,
    `const loadDefault = (): Promise<CatalogEntry> =>\n  import('${defaultBody}').then((m) => ({ catalog: m.defaultCatalog, factories: m.defaultFactories, controls: m.controls }))\n\n/** The two composable bases`,
    'records: loadDefault thunk',
  )
  out = must(
    out,
    /functions: defaultCatalog\.functions,\n( *)submitGate: \['ui-form-provider'\],\n *entry: \(\): Promise<CatalogEntry> => Promise\.resolve\(\{ catalog: defaultCatalog, factories: defaultFactories, controls: builtinControls \}\),/,
    `functions: DEFAULT_FUNCTIONS,\n$1submitGate: ['ui-form-provider'],\n$1entry: loadDefault,`,
    'records: agent-ui base entry',
  )
  out = must(
    out,
    /^export const BUILTIN_CATALOG_RECORDS: readonly LazyCatalogRecord\[\] = \[\n/m,
    `export const BUILTIN_CATALOG_RECORDS: readonly LazyCatalogRecord[] = [\n  { id: 'agent-ui', functions: DEFAULT_FUNCTIONS, submitGate: ['ui-form-provider'], load: loadDefault },\n`,
    'records: default record',
  )
  return out
}

/** P0 ceiling: the default's load rejects, so nothing of it is reachable. */
export function ceilingOf(recordsPatched) {
  return must(recordsPatched, /^const loadDefault = [\s\S]*?\n\n/m, `const loadDefault = (): Promise<CatalogEntry> => Promise.reject(new Error('stub'))\n\n`, 'ceiling: loadDefault')
}

/** Warm-memo, loader half: remember a resolved body so a later registry can register it without an async hop. */
export function patchLoaderWarm(src) {
  let out = src
  out = must(
    out,
    /^const bodies = new WeakMap<LazyCatalogRecord, Promise<CatalogBody>>\(\)\n/m,
    `const bodies = new WeakMap<LazyCatalogRecord, Promise<CatalogBody>>()\nconst settled = new WeakMap<LazyCatalogRecord, CatalogBody>()\n\n/** The body of \`record\` if a load already resolved, else undefined (the warm path: no async hop). */\nexport const loadedCatalogBody = (record: LazyCatalogRecord): CatalogBody | undefined => settled.get(record)\n`,
    'loader: settled map',
  )
  out = must(out, /^  bodies\.set\(record, loading\)\n/m, `  bodies.set(record, loading)\n  loading.then((body) => void settled.set(record, body), () => {})\n`, 'loader: remember resolved body')
  return out
}

/** Warm-memo, registry half: `registerLazy` stores an already-loaded body at once. */
export function patchRegistryWarm(src) {
  let out = src
  out = must(out, /import \{ CatalogLoadError, loadCatalogBody, reasonOf \}/, 'import { CatalogLoadError, loadCatalogBody, loadedCatalogBody, reasonOf }', 'registry: import')
  out = must(
    out,
    /^    this\.#catalogs\.delete\(record\.id\)\n    this\.#records\.set\(record\.id, record\)\n/m,
    `    this.#catalogs.delete(record.id)\n    this.#records.set(record.id, record)\n    const warm = loadedCatalogBody(record)\n    if (warm !== undefined) this.#store(warm.catalog, warm.factories, warm.functions, warm.controls, false)\n`,
    'registry: register a warm body at once',
  )
  return out
}
