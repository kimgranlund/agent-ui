// Leave-one-out stub measurements: each row removes a body module (replaced by an empty or minimal stand-in) from the
// app entry's eager closure and reports the change in marginal gz. Bodies are the catalog documents, the factory
// tables, the per-catalog function impls, the persona packages, compose.ts. Run: node measure/stubs.mjs
import { measureApp, EMPTY_CAT, A2UI } from './lib.mjs'
import { readFileSync } from 'node:fs'

const doc = (rel) => JSON.parse(readFileSync(`${A2UI}/catalog/${rel}/catalog.json`, 'utf8'))
const defDoc = doc('default')
const basicDoc = doc('a2ui-basic')
const fnOnly = (d) => JSON.stringify({ catalogId: d.catalogId, protocolVersion: d.protocolVersion, components: {}, functions: d.functions })

const J = {
  def: { '/catalog/default/catalog.json': EMPTY_CAT('agent-ui') },
  basic: { '/catalog/a2ui-basic/catalog.json': EMPTY_CAT('a2ui-basic') },
  pers: Object.fromEntries(['concierge', 'croupier', 'fixture-demo'].map((p) => [`/personas/${p}/catalog.json`, '{"components":{}}'])),
}
const F = {
  def: { '/catalog/default/factories.ts': 'export const defaultFactories={};export const textFactory={},cardFactory={},sliderFactory={},multiSelectFactory={},buttonFactory={}' },
  basic: { '/catalog/a2ui-basic/factories.ts': 'export const a2uiBasicFactories={}', '/catalog/a2ui-basic/functions.ts': 'export const a2uiBasicFunctions={}' },
  personas: { '/catalog/personas/index.ts': 'export const SHIPPED_PERSONA_CATALOGS=[]' },
  compose: { '/catalog/compose.ts': 'export const composePersonaCatalogs=()=>{},composeCatalog=0,loadCatalogFragment=0,composePersonaCatalogDocs=0,derivedCatalogId=0,derivedCatalogIdsFor=0,semanticChecksForCatalog=0,CatalogComposeError=0,CatalogComposeErrorCode=0' },
}
const cat = (...o) => Object.assign({}, ...o)

const base = (await measureApp({})).marginal
console.log(`E0 baseline (npm run size prints 71231 for this row): ${base}`)
const rows = [
  ['-- body-by-body leave-one-out --'],
  ['default catalog.json', cat(J.def)],
  ['a2ui-basic catalog.json', cat(J.basic)],
  ['3 persona fragments (catalog.json)', cat(J.pers)],
  ['all 5 catalog documents', cat(J.def, J.basic, J.pers)],
  ['default factories', cat(F.def)],
  ['a2ui-basic factories + functions', cat(F.basic)],
  ['persona packages (index.ts: fragments, factories, checks, manifests)', cat(F.personas)],
  ['compose.ts (with personas stubbed)', cat(F.personas, F.compose)],
  ['-- option scopes (bodies stubbed, nothing added back) --'],
  ['A  documents lazy, factories eager (all 5 docs)', cat(J.def, J.basic, J.pers)],
  ['B  non-default: a2ui-basic (doc+factories+fns) + personas + compose', cat(J.basic, F.basic, F.personas, F.compose)],
  ['B  as above, keep a2ui-basic `functions` defs as eager manifest', cat(F.basic, F.personas, F.compose, { '/catalog/a2ui-basic/catalog.json': fnOnly(basicDoc) })],
  ['C  every built-in body: default+basic+personas+compose', cat(J.def, J.basic, F.def, F.basic, F.personas, F.compose)],
  ['C  as above, keep default+basic `functions` defs as eager manifest', cat(F.def, F.basic, F.personas, F.compose, { '/catalog/default/catalog.json': fnOnly(defDoc), '/catalog/a2ui-basic/catalog.json': fnOnly(basicDoc) })],
  ['D  whole renderer lazy at surface-host (renderer.ts stubbed)', { '/renderer/renderer.ts': 'export function createRenderer(){}' }],
]
for (const [name, stubs] of rows) {
  if (!stubs) { console.log(name); continue }
  const r = await measureApp(stubs)
  console.log(`${name.padEnd(72)} marginal ${String(r.marginal).padStart(6)}  delta ${String(r.marginal - base).padStart(7)}`)
}
