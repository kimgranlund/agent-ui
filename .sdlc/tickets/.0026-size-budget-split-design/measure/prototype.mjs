// Prototype of the real change shape, measured, with NO repo edit. renderer.ts is patched in a `load` hook: it drops its
// catalog imports and register/compose calls and instead holds (a) a records table with the eager MANIFEST (ids, the
// `functions` defs the callFunction scan needs, the submit-gate tags) and (b) a memoized ensureCatalog(). The body
// modules (catalog docs, factories, function impls, persona packages) stay byte-identical and sit behind import().
// Rows: P0 removal only (ceiling) · PB default eager, a2ui-basic + personas lazy · PC every built-in body lazy.
// NOT included: the renderer-side queue trigger (createSurface/updateComponents gate), estimated in design.md.
// Run: node measure/prototype.mjs
import { measureApp, bundle, split, gz, A2UI, ROOT, HERE, APP_ENTRY } from './lib.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const P = `${HERE}/proto`
mkdirSync(P, { recursive: true })
const doc = (rel) => JSON.parse(readFileSync(`${A2UI}/catalog/${rel}/catalog.json`, 'utf8'))
const CANON = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'

writeFileSync(`${P}/default-body.ts`, `// lazy body of the default catalog (what \`load()\` resolves)
export { defaultCatalog as catalog } from '${A2UI}/catalog/default/index.ts'
export { defaultFactories as factories } from '${A2UI}/catalog/default/factories.ts'
export { builtinControls as controls } from '${A2UI}/catalog/controls.ts'
`)
writeFileSync(`${P}/basic-body.ts`, `// lazy body of a2ui-basic (both ids share it; the canonical-URI alias picks \`canonical\`)
export { a2uiBasicCatalog as catalog, a2uiBasicCatalogCanonical as canonical } from '${A2UI}/catalog/a2ui-basic/index.ts'
export { a2uiBasicFactories as factories } from '${A2UI}/catalog/a2ui-basic/factories.ts'
export { a2uiBasicFunctions as functions } from '${A2UI}/catalog/a2ui-basic/functions.ts'
export { builtinControls as controls } from '${A2UI}/catalog/controls.ts'
`)
writeFileSync(`${P}/persona-body.ts`, `// lazy body of the shipped persona packages + the compose step
export { composePersonaCatalogs } from '${A2UI}/catalog/compose.ts'
export { SHIPPED_PERSONA_CATALOGS } from '${A2UI}/catalog/personas/index.ts'
`)

const records = (lazyDefault) => `// records table: eager manifest + memoized ensure (prototype of catalog/records.ts + catalog/loader.ts)
const DEFAULT_FN = ${JSON.stringify(doc('default').functions)}
const BASIC_FN = ${JSON.stringify(doc('a2ui-basic').functions)}
const PERSONAS = ['fixture-demo', 'concierge', 'croupier']
const TARGETS = ['agent-ui', 'a2ui-basic']
const loaded = new Map()
const known = new Map()
const rec = (id, fn, load) => known.set(id, { id, fn, load })
${lazyDefault ? `rec('agent-ui', DEFAULT_FN, () => import('${P}/default-body.ts'))` : ''}
rec('a2ui-basic', BASIC_FN, () => import('${P}/basic-body.ts'))
rec('${CANON}', BASIC_FN, () => import('${P}/basic-body.ts').then((m) => ({ ...m, catalog: m.canonical })))
for (const p of PERSONAS) for (const t of TARGETS) rec(t + '--' + p, {}, null)
export const knownCatalogIds = () => [...known.keys()]
export const submitGateTags = ['ui-form-provider']
export const manifestFunctions = (id) => known.get(id)?.fn
export function ensureCatalog(registry, id) {
  let p = loaded.get(id)
  if (p) return p
  const r = known.get(id)
  if (!r) return Promise.reject(new Error('unknown catalog ' + id))
  p = r.load
    ? r.load().then((b) => registry.register(b.catalog, b.factories, b.functions, b.controls))
    : Promise.all(TARGETS.map((t) => ensureCatalog(registry, t)))
        .then(() => import('${P}/persona-body.ts'))
        .then((m) => m.composePersonaCatalogs(registry, m.SHIPPED_PERSONA_CATALOGS))
  loaded.set(id, p)
  return p
}
`
writeFileSync(`${P}/records-c.ts`, records(true))
writeFileSync(`${P}/records-b.ts`, records(false))

const src = readFileSync(`${A2UI}/renderer/renderer.ts`, 'utf8')
const IMPORTS_ALL = /^import .*from '\.\.\/catalog\/(default\/index|default\/factories|a2ui-basic\/index|a2ui-basic\/factories|a2ui-basic\/functions|compose|personas\/index|controls)\.ts'.*$/gm
const IMPORTS_B = /^import .*from '\.\.\/catalog\/(a2ui-basic\/index|a2ui-basic\/factories|a2ui-basic\/functions|compose|personas\/index)\.ts'.*$/gm
const CALLS_ALL = /^\s*(this\.#registry\.register\((defaultCatalog|a2uiBasicCatalog|a2uiBasicCatalogCanonical),.*|composePersonaCatalogs\(this\.#registry, SHIPPED_PERSONA_CATALOGS\))\s*$/gm
const CALLS_B = /^\s*(this\.#registry\.register\((a2uiBasicCatalog|a2uiBasicCatalogCanonical),.*|composePersonaCatalogs\(this\.#registry, SHIPPED_PERSONA_CATALOGS\))\s*$/gm
const KEEP = (file) => `import { knownCatalogIds, submitGateTags, manifestFunctions, ensureCatalog } from '${P}/${file}'\n(globalThis as Record<string, unknown>).__keep = [knownCatalogIds, submitGateTags, manifestFunctions, ensureCatalog]\n`
const n = (re) => (src.match(re) ?? []).length
console.log(`patched renderer.ts: PC drops ${n(IMPORTS_ALL)} imports + ${n(CALLS_ALL)} calls; PB drops ${n(IMPORTS_B)} imports + ${n(CALLS_B)} calls`)
const patchPC = KEEP('records-c.ts') + src.replace(IMPORTS_ALL, '').replace(CALLS_ALL, '')
const patchPB = KEEP('records-b.ts') + src.replace(IMPORTS_B, '').replace(CALLS_B, '')
const patchP0 = src.replace(IMPORTS_ALL, '').replace(CALLS_ALL, '')

const base = await measureApp({})
console.log(`baseline marginal ${base.marginal} B gz (lazy, informational: ${base.lazyGz})`)
const row = async (name, stubs) => {
  const r = await measureApp(stubs)
  console.log(`${name.padEnd(86)} marginal ${r.marginal}  delta ${r.marginal - base.marginal}  (lazy gz ${r.lazyGz}, delta ${r.lazyGz - base.lazyGz})`)
  return r
}
await row('P0 renderer drops catalog imports+registrations; bodies, barrel re-exports intact', { '/renderer/renderer.ts': patchP0 })
await row('PB default eager+sync; a2ui-basic (2 ids) + personas behind records+manifest+ensure', { '/renderer/renderer.ts': patchPB })
await row('PC every built-in body behind records+manifest+ensure', { '/renderer/renderer.ts': patchPC })

// Which catalog modules are still eager after P0 (proves the a2ui `.` barrel's `export *` re-exports tree-shake)?
const p0 = await measureApp({ '/renderer/renderer.ts': patchP0 })
const left = new Set()
for (const c of p0.eagerChunks) for (const [id, m] of Object.entries(c.modules)) if (/a2ui\/src\/catalog\//.test(id) && m.renderedLength > 0) left.add(id.split('a2ui/src/')[1])
console.log(`P0: catalog modules still in the eager closure: ${[...left].join(', ')}`)

// Lazy chunk layout for PC, as Rolldown cuts it.
const { lazyChunks } = split(await bundle(APP_ENTRY, { '/renderer/renderer.ts': patchPC }))
console.log('PC lazy chunks that hold catalog modules (standalone gz):')
for (const c of lazyChunks) {
  const mods = Object.keys(c.modules).filter((m) => /a2ui\/src\/catalog\/|proto\//.test(m)).map((m) => m.split('a2ui/src/')[1] ?? m.split('proto/')[1])
  if (mods.length) console.log(`  ${c.fileName.padEnd(30)} gz ${String(gz(c.code)).padStart(5)}  ${mods.slice(0, 5).join(', ')}`)
}

// 5.5: the lazy agent-admin arm statically imports SHIPPED_PERSONA_CATALOGS from the a2ui barrel. Confirm the persona
// modules sit in their own shared chunk (imported by it), not inside the agent-admin chunk, before and after.
const adminOf = async (stubs) => {
  const { lazyChunks: lazy } = split(await bundle(APP_ENTRY, stubs))
  const admin = lazy.find((c) => c.fileName.startsWith('agent-admin-'))
  const holdsPersona = Object.keys(admin.modules).some((m) => /catalog\/personas\/(index|concierge\/index|croupier\/index)/.test(m) && admin.modules[m].renderedLength > 0)
  const personaChunk = lazy.find((c) => c.fileName !== admin.fileName && Object.keys(c.modules).some((m) => /catalog\/personas\/index/.test(m)))
  return `agent-admin chunk gz ${gz(admin.code)}, holds persona package modules itself: ${holdsPersona}, imports the persona chunk: ${personaChunk ? admin.imports.includes(personaChunk.fileName) : 'n/a (no separate persona chunk)'}`
}
console.log('baseline  ' + (await adminOf({})))
console.log('PC        ' + (await adminOf({ '/renderer/renderer.ts': patchPC })))
