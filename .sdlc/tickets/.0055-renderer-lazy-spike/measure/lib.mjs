// Harness for T-0055 (renderer-lazy spike), copied from the T-0026/T-0037 harness unchanged except this header. Mirrors scripts/measure-size.mjs's `@agent-ui/app .` leg exactly: Rolldown, ESM,
// minified, the EAGER set = entry chunks plus their transitive static `imports`, gzip level 9, marginal = eager gz
// minus the gz of the `@agent-ui/components` `.` barrel. The one addition is `stubs`: a map of path-suffix to
// replacement source, applied in a `load` hook, so an import can be removed or replaced WITHOUT editing the repo.
// Independence proof: `measureApp({})` returns the same 57878 B gz that `npm run size` prints for the app row on main@39921d40.
import { createRequire } from 'node:module'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url)).replace(/\/$/, '')
export const A2UI = `${ROOT}/packages/agent-ui/a2ui/src`
export const HERE = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')
const require = createRequire(`${ROOT}/package.json`)
export const { rolldown } = await import(require.resolve('rolldown'))

// Same role as scripts/measure-size.mjs's appCssQuerySuffixPlugin: `?url` / `?raw` specifiers have no Vite pipeline here.
const APP_QUERY_RE = /^(.*)\?(url|raw)$/
const appCssQuerySuffixPlugin = {
  name: 'app-css-query-suffix-stub',
  resolveId(source, importer) {
    const m = source.match(APP_QUERY_RE)
    if (!m) return null
    const [, bare, kind] = m
    let target
    if (bare.startsWith('.')) target = resolvePath(dirname(importer), bare)
    else if (bare.startsWith('@agent-ui/')) {
      const [, pkgName, ...rest] = bare.split('/')
      const pkgDir = `${ROOT}/packages/agent-ui/${pkgName}`
      target = `${pkgDir}/${JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8')).exports[`./${rest.join('/')}`].slice(2)}`
    } else target = require.resolve(bare)
    return { id: `${target}?${kind}`, moduleSideEffects: false }
  },
  load(id) {
    const m = id.match(APP_QUERY_RE)
    if (!m) return null
    const [, filePath, kind] = m
    return kind === 'raw'
      ? `export default ${JSON.stringify(readFileSync(filePath, 'utf8'))}`
      : `export default ${JSON.stringify(`/${filePath.split('/').pop()}`)}`
  },
}
export const appCssPlugin = appCssQuerySuffixPlugin

const stubPlugin = (stubs) => ({
  name: 'stubs',
  load(id) {
    for (const [suffix, src] of Object.entries(stubs)) if (id.endsWith(suffix)) return src
    return null
  },
})

export const gz = (s) => gzipSync(s, { level: 9 }).length
export const EMPTY_CAT = (id) => JSON.stringify({ catalogId: id, components: {} })

export async function bundle(input, stubs = {}, extraPlugins = []) {
  const b = await rolldown({ input, plugins: [appCssQuerySuffixPlugin, stubPlugin(stubs), ...extraPlugins], onLog() {} })
  const { output } = await b.generate({ format: 'esm', minify: true })
  await b.close()
  return output.filter((c) => c.type === 'chunk')
}

export function split(chunks) {
  const byFile = new Map(chunks.map((c) => [c.fileName, c]))
  const set = new Set(chunks.filter((c) => c.isEntry).map((c) => c.fileName))
  for (const n of set) for (const d of byFile.get(n)?.imports ?? []) if (byFile.has(d)) set.add(d)
  return { eagerChunks: chunks.filter((c) => set.has(c.fileName)), lazyChunks: chunks.filter((c) => !set.has(c.fileName)) }
}

export const APP_ENTRY = `${ROOT}/packages/agent-ui/app/src/index.ts`

export async function measureApp(stubs = {}) {
  const foundationGz = gz((await bundle(`${ROOT}/packages/agent-ui/components/src/index.ts`)).map((c) => c.code).join(''))
  const chunks = await bundle(APP_ENTRY, stubs)
  const { eagerChunks, lazyChunks } = split(chunks)
  const code = eagerChunks.map((c) => c.code).join('')
  return {
    foundationGz,
    solo: gz(code),
    marginal: gz(code) - foundationGz,
    lazyGz: lazyChunks.length ? gz(lazyChunks.map((c) => c.code).join('')) : 0,
    eagerChunks,
    lazyChunks,
  }
}
