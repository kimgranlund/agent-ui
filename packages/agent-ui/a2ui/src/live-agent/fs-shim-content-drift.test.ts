// fs-shim-content-drift.test.ts — GH #110: fs-shim-content.ts's own header calls itself "the ONLY file
// that needs updating when a prompt or mini-skill markdown file is added/removed" — but nothing enforced
// that claim. A file added on disk without a matching entry there loads fine under real node:fs (dev,
// this test's own environment) while silently missing in the deployed Worker, since fs-shim.ts's
// readdirSync just returns whatever DIRS[path] says, throwing only if the KEY is entirely absent, never
// on a stale-but-present list.
//
// This reads fs-shim-content.ts as plain TEXT rather than importing it as a module — Vite/Vitest has no
// loader configured for `.md` imports (only Wrangler's Text module rule provides that, at Worker-build
// time), so importing the module directly here would fail to resolve. Source-text regex matching is the
// same technique build-key-safety.test.ts already uses for a different file.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

declare const process: { cwd(): string }

const ROOT = process.cwd()
const SHIM_CONTENT_PATH = `${ROOT}/packages/agent-ui/a2ui/tools/agent/worker/fs-shim-content.ts`
const PROMPTS_DIR = `${ROOT}/packages/agent-ui/a2ui/src/agent/prompts`
const MINI_SKILLS_DIR = `${PROMPTS_DIR}/mini-skills`
// genui-surface.spec.md SPEC-R9 — the third Node-only readFileSync/readdirSync call site
// (`prompts/genui-packs.ts`), the SAME drift-gate discipline applied to its own directory.
const GENUI_PACKS_DIR = `${PROMPTS_DIR}/genui-packs`

const source = readFileSync(SHIM_CONTENT_PATH, 'utf8')
const realPromptFiles = readdirSync(PROMPTS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort()
const realMiniSkillFiles = readdirSync(MINI_SKILLS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort()
const realGenuiPackFiles = readdirSync(GENUI_PACKS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort()

describe('fs-shim-content.ts stays in sync with the real prompts directory (GH #110)', () => {
  it('statically imports every top-level prompt .md file that exists on disk, and no others', () => {
    // Matches e.g. `from '../../../src/agent/prompts/grammar.md'` but not the mini-skills subpath.
    const imported = [...source.matchAll(/from '\.\.\/\.\.\/\.\.\/src\/agent\/prompts\/([a-z0-9-]+\.md)'/g)]
      .map((m) => m[1]!)
      .sort()
    expect(imported, 'a prompt .md file was added/removed on disk without a matching static import here').toEqual(
      realPromptFiles,
    )
  })

  it('statically imports every mini-skill .md file that exists on disk, and no others', () => {
    const imported = [...source.matchAll(/from '\.\.\/\.\.\/\.\.\/src\/agent\/prompts\/mini-skills\/([a-z0-9-]+\.md)'/g)]
      .map((m) => m[1]!)
      .sort()
    expect(imported, 'a mini-skill .md file was added/removed on disk without a matching static import here').toEqual(
      realMiniSkillFiles,
    )
  })

  it("the DIRS mini-skills listing (fs-shim.ts's readdirSync shim) matches the real directory exactly", () => {
    // Anchored on the KEY (`[MINI_SKILLS_PATH]:`) rather than a blanket "whole DIRS object" match — DIRS
    // now carries a SECOND array entry (genui-packs, below), so a key-anchored match is the only way to
    // isolate ONE entry's array unambiguously regardless of declaration order.
    const miniSkillsArray = source.match(/\[MINI_SKILLS_PATH\]:\s*\[([\s\S]*?)\]/)
    expect(miniSkillsArray, 'could not locate the [MINI_SKILLS_PATH] DIRS entry — has its shape changed?').not.toBeNull()
    const listed = [...miniSkillsArray![1]!.matchAll(/'([a-z0-9-]+\.md)'/g)].map((m) => m[1]!).sort()
    expect(listed, 'DIRS is stale — a 10th+ mini-skill would silently 404 in production, never in dev').toEqual(
      realMiniSkillFiles,
    )
  })

  // genui-surface.spec.md SPEC-R9 — the SAME three checks, applied to `prompts/genui-packs/*.md`.
  it('statically imports every genui-pack .md file that exists on disk, and no others', () => {
    const imported = [...source.matchAll(/from '\.\.\/\.\.\/\.\.\/src\/agent\/prompts\/genui-packs\/([a-z0-9-]+\.md)'/g)]
      .map((m) => m[1]!)
      .sort()
    expect(imported, 'a genui-pack .md file was added/removed on disk without a matching static import here').toEqual(
      realGenuiPackFiles,
    )
  })

  it("the DIRS genui-packs listing (fs-shim.ts's readdirSync shim) matches the real directory exactly", () => {
    const dirsBlock = source.match(/export const DIRS:[\s\S]*?\[([\s\S]*?)\]\s*,?\s*\n\}/)
    expect(dirsBlock).not.toBeNull()
    // The GENUI_PACKS_PATH entry is a SEPARATE array from the mini-skills one within the same DIRS object —
    // isolate it by its preceding key comment/line rather than the whole DIRS block (which also carries
    // the mini-skills list this same regex would otherwise conflate it with).
    const genuiPacksArray = source.match(/\[GENUI_PACKS_PATH\]:\s*\[([\s\S]*?)\]/)
    expect(genuiPacksArray, 'could not locate the [GENUI_PACKS_PATH] DIRS entry — has its shape changed?').not.toBeNull()
    const listed = [...genuiPacksArray![1]!.matchAll(/'([a-z0-9-]+\.md)'/g)].map((m) => m[1]!).sort()
    expect(listed, 'the genui-packs DIRS entry is stale — a new pack would silently 404 in production, never in dev').toEqual(
      realGenuiPackFiles,
    )
  })
})
