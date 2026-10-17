// agent-compile.test.ts: T-0163 (agent-content SPEC AC-R11/R12, AC-R13). Test Chat, the dev proxy and the CLI
// produce the same bundle digest for the same agent and overlay:
// - Test Chat: the REAL ui-agent-admin runs a surface turn on a concierge store (seed plus an overlay) through
//   the REAL site runner, whose request body carries its stamp (fetch is stubbed to capture the body);
// - the proxy: that very body POSTed to the REAL dev-proxy middleware (provider dispatch mocked), whose trace
//   line records the digest it recomputed from the body;
// - the CLI: `node scripts/agent-content.mjs compile concierge --overlay <file> --json`, spawned for real.
// The same turn's devtools capture then rides the debug bundle (the `captures/` slot the export never filled).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
// @ts-expect-error - node builtins are typed via @types/node; vitest resolves them at runtime (site/tsconfig.json carries no node types)
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
// @ts-expect-error - see above
import { tmpdir } from 'node:os'
// @ts-expect-error - see above
import { join } from 'node:path'
// @ts-expect-error - see above
import { spawnSync } from 'node:child_process'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/app/agent-admin'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import { createOverlayStore, emptyOverlay, setOverlayKey, type AgentOverlay } from '@agent-ui/app/agent-admin-overlay'
import { entriesStoreKey, type Entry } from '@agent-ui/app/entry-data'
import { SURFACE_A2UI_KEY } from '@agent-ui/app/agent-admin-schema'
import { parseCapture } from '@agent-ui/devtools'
import { compileAgent, contentManifestFor, shippedPersona } from './agent-compile.ts'
import { createAdminSurfaceTurn } from './admin-live-runner.ts'
import { buildDebugBundle } from '../pages/agent-admin-debug-export.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

// The dev proxy is Node-typed (vite, node:*); a static import would pull Node's types into the site program
// (site/tsconfig.json carries none), so it loads by a computed specifier and its trace line is read through
// the fields this test asserts.
const PROXY_MODULE = '../../packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts'
type ProxyPlugin = { configureServer: unknown }
interface TraceLineRead {
  bundle?: { digest: string; claimed?: string }
  warnings: string[]
}

vi.mock('../../packages/agent-ui/a2ui/tools/agent/providers/index.ts', () => ({
  providerFor: () => ({
    ok: true,
    provider: {
      // eslint-disable-next-line require-yield
      async *stream() {
        throw new Error('no model in this test: the trace line is what it reads')
      },
    },
  }),
}))

let realAttachInternals: typeof HTMLElement.prototype.attachInternals
let previousKey: string | undefined
let traceDir: string
let handler: (req: unknown, res: unknown) => void
beforeAll(async () => {
  const { a2uiDevProxyPlugin } = (await import(/* @vite-ignore */ PROXY_MODULE)) as { a2uiDevProxyPlugin: (opts: unknown) => ProxyPlugin }
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
  previousKey = process.env['ANTHROPIC_API_KEY']
  process.env['ANTHROPIC_API_KEY'] = 'sk-ant-api03-test-key-0123456789'
  traceDir = mkdtempSync(join(tmpdir(), 'agent-compile-traces-'))
  const plugin = a2uiDevProxyPlugin({ traces: { dir: traceDir } })
  ;(plugin.configureServer as unknown as (s: unknown) => void)({ middlewares: { use: (_mount: string, fn: typeof handler) => (handler = fn) } })
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
  if (previousKey === undefined) delete process.env['ANTHROPIC_API_KEY']
  else process.env['ANTHROPIC_API_KEY'] = previousKey
  rmSync(traceDir, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

/** POST one body to the dev proxy and wait for the response to end. */
async function postToProxy(body: unknown): Promise<void> {
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {}
  const req = {
    method: 'POST',
    url: '/produce',
    on(event: string, cb: (arg?: unknown) => void) {
      ;(listeners[event] ??= []).push(cb)
      if (event === 'end')
        queueMicrotask(() => {
          for (const fn of listeners['data'] ?? []) fn(JSON.stringify(body))
          for (const fn of listeners['end'] ?? []) fn()
        })
    },
  }
  let settle: () => void = () => {}
  const done = new Promise<void>((r) => (settle = r))
  const res = {
    statusCode: 0,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    setHeader: () => {},
    on: () => {},
    write: () => true,
    end: () => {
      res.writableEnded = true
      settle()
    },
  }
  handler(req, res)
  await done
}

function traceLines(): TraceLineRead[] {
  return (readdirSync(traceDir) as string[])
    .filter((n) => n.endsWith('.jsonl'))
    .flatMap((n) => (readFileSync(join(traceDir, n), 'utf8') as string).split('\n').filter(Boolean))
    .map((l: string) => JSON.parse(l) as TraceLineRead)
}

describe('one agent, one overlay, one digest: Test Chat, the dev proxy and the CLI (T-0163)', () => {
  it('the three produce the same digest and Test Chat and the CLI the same resolution; the capture rides the debug bundle', async () => {
    const persona = shippedPersona('concierge')!
    const seed = persona.seed
    const skillKey = entriesStoreKey('skill')
    const skills = (seed[skillKey] as Entry[]).map((e, i) => (i === 0 ? { ...e, description: 'A user-edited description.' } : e))
    let overlay: AgentOverlay = emptyOverlay('concierge', persona.seedVersion ?? 1, seed)
    overlay = setOverlayKey(seed, overlay, skillKey, skills)
    overlay = setOverlayKey(seed, overlay, SURFACE_A2UI_KEY, true)
    const store = createOverlayStore({ seed, overlay })
    const manifest = contentManifestFor(persona)

    // Test Chat: the real component and the real runner; fetch captures the body and answers one note.
    let sent: Record<string, unknown> | undefined
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      sent = JSON.parse(init.body) as Record<string, unknown>
      return new Response('{"a2uiMeta":{"note":"Welcome."}}\n', { status: 200, headers: { 'content-type': 'application/x-ndjson' } })
    })
    const runner = createAdminSurfaceTurn(() => ({ manifest, store }))
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = store
    el.contentManifest = manifest
    el.agentSurfaceTurn = runner
    document.body.append(el)
    try {
      await whenFlushed()
      const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
      composer.value = 'What time is breakfast?'
      ;(composer.querySelector('[data-part="editor"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      await vi.waitFor(() => expect(runner.captures()).toHaveLength(1), { timeout: 5000 })
    } finally {
      el.remove()
    }
    const testChat = sent!
    expect(testChat['bundleDigest']).toMatch(/^sha256:[0-9a-f]{64}$/)

    // The proxy: the same body, its digest recomputed and recorded.
    await postToProxy(testChat)
    const line = traceLines().at(-1)!
    expect(line.bundle?.digest).toBe(testChat['bundleDigest'])
    expect(line.bundle?.claimed).toBe(testChat['bundleDigest'])
    expect(line.warnings.filter((w) => w.startsWith('bundle digest mismatch'))).toEqual([])

    // The CLI, spawned for real over the same overlay.
    const dir = mkdtempSync(join(tmpdir(), 'agent-compile-cli-'))
    try {
      const file = join(dir, 'overlay.json')
      writeFileSync(file, JSON.stringify(overlay))
      const cli = spawnSync('node', ['scripts/agent-content.mjs', 'compile', 'concierge', '--overlay', file, '--json'], { cwd: process.cwd(), encoding: 'utf8' }) as { status: number; stdout: string; stderr: string }
      expect(cli.status, cli.stderr).toBe(0)
      const printed = JSON.parse(cli.stdout) as { digest: string; resolution: unknown[] }
      expect(printed.digest).toBe(testChat['bundleDigest'])
      expect(printed.resolution).toEqual(testChat['resolution'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }

    // The in-process compile agrees, and the edit is attributed: the edited skill reads `user`.
    const compiled = await compileAgent('concierge', overlay)
    expect(compiled.digest).toBe(testChat['bundleDigest'])
    expect(compiled.resolution.find((r) => r.id === skills[0]!.id)?.source).toBe('user')
    expect(compiled.resolution.find((r) => r.id === skills[1]!.id)?.source).toBe('seed')
    expect(compiled.digest).not.toBe((await compileAgent('concierge')).digest)

    // The debug bundle carries the turn's capture (parseable) and the agent's content stamp.
    const { entries, manifest: bundleManifest } = buildDebugBundle({
      agents: [],
      activeAgentId: 'concierge',
      testChatTranscript: [],
      builderInterviewTranscript: [],
      captures: runner.captures(),
      content: [{ agentId: 'concierge', stamp: { digest: compiled.digest, resolution: compiled.resolution } }],
    })
    expect(bundleManifest.files.captures).toEqual(['captures/test-chat.json'])
    expect(bundleManifest.files.content).toEqual(['content/concierge.json'])
    const capture = parseCapture(String(entries.find((e) => e.path === 'captures/test-chat.json')!.data))
    expect(capture.timeline.map((e) => e.kind)).toEqual(['turn-start', 'meta', 'turn-end'])
    expect(capture.timeline.map((e) => e.seq)).toEqual([0, 1, 2])
    expect(capture.session.turns.length).toBeGreaterThan(0)
    expect(JSON.parse(String(entries.find((e) => e.path === 'content/concierge.json')!.data))).toMatchObject({ digest: compiled.digest })
  }, 30_000)
})
