// worker-bundle.test.ts: the module-load gate for the production Worker (the "Deploy docs site" failure
// after #1824). Cloudflare executes a Worker's top level at upload time, so a throw there is a failed
// deploy (error 10021). The unit tests in this folder import `fs-shim.ts`/`route-guards.ts` directly and
// never evaluate the BUNDLE, so a bundler dropping `process-shim.ts` (the first import of `index.ts`, kept
// only for its side effect) passed every gate and failed only on the deploy: `"sideEffects"` in the a2ui
// package.json did not list it, esbuild honoured that field and removed the bare import, `mini-skills.ts`
// computed `ROOT = process.cwd()` as workerd's `/bundle`, and `fs-shim.ts` had no listing for that path.
//
// This test builds the Worker the way the deploy does (`wrangler deploy --dry-run`, wrangler.jsonc as is,
// the repo's own wrangler binary, nothing uploaded, no credentials) and evaluates the emitted entry in a
// child Node process whose `process.cwd()` returns `/bundle`, the value workerd's `nodejs_compat` gives.
// The child is a subprocess on purpose: `process-shim.ts` overrides `process.cwd()` globally and must never
// leak into this shared test process (see vitest.config.ts' `tools` project note).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../../../../..', import.meta.url))

// Wrangler's Text module rule emits each `.md`/`.jsonl` as a sibling file the bundle imports by name;
// workerd loads those as text, Node cannot, so this loader hook serves them the same way. The other
// workerd-side behaviour modelled is `process.cwd()` returning `/bundle` (process-shim.ts documents it).
const RUNNER = `
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
const hooks = \`
import { readFile } from 'node:fs/promises'
export async function load(url, ctx, next) {
  if (/\\\\.(md|jsonl)$/.test(url)) return { format: 'module', shortCircuit: true, source: 'export default ' + JSON.stringify(await readFile(new URL(url), 'utf8')) }
  return next(url, ctx)
}\`
register('data:text/javascript,' + encodeURIComponent(hooks))
process.cwd = () => '/bundle'
try {
  const mod = await import(pathToFileURL(process.argv[2]).href)
  if (typeof mod.default?.fetch !== 'function') throw new Error('bundle loaded but has no default fetch handler')
  console.log('WORKER_LOADED')
} catch (e) {
  console.log('WORKER_LOAD_FAILED: ' + (e instanceof Error ? e.message : String(e)))
  process.exitCode = 1
}
`

describe('the bundled Worker evaluates its top level (the deploy-time module load)', () => {
  let scratch: string
  let bundle: string
  let bundleSource: string

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'a2ui-worker-bundle-'))
    const outdir = join(scratch, 'out')
    const assets = join(scratch, 'assets') // wrangler.jsonc's `assets.directory` is `./dist`, absent until a site build
    mkdirSync(assets)
    execFileSync(join(REPO_ROOT, 'node_modules/.bin/wrangler'), ['deploy', '--dry-run', '--outdir', outdir, '--assets', assets], {
      cwd: REPO_ROOT,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: join(scratch, 'logs') },
      stdio: 'pipe',
    })
    bundle = join(outdir, 'index.js')
    bundleSource = readFileSync(bundle, 'utf8')
    writeFileSync(join(scratch, 'run-bundle.mjs'), RUNNER)
  }, 120_000)

  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  it('keeps process-shim.ts in the bundle (a bare import is only kept when its package declares it a side effect)', () => {
    // The shim's unconditional `process.cwd` override; `else target.process.cwd = () => ""` survives minify-free esbuild output.
    expect(bundleSource).toMatch(/process\.cwd = \(\) => ["']{2}/)
  })

  it('loads without throwing when process.cwd() is workerd\'s /bundle, and exposes the fetch handler', () => {
    const run = spawnSync(process.execPath, [join(scratch, 'run-bundle.mjs'), bundle], { cwd: scratch, encoding: 'utf8' })
    expect(run.stdout.trim()).toBe('WORKER_LOADED')
    expect(run.status).toBe(0)
  })
})
