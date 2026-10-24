// request-signal.test.ts (T-0438): a visitor who disconnects mid-turn cancels the paid model call, proven in
// workerd itself, not Node. The unit tests (arena-route.test.ts, the produce/chat signal tests) prove
// `request.signal` reaches the provider signal; only the runtime decides whether `request.signal` ever fires.
// In workerd it fires on a client disconnect only under the `enable_request_signal` compatibility flag, which
// has no default-on date, and only once the Worker next writes the response body.
//
// The real deploy bundle (`wrangler deploy --dry-run`, as worker-bundle.test.ts builds it) runs in Miniflare
// with wrangler.jsonc's own `compatibility_date` and `compatibility_flags`, read from the file so deleting the
// flag there reds this test. Every outbound `fetch` goes to a stub upstream Worker that streams an endless
// Anthropic SSE reply and logs when its request is aborted, which happens only when the bundle's provider
// `fetch` is aborted. The client is a raw socket that is destroyed mid-turn (Node `fetch`'s abort does not
// reach the runtime through Miniflare's proxy). The negative control drops the flag and expects no abort.
// The arena legs also prove its heartbeat (arena-route.ts): with no write during a seat call, workerd never
// notices the disconnect and the positive leg times out.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import type { Readable } from 'node:stream'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Miniflare } from 'miniflare' // wrangler's own runtime dependency (the version it pins), hoisted

const REPO_ROOT = fileURLToPath(new URL('../../../../../..', import.meta.url))
const FLAG = 'enable_request_signal'

/** wrangler.jsonc as deployed; its comments are whole lines, so dropping them leaves plain JSON. */
const wrangler = JSON.parse(
  readFileSync(join(REPO_ROOT, 'wrangler.jsonc'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n'),
) as { compatibility_date: string; compatibility_flags: string[] }

// The stub provider: one `message_start`, one text block, then a delta every 100 ms for as long as the bundle
// keeps reading. It logs `UPSTREAM start` per call and `UPSTREAM aborted` when the caller aborts its fetch.
const UPSTREAM = `export default {
  async fetch(request) {
    console.log('UPSTREAM start ' + new URL(request.url).pathname)
    request.signal.addEventListener('abort', () => console.log('UPSTREAM aborted'))
    const enc = new TextEncoder()
    const ev = (o) => enc.encode('event: ' + o.type + '\\ndata: ' + JSON.stringify(o) + '\\n\\n')
    return new Response(new ReadableStream({
      start(c) {
        c.enqueue(ev({ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', content: [], model: 'stub', stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } }))
        c.enqueue(ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }))
      },
      async pull(c) {
        await new Promise((r) => setTimeout(r, 100))
        c.enqueue(ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'a' } }))
      },
    }), { headers: { 'content-type': 'text/event-stream' } })
  },
}`

const ROUTES = {
  arena: {
    path: '/__a2a/arena',
    body: { seats: { X: { provider: 'anthropic', model: 'claude-sonnet-5-5' }, O: { provider: 'anthropic', model: 'claude-haiku-5-5' } } },
  },
  agent: {
    path: '/__a2ui/agent',
    body: { input: { kind: 'intent', text: 'hi', session: { turns: [] } }, provider: 'anthropic', model: 'claude-sonnet-5-5' },
  },
} as const

async function until(pred: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms
  while (!pred() && Date.now() < end) await new Promise((r) => setTimeout(r, 50))
  return pred()
}

describe('a client disconnect aborts the in-flight provider call in workerd (T-0438)', () => {
  let scratch: string
  let outdir: string

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'a2ui-request-signal-'))
    outdir = join(scratch, 'out')
    const assets = join(scratch, 'assets')
    mkdirSync(assets)
    execFileSync(join(REPO_ROOT, 'node_modules/.bin/wrangler'), ['deploy', '--dry-run', '--outdir', outdir, '--assets', assets], {
      cwd: REPO_ROOT,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: join(scratch, 'logs') },
      stdio: 'pipe',
    })
  }, 120_000)

  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  /** Run one turn against the bundle under `flags`, drop the socket once the upstream call is streaming,
   * and report whether the upstream saw its request aborted within `waitMs`. */
  async function disconnectMidTurn(route: keyof typeof ROUTES, flags: string[], waitMs: number): Promise<{ started: boolean; aborted: boolean; head: string }> {
    let log = ''
    const mf = new Miniflare({
      handleRuntimeStdio(stdout: Readable, stderr: Readable) {
        stdout.on('data', (d: Buffer) => (log += d.toString()))
        stderr.on('data', () => {})
      },
      workers: [
        {
          name: 'docs',
          modules: true,
          scriptPath: join(outdir, 'index.js'),
          modulesRoot: outdir,
          modulesRules: [{ type: 'Text', include: ['**/*.jsonl'] }],
          compatibilityDate: wrangler.compatibility_date,
          compatibilityFlags: flags,
          bindings: { ANTHROPIC_API_KEY: 'sk-test-value' },
          ratelimits: { ARENA_RATE_LIMITER: { namespace_id: '4300', simple: { limit: 10, period: 60 } } },
          serviceBindings: { ASSETS: () => new Response('') },
          outboundService: 'upstream',
        },
        { name: 'upstream', modules: true, script: UPSTREAM, compatibilityDate: wrangler.compatibility_date, compatibilityFlags: [FLAG] },
      ],
    })
    try {
      const base = await mf.ready
      const { path, body } = ROUTES[route]
      const payload = JSON.stringify(body)
      let head = ''
      const socket = connect(Number(base.port), base.hostname, () =>
        socket.write(
          `POST ${path} HTTP/1.1\r\nHost: ui.nonoun.io\r\nOrigin: https://ui.nonoun.io\r\nContent-Type: application/json\r\n` +
            `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`,
        ),
      )
      socket.on('data', (d: Buffer) => (head += d.toString()))
      socket.on('error', () => {})
      const started = await until(() => log.includes('UPSTREAM start /v1/messages') && head.startsWith('HTTP/1.1 200'), 15_000)
      socket.destroy()
      const aborted = await until(() => log.includes('UPSTREAM aborted'), waitMs)
      return { started, aborted, head: head.slice(0, 200) }
    } finally {
      await mf.dispose()
    }
  }

  it('wrangler.jsonc enables request.signal for incoming requests', () => {
    expect(wrangler.compatibility_flags).toContain(FLAG)
  })

  for (const route of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) {
    it(`${ROUTES[route].path}: with wrangler.jsonc's flags, the provider fetch is aborted`, async () => {
      const out = await disconnectMidTurn(route, wrangler.compatibility_flags, 10_000)
      expect(out.started, out.head).toBe(true)
      expect(out.aborted).toBe(true)
    }, 60_000)
  }

  // The arena only: without the flag its seat call runs on every time. `/__a2ui/agent` without the flag is a
  // race (workerd's teardown of the dropped request sometimes cancels the subrequest, sometimes not), so it
  // has no stable negative; the flag is what makes its abort certain.
  it(`/__a2a/arena: negative control, without ${FLAG} the provider call runs on`, async () => {
    const out = await disconnectMidTurn('arena', wrangler.compatibility_flags.filter((f) => f !== FLAG), 3_000)
    expect(out.started, out.head).toBe(true)
    expect(out.aborted).toBe(false)
  }, 60_000)
})
