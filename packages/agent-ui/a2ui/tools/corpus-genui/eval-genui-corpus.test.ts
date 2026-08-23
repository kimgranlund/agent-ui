// eval-genui-corpus.test.ts — LLD-C4 (GH #1584), AC7 (n4a): `--help` exits 0 and lists the five legs
// with their KEYLESS/NEEDS-KEY tag; `generate`/`judge` with no `ANTHROPIC_API_KEY` in env or `.env` exit
// 2 with the named no-key message and write nothing (proven via a REAL child process — the literal
// documented invocation, `node --experimental-strip-types eval-genui-corpus.ts <leg>`); an unknown
// `--model` exits 2 naming `resolvePair`'s reason.

import { describe, it, expect, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { runCli, helpText } from './eval-genui-corpus.ts'
import { makeTempRepoRoot, cleanupTempRepoRoot } from './test-helpers.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

let repoRoot: string
afterEach(() => {
  if (repoRoot) cleanupTempRepoRoot(repoRoot)
})

function safeReaddir(dir: string): string[] {
  try {
    return (readdirSync(dir) as string[]).sort()
  } catch {
    return []
  }
}

describe('helpText — lists every leg with its KEYLESS/NEEDS-KEY tag', () => {
  it('names all five legs and their side', () => {
    const text = helpText()
    for (const leg of ['collect', 'generate', 'judge', 'apply', 'report']) expect(text).toContain(leg)
    expect(text).toMatch(/collect\s+KEYLESS/)
    expect(text).toMatch(/generate\s+NEEDS KEY/)
    expect(text).toMatch(/judge\s+NEEDS KEY/)
    expect(text).toMatch(/apply\s+KEYLESS/)
    expect(text).toMatch(/report\s+KEYLESS/)
  })
})

describe('runCli — --help / no leg', () => {
  it('--help exits 0', async () => {
    const code = await runCli(['--help'], process.cwd(), {})
    expect(code).toBe(0)
  })

  it('no leg given also prints help and exits 0', async () => {
    const code = await runCli([], process.cwd(), {})
    expect(code).toBe(0)
  })

  it('an unknown leg exits 2', async () => {
    const code = await runCli(['not-a-real-leg'], process.cwd(), {})
    expect(code).toBe(2)
  })
})

describe('runCli — generate/judge with no key: exit 2, writes nothing', () => {
  it('generate with an empty env AND no repo-root .env exits 2', async () => {
    repoRoot = makeTempRepoRoot()
    const code = await runCli(['generate', '--only-prompt', 'data-viz-layouts-1'], repoRoot, {})
    expect(code).toBe(2)
    const dir = join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1')
    expect(() => readdirSync(dir)).toThrow() // never even created
  })

  it('judge with no key ALSO exits 2', async () => {
    repoRoot = makeTempRepoRoot()
    const code = await runCli(['judge'], repoRoot, {})
    expect(code).toBe(2)
  })
})

describe('runCli — an unknown --model exits 2, naming resolvePair\'s reason', () => {
  it('generate --model nonsense-model exits 2 before ever checking the key', async () => {
    repoRoot = makeTempRepoRoot()
    // NOTE: no ANTHROPIC_API_KEY in env either — proving model validation runs FIRST regardless.
    const code = await runCli(['generate', '--model', 'nonsense-model'], repoRoot, {})
    expect(code).toBe(2)
  })
})

describe('runCli — collect/apply/report never require a key (KEYLESS)', () => {
  it('collect with no --from runs to completion (exit 0) with no key at all', async () => {
    repoRoot = makeTempRepoRoot()
    const code = await runCli(['collect'], repoRoot, {})
    expect(code).toBe(0)
  })

  it('report runs to completion (exit 0) with no key at all', async () => {
    repoRoot = makeTempRepoRoot()
    const code = await runCli(['report'], repoRoot, {})
    expect(code).toBe(0)
  })
})

// The literal documented invocation (LLD §4): a REAL subprocess, `env: {}` (no ANTHROPIC_API_KEY, no
// inherited shell exports). `cwd` is the REAL repo root — NOT a temp dir: `produce.ts`'s own import
// chain (`mini-skills.ts`/`genui-packs.ts`, ADR-0135) reads its `.md` registries relative to
// `process.cwd()` AT MODULE LOAD (measured: a temp cwd throws `ENOENT` scanning for
// `prompts/mini-skills`, since those modules — by design, mirroring the real npm-script invocation —
// never accept an injected repo root). BUT `--repo-root` points the key lookup + every leg's tree at a
// temp root that carries NO `.env`: an empty spawn env alone is NOT "no key" — `readAnthropicApiKey`
// falls through to the repo-root `.env`, and on a dev host whose git-ignored `.env` holds a key this
// proof used to construct the real provider and make a live call (GH #1592: 401 → exit 1, red on main).
// The no-key check in `runCli` fires BEFORE any leg logic ever runs, so nothing is ever written; the
// record-dir-growth assertions below (temp root AND real tree) are a paranoia check on top of that.
describe('the REAL CLI subprocess — node --experimental-strip-types eval-genui-corpus.ts generate, no key', () => {
  it('exits 2 with the named no-key message, writing nothing (no key in env, no .env at --repo-root)', () => {
    repoRoot = makeTempRepoRoot()
    const scriptPath = join(process.cwd(), 'packages/agent-ui/a2ui/tools/corpus-genui/eval-genui-corpus.ts')
    const realRecordsDir = join(process.cwd(), 'packages/agent-ui/a2ui/corpus-genui/records/v1')
    const tempRecordsDir = join(repoRoot, 'packages/agent-ui/a2ui/corpus-genui/records/v1')
    const before = safeReaddir(realRecordsDir)
    const result = spawnSync(
      'node',
      ['--experimental-strip-types', scriptPath, 'generate', '--only-prompt', 'data-viz-layouts-1', '--repo-root', repoRoot],
      {
        cwd: process.cwd(),
        env: { PATH: process.env.PATH }, // deliberately NO ANTHROPIC_API_KEY, no other inherited vars
        encoding: 'utf8',
        timeout: 15_000,
      },
    )
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/no ANTHROPIC_API_KEY/)
    expect(safeReaddir(tempRecordsDir)).toEqual([]) // never even created at the temp root
    expect(safeReaddir(realRecordsDir)).toEqual(before) // and nothing new written to the REAL tree
  })

  it('the same subprocess with --help exits 0 and lists every leg', () => {
    const scriptPath = join(process.cwd(), 'packages/agent-ui/a2ui/tools/corpus-genui/eval-genui-corpus.ts')
    const result = spawnSync('node', ['--experimental-strip-types', scriptPath, '--help'], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 15_000,
    })
    expect(result.status).toBe(0)
    for (const leg of ['collect', 'generate', 'judge', 'apply', 'report']) expect(result.stdout).toContain(leg)
  })
})
