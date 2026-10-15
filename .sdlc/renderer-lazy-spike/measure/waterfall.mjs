// First-surface request chain for the baseline and for Dd, from the Rolldown output of the app entry. A "hop" is a dynamic import the
// browser cannot start before the previous chunk has run; chunks a hop imports STATICALLY load in parallel with it (Vite emits
// modulepreload for them). Prints, per variant, the chain from the first ui-surface-host.connected() to the first painted default surface.
import { bundle, APP_ENTRY, HERE, ROOT, A2UI, gz } from './lib.mjs'
import { readFileSync } from 'node:fs'
const host = readFileSync(`${ROOT}/packages/agent-ui/app/src/controls/surface-host/surface-host.ts`, 'utf8')
const dd = host
  .replace("import { createRenderer } from '@agent-ui/a2ui'\n", `import { createLazyRenderer } from '${HERE}/proto/lazy-renderer.dd.ts'\n`)
  .replace('this.#host = createRenderer()', 'this.#host = createLazyRenderer()')
const show = async (label, stubs) => {
  const chunks = await bundle(APP_ENTRY, stubs)
  const by = new Map(chunks.map((c) => [c.fileName, c]))
  const holds = (c, re) => Object.keys(c.modules).some((m) => re.test(m) && c.modules[m].renderedLength > 0)
  const find = (re) => chunks.filter((c) => holds(c, re) && !holds(c, /\/agent-admin\//))
  const rend = find(/a2ui\/src\/renderer\/renderer\.ts$/)
  const body = find(/a2ui\/src\/catalog\/default\/(body|index)\.ts$/)
  const ctl = find(/a2ui\/src\/catalog\/controls\.ts$/)
  const desc = (c) => `${c.fileName} (${gz(c.code)} B gz${c.imports.length ? `; static deps: ${c.imports.map((i) => `${i} ${by.get(i) ? gz(by.get(i).code) : '?'}`).join(', ')}` : ''})`
  console.log(`\n${label}`)
  console.log(`  hop 0 (eager entry graph, already loaded with the page)`)
  console.log(`  renderer.ts lives in: ${rend.length ? rend.map(desc).join(' | ') : '(the eager graph)'}`)
  console.log(`  default catalog body lives in: ${body.map(desc).join(' | ')}`)
  console.log(`  built-in control registry lives in: ${ctl.map(desc).join(' | ')}`)
  const rc = rend[0]
  console.log(`  renderer chunk dynamic imports: ${rc ? rc.dynamicImports.join(', ') || '(none)' : 'n/a'}`)
  // Bytes a host fetches to paint its first default surface: the eager closure, then (Dd only) the renderer chunk, then the default body; each with its static closure.
  const closure = (start, into) => {
    for (const n of start) {
      if (into.has(n) || !by.has(n)) continue
      into.add(n)
      closure(by.get(n).imports, into)
    }
    return into
  }
  const set = closure(chunks.filter((c) => c.isEntry).map((c) => c.fileName), new Set())
  const eagerBytes = [...set].reduce((a, n) => a + gz(by.get(n).code), 0)
  if (rend.length && !set.has(rend[0].fileName)) closure([rend[0].fileName], set)
  closure(body.map((c) => c.fileName), set)
  const total = [...set].reduce((a, n) => a + gz(by.get(n).code), 0)
  console.log(`  eager closure ${eagerBytes} B gz (sum of standalone chunk gz, includes the components foundation); first default surface fetches ${total - eagerBytes} B gz more in ${(rend.length && !closure0(rend[0].fileName)) ? 2 : 1} dynamic hop(s) before the per-control chunks; whole first-surface set ${total} B gz in ${set.size} chunks`)
  function closure0(name) { return chunks.filter((c) => c.isEntry).some((e) => closureHas(e.fileName, name, new Set())) }
  function closureHas(from, name, seen) { if (from === name) return true; if (seen.has(from) || !by.has(from)) return false; seen.add(from); return by.get(from).imports.some((i) => closureHas(i, name, seen)) }
}
await show('baseline (renderer eager)', {})
await show('Dd (renderer lazy behind the facade)', { '/surface-host/surface-host.ts': dd })
