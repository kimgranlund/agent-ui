// What the EAGER closure of the app barrel holds, by package and folder, rendered (minified, pre-gz) bytes, for the baseline and for Dd.
// Context for "is Option D the best remaining lever": the share it removes against everything else that stays.
import { bundle, split, APP_ENTRY, HERE, ROOT } from './lib.mjs'
import { readFileSync } from 'node:fs'
const host = readFileSync(`${ROOT}/packages/agent-ui/app/src/controls/surface-host/surface-host.ts`, 'utf8')
const dd = host
  .replace("import { createRenderer } from '@agent-ui/a2ui'\n", `import { createLazyRenderer } from '${HERE}/proto/lazy-renderer.dd.ts'\n`)
  .replace('this.#host = createRenderer()', 'this.#host = createLazyRenderer()')
const tally = async (label, stubs) => {
  const { eagerChunks } = split(await bundle(APP_ENTRY, stubs))
  const by = new Map()
  let total = 0
  for (const c of eagerChunks)
    for (const [id, m] of Object.entries(c.modules)) {
      if (m.renderedLength === 0) continue
      const mm = id.match(/packages\/agent-ui\/([^/]+)\/src\/([^/]+)(?:\/([^/]+))?/)
      const key = mm ? (mm[2] === 'controls' || mm[2] === 'reactive' || mm[2] === 'dom' || mm[2] === 'traits' ? `${mm[1]}/${mm[2]}` : `${mm[1]}/${mm[2]}`) : id.includes('node_modules') ? 'node_modules' : 'other'
      by.set(key, (by.get(key) ?? 0) + m.renderedLength)
      total += m.renderedLength
    }
  console.log(`\n${label}: eager rendered ${total} B`)
  for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${k.padEnd(34)} ${String(v).padStart(7)}  ${(100 * v / total).toFixed(1)}%`)
  return by
}
await tally('baseline', {})
await tally('Dd', { '/surface-host/surface-host.ts': dd })
