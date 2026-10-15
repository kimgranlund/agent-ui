// Applies the option-C flip to a SCRATCH CLONE (never to this worktree) so the test churn can be measured by running
// vitest there. Usage: node scratch-apply.mjs <clone-dir> [--warm]
//   (no flag)  the flip only: renderer.ts, records.ts, new default/body.ts, a2ui-basic/body.ts carries the control registry
//   --warm     also the warm-memo sync registration: loader.ts remembers a resolved body, Registry.registerLazy registers a
//              loaded body at once, so a renderer built after any load of the default is synchronous again
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { patchRenderer, patchRecords, patchLoaderWarm, patchRegistryWarm } from './patches.mjs'

const [cloneArg, ...flags] = process.argv.slice(2)
if (cloneArg === undefined) throw new Error('usage: scratch-apply.mjs <clone-dir> [--warm]')
const A2UI = `${resolve(cloneArg)}/packages/agent-ui/a2ui/src`
const rd = (rel) => readFileSync(`${A2UI}/${rel}`, 'utf8')
const wr = (rel, src) => writeFileSync(`${A2UI}/${rel}`, src)

wr('renderer/renderer.ts', patchRenderer(rd('renderer/renderer.ts')))
const defaultFunctions = JSON.parse(rd('catalog/default/catalog.json')).functions
wr('catalog/records.ts', patchRecords(rd('catalog/records.ts'), defaultFunctions, { defaultBody: './default/body.ts', basicBody: './a2ui-basic/body.ts' }))
wr(
  'catalog/default/body.ts',
  `export { defaultCatalog } from './index.ts'\nexport { defaultFactories } from './factories.ts'\nexport { builtinControls as controls } from '../controls.ts'\n`,
)
wr('catalog/a2ui-basic/body.ts', `${rd('catalog/a2ui-basic/body.ts')}export { builtinControls as controls } from '../controls.ts'\n`)

if (flags.includes('--warm')) {
  wr('catalog/loader.ts', patchLoaderWarm(rd('catalog/loader.ts')))
  wr('catalog/registry.ts', patchRegistryWarm(rd('catalog/registry.ts')))
}
console.log(`flip applied to ${A2UI}${flags.includes('--warm') ? ' (+ warm-memo)' : ''}`)
