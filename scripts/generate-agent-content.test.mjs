// generate-agent-content.test.mjs: the agent-content generator's CLI (`scripts` vitest project, node). The
// CLI runs in a scratch copy of the content roots, so the real tree is never mutated:
//   (a) `--check` exits 0 on an unedited copy;
//   (b) `--check` exits 1 on a hand-edited registry.gen.ts (the T-0160 negative control);
//   (c) `--check` and a plain write both exit 1 on invalid content, and the write leaves the registry alone;
//   (d) `--check` exits 1 on a hand-edited manifest seedVersion, and a write restores it;
//   (e) a dotfile (.DS_Store) anywhere under the content root never reds `--check`;
//   (f) a malformed manifest or pack.json is a listed problem naming its path, never an uncaught throw.

import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OUT_REGISTRY } from './generate-agent-content.mjs'

const SCRIPT = join(process.cwd(), 'scripts/generate-agent-content.mjs')
const ROOTS = ['site/agent-content', 'site/lib/agent-manifest']

const scratch = []
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true })
})

/** A scratch root holding a copy of every content root. */
function copyTree() {
  const dir = mkdtempSync(join(tmpdir(), 'generate-agent-content-'))
  scratch.push(dir)
  for (const root of ROOTS) cpSync(join(process.cwd(), root), join(dir, root), { recursive: true })
  return dir
}

const run = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' })

describe('generate-agent-content CLI', () => {
  it('--check exits 0 on an unedited copy', () => {
    const r = run(copyTree(), '--check')
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
  })

  it('--check exits 1 on a hand-edited registry', () => {
    const dir = copyTree()
    appendFileSync(join(dir, OUT_REGISTRY), '// hand edit\n')
    const r = run(dir, '--check')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain(`${OUT_REGISTRY} is stale`)
  })

  it('--check exits 1 on a hand-edited manifest seedVersion, and a write restores it', () => {
    const dir = copyTree()
    const path = join(dir, 'site/lib/agent-manifest/quant.manifest.json')
    const original = readFileSync(path, 'utf8')
    writeFileSync(path, original.replace('"seedVersion": 1,', '"seedVersion": 2,'))
    const check = run(dir, '--check')
    expect(check.status).toBe(1)
    expect(check.stderr).toContain('quant.manifest.json is stale')
    expect(run(dir).status).toBe(0)
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it('a .DS_Store under the content root never reds --check', () => {
    const dir = copyTree()
    writeFileSync(join(dir, 'site/agent-content/.DS_Store'), 'junk')
    writeFileSync(join(dir, 'site/agent-content/personas/quant/.DS_Store'), 'junk')
    const r = run(dir, '--check')
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
  })

  it('a malformed manifest or pack.json is a listed problem with its path', () => {
    const dir = copyTree()
    writeFileSync(join(dir, 'site/lib/agent-manifest/quant.manifest.json'), '{ not json')
    const manifest = run(dir, '--check')
    expect(manifest.status).toBe(1)
    expect(manifest.stderr).toContain('generate-agent-content: site/lib/agent-manifest/quant.manifest.json: ')
    expect(manifest.stderr).not.toContain('    at ')
    const dir2 = copyTree()
    writeFileSync(join(dir2, 'site/agent-content/packs/games/pack.json'), '{ not json')
    const pack = run(dir2, '--check')
    expect(pack.status).toBe(1)
    expect(pack.stderr).toContain('generate-agent-content: site/agent-content/packs/games/pack.json: ')
    expect(pack.stderr).not.toContain('    at ')
  })

  it('invalid content fails both modes and the write leaves the registry alone', () => {
    const dir = copyTree()
    const agent = join(dir, 'site/agent-content/personas/quant/agent.md')
    writeFileSync(agent, readFileSync(agent, 'utf8').replace('"skills": [', '"skills": [\n    "ghost@1",'))
    const before = readFileSync(join(dir, OUT_REGISTRY), 'utf8')
    const check = run(dir, '--check')
    expect(check.status).toBe(1)
    expect(check.stderr).toContain('ghost@1 names no skill')
    const write = run(dir)
    expect(write.status).toBe(1)
    expect(readFileSync(join(dir, OUT_REGISTRY), 'utf8')).toBe(before)
  })
})
