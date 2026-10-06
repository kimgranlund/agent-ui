// kit.test.ts: the kit CLI (T-0011), driven through `runCli` with cwd at the real repo root (catalogs,
// sidecars and prompts load from cwd) against a temporary copy of the kit data (`--repo-root`).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { appendFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { armOffline } from './offline.ts'
import { runCli } from './kit.ts'
import { KIT_REL } from './load.node.ts'

let disarm: () => void
let tmp: string
beforeAll(() => {
  disarm = armOffline()
  tmp = mkdtempSync(join(tmpdir(), 'a2ui-kit-'))
})
afterAll(() => {
  disarm()
  rmSync(tmp, { recursive: true, force: true })
})

/** A fresh copy of scenarios/ and __seeded__/ under `<root>/<KIT_REL>/`; returns `<root>`. */
function copyKit(name: string): string {
  const root = join(tmp, name)
  for (const dir of ['scenarios', '__seeded__']) cpSync(join(process.cwd(), KIT_REL, dir), join(root, KIT_REL, dir), { recursive: true })
  return root
}

async function cli(argv: string[], repoRoot: string, opts: { skipNegativeControl?: boolean } = {}): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = []
  const err: string[] = []
  const code = await runCli(argv, repoRoot, { ...opts, out: (l) => out.push(l), err: (l) => err.push(l) })
  return { code, out, err }
}

describe('kit CLI', () => {
  it('selftest returns 0 on the complete copy', async () => {
    const r = await cli(['selftest'], copyKit('complete'))
    expect(r.err).toEqual([])
    expect(r.code).toBe(0)
    expect(r.out.join('\n')).toContain('negative control ok')
  })

  it('selftest returns 1 after one byte is appended to a pinned fixture', async () => {
    const root = copyKit('tampered')
    appendFileSync(join(root, KIT_REL, '__seeded__/validator/root-recreate.json'), ' ')
    const r = await cli(['selftest'], root)
    expect(r.code).toBe(1)
    expect(r.err.join('\n')).toContain('root-recreate.json: sha256')
  })

  it('selftest returns 1 with skipNegativeControl', async () => {
    const r = await cli(['selftest'], copyKit('no-control'), { skipNegativeControl: true })
    expect(r.code).toBe(1)
  })

  it('run returns 1 on the seeded validator fixture and prints its layer and code', async () => {
    const r = await cli(['run', `${KIT_REL}/__seeded__/validator/root-recreate.json`], process.cwd())
    expect(r.code).toBe(1)
    expect(r.out.join('\n')).toContain('layer=validator code=IDGRAPH')
  })

  it('run on a missing path returns 2; an unknown command returns 2', async () => {
    expect((await cli(['run', `${KIT_REL}/no-such-file.json`], process.cwd())).code).toBe(2)
    expect((await cli(['frobnicate'], process.cwd())).code).toBe(2)
  })

  it('list prints every scenario with its catalog and tags', async () => {
    const r = await cli(['list'], copyKit('list'))
    expect(r.code).toBe(0)
    expect(r.out.some((l) => /scenarios\/no-response\.scenario\.json {2}catalog=agent-ui {2}tags=.*no-response/.test(l))).toBe(true)
  })
})
