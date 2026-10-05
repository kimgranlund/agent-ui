// wiring.test.ts: the agent-behavior eval's gate wiring (GH #1810). The fixture pins red on an
// unpinned edit or an unpinned new fixture (fork 4, Kim 2026-10-05); `check:scripts` runs the keyless
// selftest and no standing gate runs the live leg; `vitest.config.ts` carries the explicit include line
// (never a wildcard, GH #112). Pin tests write only to their own temp copies.

import { describe, it, expect } from 'vitest'
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifyPins } from './pins.ts'

const ROOT = process.cwd()
const FIXTURES = join(ROOT, 'packages/agent-ui/a2ui/tools/agent-eval/fixtures')

function withFixtureCopy(fn: (dir: string) => void): void {
  const tmp = mkdtempSync(join(tmpdir(), 'agent-eval-pins-'))
  try {
    const dir = join(tmp, 'fixtures')
    cpSync(FIXTURES, dir, { recursive: true })
    fn(dir)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

describe('fixture pins', () => {
  it('editing a protected fixture without its pin fails the pin check', () => {
    withFixtureCopy((dir) => {
      expect(verifyPins(dir).ok).toBe(true) // anti-vacuous: green before the edit
      appendFileSync(join(dir, 'persona-cases.json'), ' ')
      const check = verifyPins(dir)
      expect(check.ok).toBe(false)
      expect(check.problems.some((p) => p.startsWith('persona-cases.json:'))).toBe(true)
    })
  })

  it('an unpinned new fixture fails the pin check', () => {
    withFixtureCopy((dir) => {
      writeFileSync(join(dir, 'extra-cases.json'), '{"cases":[]}\n')
      writeFileSync(join(dir, '.DS_Store'), 'ignored') // dotfiles never red the gate
      const check = verifyPins(dir)
      expect(check.ok).toBe(false)
      expect(check.problems).toEqual([expect.stringMatching(/^extra-cases\.json: unpinned/)])
    })
  })
})

describe('gate wiring', () => {
  it('check:scripts runs the selftest and no standing gate runs the live leg', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts['eval:agent-behavior']).toBe('node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts')
    expect(pkg.scripts['check:scripts']).toContain(
      'node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts selftest',
    )
    const standing = Object.entries(pkg.scripts).filter(([name]) => /^(check|test)(:|$)/.test(name))
    expect(standing.length).toBeGreaterThan(0) // anti-vacuous
    for (const [name, body] of standing) {
      expect(body, name).not.toMatch(/eval-agent-behavior\.ts live|eval:agent-behavior/)
      const runs = body.match(/eval-agent-behavior\.ts\s+\S+/g) ?? []
      for (const run of runs) expect(run, name).toMatch(/selftest$/)
    }
    const vitestConfig = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8')
    expect(vitestConfig).toContain("'packages/agent-ui/a2ui/tools/agent-eval/*.test.ts',")
  })
})
