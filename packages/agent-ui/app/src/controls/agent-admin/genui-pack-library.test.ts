// genui-pack-library.test.ts — genui-surface.spec.md SPEC-R11 AC1: `@agent-ui/a2ui/agent`'s
// `genuiPackLibrary` projection, fed the REAL shipped `GENUI_PACKS` registry, committed through THIS
// package's REAL `validateNewEntry` unchanged (the exact cross-package round trip the a2ui package's own
// `genui-packs.test.ts` cannot prove without importing upward — see that file's header note).

import { describe, it, expect } from 'vitest'
import { GENUI_PACKS, genuiPackLibrary } from '@agent-ui/a2ui/agent'
import { validateNewEntry, ENTRY_KINDS } from './entries.ts'

describe('genuiPackLibrary(GENUI_PACKS) → validateNewEntry — the D4 round trip (SPEC-R11 AC1)', () => {
  it('every projected pack yields one EntryLibraryPack whose entries commit through validateNewEntry unchanged', () => {
    const library = genuiPackLibrary(GENUI_PACKS)
    expect(library.length).toBe(GENUI_PACKS.length)
    for (const pack of library) {
      expect(pack.entries).toHaveLength(1)
      for (const input of pack.entries) {
        const result = validateNewEntry([], ENTRY_KINDS.patternSource, input)
        expect(result.ok, `pack "${pack.id}" failed validateNewEntry`).toBe(true)
        if (result.ok) {
          expect(result.entry.kind).toBe(ENTRY_KINDS.patternSource)
          expect(result.entry.content).toBe(input.content) // the pack body rides verbatim
          expect(result.entry.enabled).toBe(true) // a library add commits pre-enabled (validateNewEntry's own law)
          expect(result.entry.builtin).toBe(false)
        }
      }
    }
  })

  it('a slug collision (two packs sharing a label) still resolves via the suffix-counter law, never a rejection', () => {
    const library = genuiPackLibrary(GENUI_PACKS)
    if (library.length < 2) return // the registry may grow; this leg only matters once ≥2 packs exist
    const [first, second] = library
    const firstResult = validateNewEntry([], ENTRY_KINDS.patternSource, first!.entries[0]!)
    expect(firstResult.ok).toBe(true)
    if (!firstResult.ok) return
    // Simulate adding a SECOND pack whose label happens to collide (a hostile/contrived label, not a real
    // registry collision) — validateNewEntry must still resolve it via a suffix, never reject the add.
    const collidingInput = { ...second!.entries[0]!, label: first!.entries[0]!.label }
    const secondResult = validateNewEntry([firstResult.entry], ENTRY_KINDS.patternSource, collidingInput)
    expect(secondResult.ok).toBe(true)
    if (secondResult.ok) expect(secondResult.entry.id).not.toBe(firstResult.entry.id)
  })
})
