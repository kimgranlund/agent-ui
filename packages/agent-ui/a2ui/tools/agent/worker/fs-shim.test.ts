// fs-shim.test.ts — GH #112: coverage for the Worker's node:fs replacement, plus GH #110's drift gate.
// Two concerns, kept in one file since both key off the SAME fs-shim-content.ts import:
//   1. readFileSync/readdirSync's happy + error paths against the bundled FILES/DIRS maps.
//   2. GH #110 — FILES/DIRS' key SET must match the REAL `src/agent/prompts/**` directory on disk, so a
//      prompt/mini-skill file added or removed there is caught here instead of silently shipping stale in
//      production (fs-shim-content.ts's own header claims it's "the ONLY file that needs updating" — this
//      is what makes that claim enforced, not just documented).
import { describe, it, expect } from 'vitest'
import { readdirSync as realReaddirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync } from './fs-shim.ts'
import { FILES, DIRS } from './fs-shim-content.ts'

describe('fs-shim readFileSync/readdirSync — GH #112', () => {
  it('resolves a bundled file by its exact key', () => {
    const anyPath = Object.keys(FILES)[0]!
    expect(readFileSync(anyPath)).toBe(FILES[anyPath])
  })

  it('throws a descriptive error for an unbundled path — a documented no-op is wrong here, this must fail loud', () => {
    expect(() => readFileSync('/not/a/real/path.md')).toThrow(/no bundled content/)
  })

  it('resolves a bundled directory listing by its exact key', () => {
    const anyDir = Object.keys(DIRS)[0]!
    expect(readdirSync(anyDir)).toEqual(DIRS[anyDir])
  })

  it('throws a descriptive error for an unbundled directory', () => {
    expect(() => readdirSync('/not/a/real/dir')).toThrow(/no bundled directory listing/)
  })
})

// GH #110 — real directory walk, resolved relative to THIS test file (repo-relative, not process.cwd()-
// relative — this project's `tools` vitest project runs in `environment: 'node'` with no process-shim
// applied, so process.cwd() is the real repo root, but resolving off import.meta.url is more robust either way).
const REPO_ROOT = fileURLToPath(new URL('../../../../../..', import.meta.url))
const PROMPTS_DIR = `${REPO_ROOT}/packages/agent-ui/a2ui/src/agent/prompts`
// fs-shim-content.ts's own PROMPTS_PATH constant (not exported — re-derived here from its FILES/DIRS keys
// instead of importing a private constant, so this gate only depends on the PUBLIC contract).
const PROMPTS_KEY_PREFIX = '/packages/agent-ui/a2ui/src/agent/prompts'

describe('fs-shim-content.ts FILES/DIRS vs the real prompts directory — GH #110 drift gate', () => {
  it('anti-vacuous: the real directory actually has files (a hard failure here would silently pass the drift check below)', () => {
    const real = realReaddirSync(PROMPTS_DIR).filter((f) => f.endsWith('.md'))
    expect(real.length).toBeGreaterThan(0)
  })

  it('every REAL top-level prompt .md file has a matching FILES entry, and vice versa', () => {
    const realFiles = new Set(
      realReaddirSync(PROMPTS_DIR, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => `${PROMPTS_KEY_PREFIX}/${e.name}`),
    )
    const bundledFiles = new Set(Object.keys(FILES).filter((k) => !k.includes('/mini-skills/')))
    expect([...bundledFiles].sort()).toEqual([...realFiles].sort())
  })

  it('every REAL mini-skills .md file has a matching DIRS entry, and vice versa', () => {
    const miniSkillsDir = `${PROMPTS_DIR}/mini-skills`
    const realMiniSkills = realReaddirSync(miniSkillsDir).filter((f) => f.endsWith('.md'))
    const bundledMiniSkillsDirKey = `${PROMPTS_KEY_PREFIX}/mini-skills`
    expect(DIRS[bundledMiniSkillsDirKey]).toBeDefined()
    expect([...DIRS[bundledMiniSkillsDirKey]!].sort()).toEqual([...realMiniSkills].sort())
  })

  it('every DIRS mini-skills entry also has a matching FILES entry (readFileSync must resolve what readdirSync lists)', () => {
    const bundledMiniSkillsDirKey = `${PROMPTS_KEY_PREFIX}/mini-skills`
    for (const name of DIRS[bundledMiniSkillsDirKey] ?? []) {
      expect(FILES[`${bundledMiniSkillsDirKey}/${name}`], `FILES missing entry for DIRS-listed ${name}`).toBeDefined()
    }
  })
})
