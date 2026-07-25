// genui-packs.test.ts — genui-surface.spec.md SPEC-R9 AC1/AC2, SPEC-R11 AC1: the pattern-source pack
// registry's frontmatter integrity, budget, and A2UI-marker-free discipline, plus the `genuiPackLibrary`
// D4 projection. Deterministic, no live model (the `mini-skills.test.ts` precedent — lives under
// `src/live-agent/` because the vitest `packages` project only globs `src/**/*.test.ts`).

// NOTE: `validateNewEntry`-round-trip coverage (SPEC-R11 AC1's "entries commit through validateNewEntry
// unchanged") lives in the APP package instead of here (`packages/agent-ui/app/src/controls/agent-admin/
// genui-pack-library.test.ts`) — `a2ui` must never depend on `@agent-ui/app` (CLAUDE.md's layering law:
// `shared ← components ← a2ui ← app`, nothing imports upward), so the REAL cross-check that needs both
// `genuiPackLibrary` AND `validateNewEntry` in scope belongs on the downstream side of that edge, not here.

import { describe, it, expect } from 'vitest'
import { GENUI_PACKS, GENUI_PACK_CHAR_BUDGET, genuiPackLibrary } from '../agent/prompts/genui-packs.ts'

describe('GENUI_PACKS registry — frontmatter integrity + budget (SPEC-R9)', () => {
  it('every pack has a unique, stable kebab id, a label, and a description', () => {
    const ids = GENUI_PACKS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const pack of GENUI_PACKS) {
      expect(pack.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(pack.label.length).toBeGreaterThan(0)
      expect(pack.description.length).toBeGreaterThan(0)
    }
  })

  it('seeds at least 2-3 real starter packs (the B2 exemplar-pack slice)', () => {
    expect(GENUI_PACKS.length).toBeGreaterThanOrEqual(2)
    expect(GENUI_PACKS.map((p) => p.id)).toEqual(
      expect.arrayContaining(['data-viz-layouts', 'interactive-widgets', 'animated-explainers']),
    )
  })

  it('every pack body is at or under the ≤8000-char budget (SPEC-R9)', () => {
    for (const pack of GENUI_PACKS) {
      expect(pack.body.length, `${pack.id} is ${pack.body.length} chars (budget ${GENUI_PACK_CHAR_BUDGET})`).toBeLessThanOrEqual(
        GENUI_PACK_CHAR_BUDGET,
      )
    }
  })

  // AC1's negative control: a pack is HTML/CSS idiom prose, never an A2UI worked example — the exact
  // marker `mini-skills.test.ts` asserts absent from every MINI_SKILLS body, applied to this registry.
  it('no pack body embeds an A2UI message marker ("version":"v1.0" never appears)', () => {
    for (const pack of GENUI_PACKS) {
      expect(pack.body).not.toMatch(/"version"\s*:\s*"v1\.0"/)
    }
  })
})

describe('genuiPackLibrary — the D4 EntryLibraryPack projection (SPEC-R11 AC1)', () => {
  it('projects each pack into one library pack carrying exactly one ready-to-add entry', () => {
    const library = genuiPackLibrary(GENUI_PACKS)
    expect(library).toHaveLength(GENUI_PACKS.length)
    for (const [i, pack] of GENUI_PACKS.entries()) {
      expect(library[i]).toEqual({
        id: pack.id,
        label: pack.label,
        description: pack.description,
        entries: [{ label: pack.label, description: pack.description, content: pack.body }],
      })
    }
  })

  it('every projected entry is shaped like a valid NewEntryInput (non-empty label; content is the pack body verbatim)', () => {
    // The APP-side round-trip through the REAL validateNewEntry lives in genui-pack-library.test.ts
    // (packages/agent-ui/app) — this leg only proves the SHAPE this package can prove without importing
    // upward: a non-empty label (validateNewEntry's one real precondition) and content fidelity.
    for (const pack of genuiPackLibrary(GENUI_PACKS)) {
      for (const input of pack.entries) {
        expect(input.label.trim().length).toBeGreaterThan(0)
        expect(input.content).toBe(GENUI_PACKS.find((p) => p.id === pack.id)!.body)
      }
    }
  })

  it('degrades to [] over an empty pack list', () => {
    expect(genuiPackLibrary([])).toEqual([])
  })
})
