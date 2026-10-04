// validate-payload.test.ts: GH #1737, `--catalog` resolves through the Node-side catalog registry
// (`tools/catalog-files.ts`), so the compose-verify instrument can verdict a payload against the
// upstream Basic catalog as well as the default one (harness LLD-C6, SPEC-R6).
//
// The script has NO CLI-entry guard (it calls `main()` unconditionally), so it is NEVER imported here:
// every leg spawns it as a real subprocess and reads the exit code + the verdict shape it prints. That is
// also the only tier that can catch a deleted call site (the `import-seeds.test.ts` doctrine, GH #341).
//
// The bite is directional and rides ONE payload file per dialect. The Basic payload (a planted upstream
// fixture, `src/catalog/a2ui-basic/planted.ts`) must exit 0 under `--catalog a2ui-basic` AND exit 1
// under the default catalog; the agent-ui payload (a real shelf seed) must do the reverse. A flag that
// were parsed but ignored would pass one direction and fail the other, so the exit code is asserted as
// one leg and the printed CATALOG failures as the other.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plantedBasicMessages } from '../../src/catalog/a2ui-basic/planted.ts'
import { canvasButtonSeed } from '../../src/examples/canvas-button.ts'

declare const process: { cwd(): string }

const REAL_ROOT = process.cwd()
const SCRIPT = join(REAL_ROOT, 'packages/agent-ui/a2ui/tools/harness/validate-payload.ts')

describe('validate-payload --catalog (GH #1737): real subprocess runs', () => {
  // One `node` subprocess per leg: the 5000ms vitest default reds under host contention (the
  // import-seeds.test.ts GH #1711 precedent), scoped to this describe and reset afterwards.
  vi.setConfig({ testTimeout: 30_000 })

  let dir: string
  let basicPath: string
  let agentUiPath: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'a2ui-validate-payload-'))
    basicPath = join(dir, 'basic.json')
    agentUiPath = join(dir, 'agent-ui.json')
    writeFileSync(basicPath, JSON.stringify(plantedBasicMessages('interactive-button')))
    writeFileSync(agentUiPath, JSON.stringify(canvasButtonSeed.messages))
  })
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.resetConfig()
  })

  const run = (args: string[], cwd: string = REAL_ROOT): { status: number | null; stdout: string; stderr: string } => {
    const r = spawnSync('node', ['--experimental-strip-types', SCRIPT, ...args], { cwd, encoding: 'utf8' })
    return { status: r.status, stdout: r.stdout, stderr: r.stderr }
  }

  /** The failures the script printed (exit 1 prints the verdict array on stdout). */
  const failuresOf = (stdout: string): { code: string; path: string }[] => JSON.parse(stdout) as { code: string; path: string }[]

  it('a Basic-dialect payload exits 0 under --catalog a2ui-basic', () => {
    const r = run([basicPath, '--catalog', 'a2ui-basic'])
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(JSON.parse(r.stdout)).toEqual({ ok: true, repairs: [] })
  })

  it('the SAME Basic payload exits 1 under the default catalog, with CATALOG failures (the flag changes the verdict, it is not ignored)', () => {
    for (const args of [[basicPath], [basicPath, '--catalog', 'agent-ui']]) {
      const r = run(args)
      expect(r.status, args.join(' ')).toBe(1)
      const failures = failuresOf(r.stdout)
      expect(failures.length, args.join(' ')).toBeGreaterThan(0)
      expect(failures.every((f) => f.code === 'CATALOG'), args.join(' ')).toBe(true)
    }
  })

  it('an agent-ui payload exits 0 by default and under --catalog agent-ui (the default path is unchanged)', () => {
    for (const args of [[agentUiPath], [agentUiPath, '--catalog', 'agent-ui']]) {
      const r = run(args)
      expect(r.status, args.join(' ') + r.stdout + r.stderr).toBe(0)
      expect(JSON.parse(r.stdout)).toMatchObject({ ok: true })
    }
  })

  it('the SAME agent-ui payload exits 1 under --catalog a2ui-basic, with CATALOG failures', () => {
    const r = run([agentUiPath, '--catalog', 'a2ui-basic'])
    expect(r.status).toBe(1)
    const failures = failuresOf(r.stdout)
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.every((f) => f.code === 'CATALOG')).toBe(true)
  })

  it('an unregistered --catalog id still exits 1 and names the loadable ids, printing no verdict', () => {
    const r = run([basicPath, '--catalog', 'bogus'])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/unknown catalog "bogus"/)
    expect(r.stderr).toMatch(/agent-ui, a2ui-basic/)
    expect(r.stdout, 'an unknown catalog must never reach a verdict').toBe('')
  })

  // The script resolves each registry path against `process.cwd()` (the repo root), while the script and
  // every module it imports resolve relative to the REAL file: so an EMPTY temp cwd is a repo root whose
  // registered catalog files are all missing, with no real catalog file touched or moved.
  it.each(['agent-ui', 'a2ui-basic'])('a REGISTERED id (%s) whose catalog.json is missing exits 1 with ONE line naming the id and path, not a raw ENOENT stack', (id) => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'a2ui-validate-payload-noroot-'))
    try {
      const r = run([agentUiPath, '--catalog', id], emptyRoot)
      expect(r.status, r.stdout + r.stderr).toBe(1)
      expect(r.stdout, 'a missing catalog must never reach a verdict').toBe('')
      const lines = r.stderr.trim().split('\n')
      expect(lines, r.stderr).toHaveLength(1)
      expect(lines[0]).toMatch(new RegExp(`^validate-payload: catalog-files: cannot read catalog "${id}" at packages/agent-ui/a2ui/src/catalog/.+/catalog\\.json \\(ENOENT\\)$`))
      expect(r.stderr, 'no stack frames').not.toMatch(/\n\s+at /)
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true })
    }
  })
})

// ADR-0064 amendment (2026-10-03) Acceptance 1 and 2 / GH #1740: the compose-verify instrument runs the
// validator at FINALIZE granularity, so it is where the per-surface epoch rule meets a real producer. A
// delete-then-recreate of the same surfaceId passes; the same stream without the second root is the
// abandoned-surface defect on the epoch still open at payload end.
describe('validate-payload: deleteSurface frees the id graph (ADR-0064 amendment, GH #1740): real subprocess runs', () => {
  vi.setConfig({ testTimeout: 30_000 })

  let dir: string
  const msg = {
    create: { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } },
    root: (text: string) => ({
      version: 'v1.0',
      updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text }] },
    }),
    del: { version: 'v1.0', deleteSurface: { surfaceId: 's' } },
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'a2ui-validate-payload-epochs-'))
  })
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.resetConfig()
  })

  const runPayload = (name: string, messages: unknown[]): { status: number | null; stdout: string; stderr: string } => {
    const path = join(dir, name)
    writeFileSync(path, JSON.stringify(messages))
    const r = spawnSync('node', ['--experimental-strip-types', SCRIPT, path], { cwd: REAL_ROOT, encoding: 'utf8' })
    return { status: r.status, stdout: r.stdout, stderr: r.stderr }
  }

  it('Acceptance 1: createSurface s, root, deleteSurface s, createSurface s, root exits 0', () => {
    const r = runPayload('recreate.json', [msg.create, msg.root('first'), msg.del, msg.create, msg.root('second')])
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(JSON.parse(r.stdout)).toEqual({ ok: true, repairs: [] })
  })

  it('Acceptance 2: the same stream without the second root exits 1 with exactly IDGRAPH s:root-missing', () => {
    const r = runPayload('abandoned.json', [msg.create, msg.root('first'), msg.del, msg.create])
    expect(r.status, r.stdout + r.stderr).toBe(1)
    const failures = (JSON.parse(r.stdout) as { code: string; path: string }[]).map(({ code, path }) => ({ code, path }))
    expect(failures).toEqual([{ code: 'IDGRAPH', path: 's:root-missing' }])
  })
})
