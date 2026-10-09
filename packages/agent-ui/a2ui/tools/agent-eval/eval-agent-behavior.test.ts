// eval-agent-behavior.test.ts: the CLI entry's keyless proofs (GH #1810): the live leg with no key exits
// 2 (a REAL subprocess at the real cwd, `--repo-root` at a temp dir with no `.env`, the GH #1592
// precedent: the main checkout carries a `.env`, so an empty env alone is not "no key"); no test here
// constructs the real provider adapter; every selftest result line is labeled `scripted`.

import { describe, it, expect, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCli, runScriptedTurn } from './eval-agent-behavior.ts'
import type { ScriptedTurn } from './eval-agent-behavior.ts'

const DIR = join(process.cwd(), 'packages/agent-ui/a2ui/tools/agent-eval')
const ENTRY = join(DIR, 'eval-agent-behavior.ts')

describe('the live leg', () => {
  it('live with no key exits 2', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'agent-eval-nokey-'))
    try {
      const result = spawnSync('node', ['--experimental-strip-types', ENTRY, 'live', '--leg', 'selection', '--repo-root', tmp], {
        cwd: process.cwd(),
        env: { PATH: process.env.PATH }, // deliberately no key and no other inherited vars
        encoding: 'utf8',
        timeout: 30_000,
      })
      expect(result.status).toBe(2)
      expect(result.stderr).toContain('ANTHROPIC_API_KEY')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('no agent-eval test constructs the real anthropicProvider', () => {
    // Built from parts so this file never matches its own pattern.
    const ctor = new RegExp(['anthropic', 'Provider', '\\s*\\('].join(''))
    const tests = (readdirSync(DIR) as string[]).filter((f) => f.endsWith('.test.ts'))
    expect(tests.length).toBeGreaterThan(0)
    for (const f of tests) expect(readFileSync(join(DIR, f), 'utf8'), f).not.toMatch(ctor)
    // anti-vacuous control: the CLI entry, the one sanctioned constructor, does match
    expect(readFileSync(ENTRY, 'utf8')).toMatch(ctor)
  })
})

describe('the selftest', () => {
  it('every selftest result line is labeled scripted', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const code = await runCli(['selftest'], process.cwd(), {})
      expect(code).toBe(0)
      const lines = log.mock.calls.map((call) => String(call[0]))
      expect(lines.length).toBeGreaterThan(1)
      for (const line of lines) expect(line.startsWith('scripted ')).toBe(true)
      expect(lines.filter((l) => /^scripted (PASS|FAIL) /.test(l)).length).toBeGreaterThan(0)
    } finally {
      log.mockRestore()
    }
  })
})

describe('the response-type selftest turns', () => {
  it('seeded wrong choice: with its expected failure removed, the turn reports a mismatch', async () => {
    const doc = JSON.parse(readFileSync(join(DIR, 'fixtures/scripted-turns.json'), 'utf8')) as { turns: ScriptedTurn[] }
    const seeded = doc.turns.find((t) => t.id === 'response-type-wrong-choice')
    expect(seeded).toBeDefined()
    // as pinned, it matches (exit 1, names false-surface)
    expect((await runScriptedTurn(seeded!)).mismatches).toEqual([])
    // the same turn expected to pass must not: the wrong choice is caught (RTS-R10 AC1)
    const { mismatches } = await runScriptedTurn({ ...seeded!, expect: { exitCode: 0 } })
    expect(mismatches.length).toBeGreaterThan(0)
    expect(mismatches).toContain('expected exit 0 got 1')
  })
})
