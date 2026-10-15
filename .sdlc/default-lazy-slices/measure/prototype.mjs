// T-0037 prototype: option C ("default catalog lazy too") measured on MERGED T-0029 code (main@f5b38eea), with NO repo edit.
// Two in-memory patches, applied in a Rolldown `load` hook:
//   renderer/renderer.ts  drops its three default-catalog imports and the eager `register(defaultCatalog, ...)` line
//                         (the default then arrives through the existing `registerLazy` loop over BUILTIN_CATALOG_RECORDS)
//   catalog/records.ts    drops its static imports of default/index, default/factories and controls.ts; gains a literal
//                         DEFAULT_FUNCTIONS manifest, a `loadDefault` thunk and a default record; `loadA2uiBasic` takes its
//                         `controls` from the lazy body instead of a static import
// Bodies are byte-identical; they sit behind proto/*.ts re-export modules (the shape the real `default/body.ts` would have).
// Rows: E0 baseline (must print 67203, the number `npm run size` prints) · P0 ceiling (default removed, nothing added back)
//       · PC the real change shape. Not included: surface-host buffering code (design.md section 6), estimated there.
// proto/*.ts are regenerated on every run and embed this worktree's absolute paths (like the T-0026 record did).
// Run from the repo root: node .sdlc/default-lazy-slices/measure/prototype.mjs
import { measureApp, bundle, split, gz, A2UI, ROOT, HERE, APP_ENTRY } from './lib.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { patchRenderer, patchRecords, ceilingOf, patchLoaderWarm, patchRegistryWarm } from './patches.mjs'

const P = `${HERE}/proto`
mkdirSync(P, { recursive: true })
const sha = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
console.log(`tree ${sha}`)

writeFileSync(`${P}/default-body.ts`, `// prototype of catalog/default/body.ts: the default catalog's lazy body (what its record's \`load()\` resolves)
export { defaultCatalog } from '${A2UI}/catalog/default/index.ts'
export { defaultFactories } from '${A2UI}/catalog/default/factories.ts'
export { builtinControls as controls } from '${A2UI}/catalog/controls.ts'
`)
writeFileSync(`${P}/basic-body.ts`, `// prototype of a2ui-basic/body.ts after the flip: the same re-exports plus the control registry, so records.ts imports none
export { a2uiBasicCatalog, a2uiBasicCatalogCanonical, a2uiBasicFactories, a2uiBasicFunctions } from '${A2UI}/catalog/a2ui-basic/body.ts'
export { builtinControls as controls } from '${A2UI}/catalog/controls.ts'
`)

const renderer = patchRenderer(readFileSync(`${A2UI}/renderer/renderer.ts`, 'utf8'))
const defaultFunctions = JSON.parse(readFileSync(`${A2UI}/catalog/default/catalog.json`, 'utf8')).functions
const records = patchRecords(readFileSync(`${A2UI}/catalog/records.ts`, 'utf8'), defaultFunctions, {
  defaultBody: `${P}/default-body.ts`,
  basicBody: `${P}/basic-body.ts`,
})
const loaderWarm = patchLoaderWarm(readFileSync(`${A2UI}/catalog/loader.ts`, 'utf8'))
const registryWarm = patchRegistryWarm(readFileSync(`${A2UI}/catalog/registry.ts`, 'utf8'))
const ceiling = ceilingOf(records) // P0: the default is gone and nothing replaces it

const base = await measureApp({})
console.log(`E0 baseline marginal ${base.marginal} B gz (foundation ${base.foundationGz}, solo ${base.solo})`)
if (base.marginal !== 67203) throw new Error(`harness disagrees with npm run size: ${base.marginal} != 67203`)

const row = async (name, stubs) => {
  const r = await measureApp(stubs)
  console.log(`${name.padEnd(78)} marginal ${String(r.marginal).padStart(6)}  delta ${String(r.marginal - base.marginal).padStart(7)}`)
  return r
}
await row('P0 default removed, nothing added back (ceiling, not buildable)', { '/renderer/renderer.ts': renderer, '/catalog/records.ts': ceiling })
const pc = await row('PC default behind a record + manifest + lazy body (the real change shape)', { '/renderer/renderer.ts': renderer, '/catalog/records.ts': records })

await row('PCW PC plus warm-memo sync registration (loader.ts + registry.ts, ~10 lines)', {
  '/renderer/renderer.ts': renderer,
  '/catalog/records.ts': records,
  '/catalog/loader.ts': loaderWarm,
  '/catalog/registry.ts': registryWarm,
})

// Which catalog modules are still in the eager closure after PC? The bundle-gate's subject.
const eagerMods = (r) => {
  const left = new Map()
  for (const c of r.eagerChunks) for (const [id, m] of Object.entries(c.modules)) if (/a2ui\/src\/catalog\//.test(id) && m.renderedLength > 0) left.set(id.split('a2ui/src/')[1], m.renderedLength)
  return left
}
console.log(`baseline eager catalog modules: ${[...eagerMods(base).keys()].join(', ')}`)
console.log(`PC       eager catalog modules: ${[...eagerMods(pc).keys()].join(', ')}`)

// Lazy chunk layout for PC and for the baseline: every chunk that holds a catalog module, standalone gz.
const layout = async (label, stubs) => {
  const { lazyChunks } = split(await bundle(APP_ENTRY, stubs))
  console.log(`${label} lazy chunks that hold catalog modules (standalone gz):`)
  let total = 0
  for (const c of lazyChunks) {
    const mods = Object.entries(c.modules).filter(([m, v]) => /a2ui\/src\/catalog\/|proto\//.test(m) && v.renderedLength > 0).map(([m]) => m.split('a2ui/src/')[1] ?? m.split('proto/')[1])
    if (mods.length === 0) continue
    const g = gz(c.code)
    total += g
    console.log(`  ${c.fileName.padEnd(34)} gz ${String(g).padStart(5)}  imports [${c.imports.join(' ')}]  holds ${mods.length}: ${mods.slice(0, 6).join(', ')}${mods.length > 6 ? ', ...' : ''}`)
  }
  console.log(`  sum of standalone gz of those chunks: ${total}`)
  return lazyChunks
}
await layout('baseline', {})
const pcLazy = await layout('PC', { '/renderer/renderer.ts': renderer, '/catalog/records.ts': records })

// The lazy agent-admin arm imports SHIPPED_PERSONA_CATALOGS from the barrel; confirm PC leaves it unchanged.
const adminOf = async (stubs) => {
  const { lazyChunks } = split(await bundle(APP_ENTRY, stubs))
  const admin = lazyChunks.find((c) => c.fileName.startsWith('agent-admin-'))
  const holdsDefault = Object.entries(admin.modules).some(([m, v]) => /catalog\/(default\/(index|factories)|controls|registry\.gen)/.test(m) && v.renderedLength > 0)
  return `agent-admin chunk gz ${gz(admin.code)}, holds default-catalog/control-registry modules itself: ${holdsDefault}`
}
console.log('baseline  ' + (await adminOf({})))
console.log('PC        ' + (await adminOf({ '/renderer/renderer.ts': renderer, '/catalog/records.ts': records })))
void pcLazy
