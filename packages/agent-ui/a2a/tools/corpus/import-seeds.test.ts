// import-seeds.test.ts — GH #343 regression coverage for `import-seeds.ts`'s CLI-entry guard, the a2a
// twin of GH #335's a2ui fix (7b91862). Before this fix `main()` ran UNCONDITIONALLY at module top
// level, so merely IMPORTING the module — a test, a tooling script, a REPL — performed a real,
// mutating `writeFileSync` against the committed a2a corpus shards as a side effect of loading it.
//
// This is a real-subprocess test, not a unit test: `import-seeds.ts` exports nothing (no pure helpers
// like the a2ui sibling's `parseArgs`/`dispositionGuard` to import safely either way), so the only
// faithful way to observe "importing this module" is to actually import it, in a fresh process, from a
// script whose own path does not end in "import-seeds.ts" (`import-seeds.import-probe.mjs`, this
// file's sibling fixture) — exactly the shape the guard checks (`process.argv[1]?.endsWith(...)`).
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

declare const process: { cwd(): string }

const repoRoot = process.cwd()
const demoShardPath = join(repoRoot, 'packages/agent-ui/a2a/corpus/demo/v0_3_0/a2a.jsonl')
const conceptShardPath = join(repoRoot, 'packages/agent-ui/a2a/corpus/concept/v0_3_0/a2a.jsonl')
const importProbePath = join(repoRoot, 'packages/agent-ui/a2a/tools/corpus/import-seeds.import-probe.mjs')
const importSeedsPath = join(repoRoot, 'packages/agent-ui/a2a/tools/corpus/import-seeds.ts')

describe('import-seeds.ts CLI-entry guard — GH #343 (importing must never mutate the corpus)', () => {
  it('importing the module (argv[1] does not end in "import-seeds.ts") does not run main(): no admitted output, the guard\'s stderr line fires, and the corpus is untouched', () => {
    const beforeDemo = readFileSync(demoShardPath, 'utf8')
    const beforeConcept = readFileSync(conceptShardPath, 'utf8')

    const result = spawnSync('node', ['--experimental-strip-types', importProbePath], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    // The guard's loud else-branch (GH #335 review item 4, mirrored here): a silent no-op exit-0 is the
    // wrong shape, so this line must name the loaded path.
    expect(result.stderr).toMatch(/not invoked as import-seeds\.ts/)
    expect(result.stderr).toContain('import-seeds.import-probe.mjs')
    // main() never fired, so its own success line must never appear.
    expect(result.stdout).not.toMatch(/admitted/)

    expect(readFileSync(demoShardPath, 'utf8')).toBe(beforeDemo)
    expect(readFileSync(conceptShardPath, 'utf8')).toBe(beforeConcept)
  })

  it('direct execution (argv[1] IS import-seeds.ts) still runs main() normally, admitting every seed and leaving the corpus byte-identical (byte-idempotent re-run, per the module\'s own header comment)', () => {
    const beforeDemo = readFileSync(demoShardPath, 'utf8')
    const beforeConcept = readFileSync(conceptShardPath, 'utf8')

    const result = spawnSync('node', ['--experimental-strip-types', importSeedsPath], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/admitted \(\d+ concept, \d+ demo\), 0 errors\./)

    expect(readFileSync(demoShardPath, 'utf8')).toBe(beforeDemo)
    expect(readFileSync(conceptShardPath, 'utf8')).toBe(beforeConcept)
  })
})
