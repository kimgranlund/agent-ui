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

// T-0024: the Worker route is not importable under vitest, so its `/chat` failure body is exercised through the
// same emitted bundle. The child stubs `fetch` with a response whose body never emits and shortens ONE of the two
// real timers (`argv[3]`: the adapter's 60000 ms stall timer, or the whole-turn 300000 ms deadline) to 5 ms, so
// the real adapter and the real `withTurnDeadline` throw the real error classes, and the Worker's own catch
// answers. It prints one `CHAT_RESULT` line and exits (the longer timer is still armed).
const CHAT_RUNNER = `
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
const realSetTimeout = globalThis.setTimeout
const shortened = process.argv[3] === 'stall' ? 60000 : process.argv[3] === 'deadline' ? 300000 : -1
globalThis.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms === shortened ? 5 : ms, ...args)
globalThis.fetch = async () => new Response(new ReadableStream({ start() {} }), { status: 200 })
console.error = () => {}
const mod = await import(pathToFileURL(process.argv[2]).href)
const request = new Request('https://ui.nonoun.io/__a2ui/agent/chat', {
  method: 'POST',
  headers: { origin: 'https://ui.nonoun.io', 'content-type': 'application/json' },
  body: JSON.stringify({ system: 's', model: 'claude-sonnet-5', messages: [{ role: 'user', content: 'hi' }] }),
})
const res = await mod.default.fetch(request, { ASSETS: { fetch: async () => new Response('') }, ANTHROPIC_API_KEY: 'sk-test-value' })
console.log('CHAT_RESULT ' + JSON.stringify({ status: res.status, body: await res.json() }))
process.exit(0)
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
    writeFileSync(join(scratch, 'run-chat.mjs'), CHAT_RUNNER)
  }, 120_000)

  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  it('loads without throwing when process.cwd() is workerd\'s /bundle, and exposes the fetch handler', () => {
    const run = spawnSync(process.execPath, [join(scratch, 'run-bundle.mjs'), bundle], { cwd: scratch, encoding: 'utf8' })
    expect(run.stdout.trim()).toBe('WORKER_LOADED')
    expect(run.status).toBe(0)
  })

  /** POST one `/chat` turn at the bundle with the named timer shortened; return its status and JSON body. */
  function chatTurn(shorten: 'stall' | 'deadline'): { status: number; body: { error?: string }; stdout: string } {
    const run = spawnSync(process.execPath, [join(scratch, 'run-chat.mjs'), bundle, shorten], { cwd: scratch, encoding: 'utf8', timeout: 30_000 })
    const line = run.stdout.split('\n').find((l) => l.startsWith('CHAT_RESULT '))
    expect(line, `no CHAT_RESULT line; stderr: ${run.stderr}`).toBeDefined()
    return { ...(JSON.parse(line!.slice('CHAT_RESULT '.length)) as { status: number; body: { error?: string } }), stdout: run.stdout }
  }

  it('/chat: a stalled stream answers 500 with the plain-words stall line, not the adapter log line (T-0024)', () => {
    const out = chatTurn('stall')
    expect(out.status).toBe(500)
    expect(out.body.error).toMatch(/stopped sending its reply/)
    expect(out.body.error).not.toMatch(/anthropicProvider|\d ms\b/)
  })

  it('/chat: the whole-turn deadline answers 500 with the plain-words deadline line (T-0024)', () => {
    const out = chatTurn('deadline')
    expect(out.status).toBe(500)
    expect(out.body.error).toMatch(/taking longer than 300 seconds/)
    expect(out.body.error).not.toMatch(/\d ms\b/)
  })
})
