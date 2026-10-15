// T-0055 prototype: Option D ("the whole renderer lazy at ui-surface-host") measured on current main (39921d40), with NO repo edit.
// One in-memory patch to surface-host.ts (its `createRenderer` import becomes `createLazyRenderer` from proto/lazy-renderer.<v>.ts), applied in a
// Rolldown `load` hook; variant Db also patches a2ui's renderer/index.ts to export the facade through the barrel.
// Rows: E0 baseline (must print 57878, the number `npm run size` prints) · S0 ceiling (surface-host loses the renderer, nothing added back)
//       · Da facade does import('@agent-ui/a2ui')           (no a2ui change; the whole barrel namespace is the lazy chunk)
//       · Dc facade does import('<renderer/index.ts>')      (stand-in for a new narrow subpath export, same module graph)
//       · Db a2ui-owned facade, exported through the barrel (`createLazyRenderer`), dynamic import of renderer.ts
// proto/lazy-renderer.*.ts are regenerated on every run and embed this worktree's absolute paths.
// Run from the repo root: node .sdlc/renderer-lazy-spike/measure/prototype.mjs
import { measureApp, bundle, split, gz, A2UI, ROOT, HERE, APP_ENTRY } from './lib.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const P = `${HERE}/proto`
mkdirSync(P, { recursive: true })
const sha = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
console.log(`tree ${sha}`)

const SURFACE_HOST = `${ROOT}/packages/agent-ui/app/src/controls/surface-host/surface-host.ts`
const template = readFileSync(`${P}/lazy-renderer.template.ts`, 'utf8')
const facade = (variant, specifier) => {
  const file = `${P}/lazy-renderer.${variant}.ts`
  writeFileSync(file, template.replace('import(__SPECIFIER__)', `import(${JSON.stringify(specifier)})`))
  return file
}
const files = {
  da: facade('da', '@agent-ui/a2ui'),
  dc: facade('dc', `${A2UI}/renderer/index.ts`),
  db: facade('db', `${A2UI}/renderer/renderer.ts`),
  dd: facade('dd', `${A2UI}/renderer/renderer.ts`),
}

const must = (src, re, to, what) => {
  const hits = src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))
  if (hits === null || hits.length !== 1) throw new Error(`patch "${what}" matched ${hits?.length ?? 0} times, expected exactly 1`)
  return src.replace(re, to)
}
const host = readFileSync(SURFACE_HOST, 'utf8')
const patchHost = (src, importLine) => {
  let out = must(src, /^import \{ createRenderer \} from '@agent-ui\/a2ui'\n/m, importLine + '\n', 'surface-host: createRenderer import')
  out = must(out, /this\.#host = createRenderer\(\)/, 'this.#host = createLazyRenderer()', 'surface-host: createRenderer call')
  return out
}
const hostCeiling = must(
  must(host, /^import \{ createRenderer \} from '@agent-ui\/a2ui'\n/m, 'const createRenderer = (): never => { throw new Error("stub") }\n', 'ceiling import'),
  /this\.#host = createRenderer\(\)/,
  'this.#host = createRenderer() as never',
  'ceiling call',
)
const rendererIndex = readFileSync(`${A2UI}/renderer/index.ts`, 'utf8')
const rendererIndexDb = rendererIndex + `export { createLazyRenderer } from '${files.db}'\n`

// Ambient warm (design.md 3.4): renderer.ts registers itself when it evaluates, so the facade learns of a renderer that arrived for another reason.
const rendererSrc = readFileSync(`${A2UI}/renderer/renderer.ts`, 'utf8')
const rendererAmbient = `import { provideRenderer } from '${files.db}'\n${rendererSrc}\nprovideRenderer(createRenderer)\n`

// Function-level variant: createRenderer() itself tells the facade (no module-level statement, so nothing relies on the package's sideEffects declaration).
const rendererFn = `import { provideRenderer } from '${files.db}'\n${must(
  rendererSrc,
  /export function createRenderer\(options: RendererOptions = \{\}\): RendererHost \{\n  return new Renderer\(options\)\n\}/,
  'export function createRenderer(options: RendererOptions = {}): RendererHost {\n  provideRenderer(createRenderer)\n  return new Renderer(options)\n}',
  'renderer: createRenderer body',
)}`

const base = await measureApp({})
console.log(`E0 baseline marginal ${base.marginal} B gz (foundation ${base.foundationGz}, solo ${base.solo}, lazy ${base.lazyGz})`)
if (base.marginal !== 57878) throw new Error(`harness disagrees with npm run size: ${base.marginal} != 57878`)

const row = async (name, stubs) => {
  const r = await measureApp(stubs)
  console.log(`${name.padEnd(86)} marginal ${String(r.marginal).padStart(6)}  delta ${String(r.marginal - base.marginal).padStart(7)}  lazy ${r.lazyGz}`)
  return r
}
const rows = {}
rows.s0 = await row('S0 surface-host loses the renderer, nothing added back (ceiling, not buildable)', { '/surface-host/surface-host.ts': hostCeiling })
rows.da = await row("Da facade, import('@agent-ui/a2ui') (whole barrel namespace)", {
  '/surface-host/surface-host.ts': patchHost(host, `import { createLazyRenderer } from '${files.da}'`),
})
rows.dc = await row("Dc facade, import('renderer/index.ts') (stand-in for a narrow subpath export)", {
  '/surface-host/surface-host.ts': patchHost(host, `import { createLazyRenderer } from '${files.dc}'`),
})
rows.db = await row('Db a2ui-owned facade exported through the barrel, import(renderer.ts)', {
  '/surface-host/surface-host.ts': patchHost(host, "import { createLazyRenderer } from '@agent-ui/a2ui'"),
  '/a2ui/src/renderer/index.ts': rendererIndexDb,
})
rows.dd = await row('Dd app-owned facade, import(renderer.ts) (a narrow subpath export that exposes createRenderer only)', {
  '/surface-host/surface-host.ts': patchHost(host, `import { createLazyRenderer } from '${files.dd}'`),
})
rows.dx = await row('Dx = Db plus ambient warm (renderer.ts calls provideRenderer when it evaluates)', {
  '/surface-host/surface-host.ts': patchHost(host, "import { createLazyRenderer } from '@agent-ui/a2ui'"),
  '/a2ui/src/renderer/index.ts': rendererIndexDb,
  '/a2ui/src/renderer/renderer.ts': rendererAmbient,
})
rows.dy = await row('Dy = Db plus function-level warm (createRenderer() calls provideRenderer; the recommended shape)', {
  '/surface-host/surface-host.ts': patchHost(host, "import { createLazyRenderer } from '@agent-ui/a2ui'"),
  '/a2ui/src/renderer/index.ts': rendererIndexDb,
  '/a2ui/src/renderer/renderer.ts': rendererFn,
})

// Which a2ui modules sit in the EAGER closure, by top-level folder. The renderer's leaving is the whole point.
const eagerA2ui = (r) => {
  const by = new Map()
  for (const c of r.eagerChunks)
    for (const [id, m] of Object.entries(c.modules)) {
      if (!/\/a2ui\/src\//.test(id) || m.renderedLength === 0) continue
      const rel = id.split('a2ui/src/')[1]
      const key = rel.split('/').slice(0, 2).join('/')
      by.set(key, (by.get(key) ?? 0) + m.renderedLength)
    }
  return by
}
const show = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')
console.log(`\nbaseline eager a2ui modules (rendered bytes by folder): ${show(eagerA2ui(base))}`)
for (const k of ['s0', 'da', 'dc', 'dd', 'db', 'dx', 'dy']) console.log(`${k.toUpperCase().padEnd(3)} eager a2ui modules: ${show(eagerA2ui(rows[k])) || '(none)'}`)

// Lazy chunk layout: every lazy chunk that holds an a2ui module (not the agent-admin arm), standalone gz. What a host fetches on first surface.
const layout = async (label, stubs) => {
  const { lazyChunks } = split(await bundle(APP_ENTRY, stubs))
  console.log(`\n${label}: lazy chunks that hold a2ui modules (standalone gz)`)
  let total = 0
  for (const c of lazyChunks) {
    const mods = Object.entries(c.modules).filter(([m, v]) => /\/a2ui\/src\/|\/proto\//.test(m) && v.renderedLength > 0)
    if (mods.length === 0) continue
    const inAdmin = Object.keys(c.modules).some((m) => /\/agent-admin\//.test(m))
    const names = mods.map(([m]) => m.split('a2ui/src/')[1] ?? m.split('proto/')[1])
    const g = gz(c.code)
    if (!inAdmin) total += g
    const folders = new Set(names.map((n) => n.split('/')[0] + '/' + (n.split('/')[1] ?? '')))
    console.log(`  ${c.fileName.padEnd(30)} ${String(g).padStart(6)} B gz  ${inAdmin ? '[also holds the agent-admin arm] ' : ''}${names.length} modules  [${[...folders].slice(0, 9).join(' ')}${folders.size > 9 ? ' ...' : ''}]`)
  }
  console.log(`  total outside the agent-admin arm: ${total} B gz`)
  return total
}
const lb = await layout('baseline', {})
const lc = await layout('Dc', { '/surface-host/surface-host.ts': patchHost(host, `import { createLazyRenderer } from '${files.dc}'`) })
const la = await layout('Da', { '/surface-host/surface-host.ts': patchHost(host, `import { createLazyRenderer } from '${files.da}'`) })
const lx = await layout('Dd', { '/surface-host/surface-host.ts': patchHost(host, `import { createLazyRenderer } from '${files.dd}'`) })
const ld = await layout('Db', {
  '/surface-host/surface-host.ts': patchHost(host, "import { createLazyRenderer } from '@agent-ui/a2ui'"),
  '/a2ui/src/renderer/index.ts': rendererIndexDb,
})
console.log(`\nlazy a2ui bytes outside the admin arm: Dd ${lx} (${lx - lb >= 0 ? '+' : ''}${lx - lb}); baseline ${lb}, Dc ${lc} (${lc - lb >= 0 ? '+' : ''}${lc - lb}), Da ${la} (${la - lb >= 0 ? '+' : ''}${la - lb}), Db ${ld} (${ld - lb >= 0 ? '+' : ''}${ld - lb})`)
console.log(`eager saved: Dc ${base.marginal - rows.dc.marginal}, Da ${base.marginal - rows.da.marginal}, Db ${base.marginal - rows.db.marginal}, ceiling ${base.marginal - rows.s0.marginal}`)
console.log(`net over the wire for a host that renders one default surface: Dc ${(lc - lb) - (base.marginal - rows.dc.marginal)} B gz, Da ${(la - lb) - (base.marginal - rows.da.marginal)} B gz`)
