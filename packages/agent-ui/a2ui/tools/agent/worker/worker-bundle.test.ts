// worker-bundle.test.ts: the module-load gate for the production Worker. Cloudflare executes a Worker's
// top level at upload time, so a throw there is a failed deploy (error 10021). The unit tests in this
// folder import `route-guards.ts` and its siblings directly and never evaluate the BUNDLE. History: #1824's
// deploy failed because a bundled module resolved a prompt path from `process.cwd()` at load; #1828 added
// this gate. The build-time asset embed (ADR-0236) since removed every load-time filesystem read.
//
// This test builds the Worker the way the deploy does (`wrangler deploy --dry-run`, wrangler.jsonc as is,
// the repo's own wrangler binary, nothing uploaded, no credentials) and evaluates the emitted entry in a
// child Node process whose `process.cwd()` returns `/bundle`, the value workerd's `nodejs_compat` gives.
// Loading cleanly there proves no bundled module resolves a path from `process.cwd()` at load. The child is
// a subprocess so the `/bundle` override never leaks into this shared test process.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../../../../..', import.meta.url))

// Wrangler's Text module rule emits each `.jsonl` as a sibling file the bundle imports by name; workerd
// loads those as text, Node cannot, so this loader hook serves them the same way. The other workerd-side
// behaviour modelled is `process.cwd()` returning `/bundle`, the value `nodejs_compat` gives.
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
    writeFileSync(join(scratch, 'run-bundle.mjs'), RUNNER)
  }, 120_000)

  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  it('loads without throwing when process.cwd() is workerd\'s /bundle, and exposes the fetch handler', () => {
    const run = spawnSync(process.execPath, [join(scratch, 'run-bundle.mjs'), bundle], { cwd: scratch, encoding: 'utf8' })
    expect(run.stdout.trim()).toBe('WORKER_LOADED')
    expect(run.status).toBe(0)
  })
})
