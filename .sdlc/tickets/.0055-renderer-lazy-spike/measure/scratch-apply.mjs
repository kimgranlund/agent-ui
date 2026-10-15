// Applies the Option D prototype to a SCRATCH CLONE (never to this worktree) so the test churn can be measured by running
// vitest there. Usage: node scratch-apply.mjs <clone-dir> [--ambient|--warm-fn]
//   (no flag)  the facade only: a2ui gains renderer/lazy-host.ts (exported through the renderer barrel), ui-surface-host
//              builds its host with createLazyRenderer() instead of createRenderer()
//   --warm-fn  also createRenderer() calls provideRenderer(createRenderer), so constructing any renderer tells the facade (V3, the recommended shape)
//   --ambient  also renderer.ts registers itself when it evaluates (`provideRenderer`), so a page or test that already has the
//              renderer module gets the real renderer synchronously, with no warm-up edit
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HERE } from './lib.mjs'

const [cloneArg, ...flags] = process.argv.slice(2)
if (cloneArg === undefined) throw new Error('usage: scratch-apply.mjs <clone-dir> [--ambient]')
const CLONE = resolve(cloneArg)
const A2UI = `${CLONE}/packages/agent-ui/a2ui/src`
const SH = `${CLONE}/packages/agent-ui/app/src/controls/surface-host/surface-host.ts`
const must = (src, re, to, what) => {
  const hits = src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))
  if (hits === null || hits.length !== 1) throw new Error(`patch "${what}" matched ${hits?.length ?? 0} times, expected exactly 1`)
  return src.replace(re, to)
}

const tpl = readFileSync(`${HERE}/proto/lazy-renderer.template.ts`, 'utf8')
let lazy = tpl.replace('import(__SPECIFIER__)', "import('./renderer.ts')")
lazy = must(lazy, /import type \{ RendererHost, RendererOptions, ClientMessageListener \} from '@agent-ui\/a2ui'/, "import type { RendererHost, RendererOptions, ClientMessageListener } from './renderer.ts'", 'facade type import')
writeFileSync(`${A2UI}/renderer/lazy-host.ts`, lazy)

const idx = readFileSync(`${A2UI}/renderer/index.ts`, 'utf8')
writeFileSync(`${A2UI}/renderer/index.ts`, idx + "export { createLazyRenderer } from './lazy-host.ts'\n")

let sh = readFileSync(SH, 'utf8')
sh = must(sh, /^import \{ createRenderer \} from '@agent-ui\/a2ui'\n/m, "import { createLazyRenderer } from '@agent-ui/a2ui'\n", 'surface-host import')
sh = must(sh, /this\.#host = createRenderer\(\)/, 'this.#host = createLazyRenderer()', 'surface-host call')
writeFileSync(SH, sh)

if (flags.includes('--warm-fn')) {
  let r = readFileSync(`${A2UI}/renderer/renderer.ts`, 'utf8')
  r = must(
    r,
    /export function createRenderer\(options: RendererOptions = \{\}\): RendererHost \{\n  return new Renderer\(options\)\n\}/,
    'export function createRenderer(options: RendererOptions = {}): RendererHost {\n  provideRenderer(createRenderer)\n  return new Renderer(options)\n}',
    'renderer createRenderer body',
  )
  writeFileSync(`${A2UI}/renderer/renderer.ts`, `import { provideRenderer } from './lazy-host.ts'\n${r}`)
}
if (flags.includes('--ambient')) {
  const r = readFileSync(`${A2UI}/renderer/renderer.ts`, 'utf8')
  writeFileSync(`${A2UI}/renderer/renderer.ts`, `import { provideRenderer } from './lazy-host.ts'\n${r}\nprovideRenderer(createRenderer)\n`)
}
console.log(`Option D prototype applied to ${CLONE}${flags.includes('--ambient') ? ' (+ ambient warm)' : flags.includes('--warm-fn') ? ' (+ function-level warm)' : ''}`)
