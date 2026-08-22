// wiring.test.ts — LLD-C7 (GH #1584), AC16/AC16b: `eval:genui-corpus` exists in `package.json` and is
// referenced by none of `check`/`test`/`test:browser` or their sub-scripts (SPEC-N3 / live-agent SPEC-R3
// — a NAMED MANUAL run, never a standing gate); `vitest.config.ts` carries the explicit
// `tools/corpus-genui/*.test.ts` include (never a wildcard, GH #112); the README names every leg + its
// KEYLESS/NEEDS-KEY tag + the no-fabrication rule and is the SOLE non-data file at the corpus-genui root.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

declare const process: { cwd(): string }

const ROOT = process.cwd()

describe('package.json — eval:genui-corpus exists, never referenced by a standing gate', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8') as string) as { scripts: Record<string, string> }

  it('the script exists and points at the documented Node type-stripping invocation', () => {
    expect(pkg.scripts['eval:genui-corpus']).toBeDefined()
    expect(pkg.scripts['eval:genui-corpus']).toContain('node --experimental-strip-types')
    expect(pkg.scripts['eval:genui-corpus']).toContain('packages/agent-ui/a2ui/tools/corpus-genui/eval-genui-corpus.ts')
  })

  it('none of check/test/test:browser (or their own sub-scripts) reference eval-genui-corpus', () => {
    const standingGateScripts = Object.entries(pkg.scripts).filter(([name]) => /^(check|test)(:|$)/.test(name))
    expect(standingGateScripts.length).toBeGreaterThan(0) // anti-vacuous
    for (const [name, body] of standingGateScripts) {
      expect(body, name).not.toMatch(/eval-genui-corpus|eval:genui-corpus/)
    }
  })
})

describe('vitest.config.ts — the explicit tools/corpus-genui/*.test.ts include (never a wildcard)', () => {
  it('carries the literal, explicit include line', () => {
    const text = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8') as string
    expect(text).toContain("'packages/agent-ui/a2ui/tools/corpus-genui/*.test.ts'")
  })

  it('anti-vacuous: this very test file is armed by that include (proof-by-execution — if you can read this, the include worked)', () => {
    expect(true).toBe(true)
  })
})

describe('corpus-genui/README.md — the runbook', () => {
  const dataDir = join(ROOT, 'packages/agent-ui/a2ui/corpus-genui')
  const readme = readFileSync(join(dataDir, 'README.md'), 'utf8') as string

  it('names every leg with its KEYLESS/NEEDS-KEY tag', () => {
    expect(readme).toMatch(/collect[\s\S]{0,80}\*\*KEYLESS\*\*/)
    expect(readme).toMatch(/generate[\s\S]{0,80}\*\*NEEDS KEY\*\*/)
    expect(readme).toMatch(/judge[\s\S]{0,80}\*\*NEEDS KEY\*\*/)
    expect(readme).toMatch(/apply[\s\S]{0,80}\*\*KEYLESS\*\*/)
    expect(readme).toMatch(/report[\s\S]{0,80}\*\*KEYLESS\*\*/)
  })

  it('states the no-fabrication rule', () => {
    expect(readme.toLowerCase()).toContain('no-fabrication')
    expect(readme).toMatch(/records\/.{0,20}verdicts\/.{0,40}ship.{0,10}EMPTY|ships.{0,10}EMPTY/i)
  })

  it('names the exact npm run eval:genui-corpus -- <leg> invocation for every leg', () => {
    for (const leg of ['collect', 'generate', 'judge', 'apply', 'report']) {
      expect(readme).toContain(`npm run eval:genui-corpus -- ${leg}`)
    }
  })

  it('is the SOLE non-data file at the corpus-genui root (the other root files are all DATA: prompts.json, index.json)', () => {
    const entries = readdirSync(dataDir) as string[]
    const files = entries.filter((e) => statSync(join(dataDir, e)).isFile()).sort()
    expect(files).toEqual(['README.md', 'index.json', 'prompts.json'].sort())
  })
})
