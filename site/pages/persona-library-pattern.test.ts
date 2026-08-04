// persona-library-pattern.test.ts — the drift gate for persona-library-pattern.ts (GH #406, M-B DoD
// box 3). This page has no descriptor to derive an API table from (it documents a cross-cutting PATTERN,
// not one component's contract) — so its structurable claim is narrower and different: every artifact it
// SHOWS is produced by CALLING the real agent-admin-persona-file.ts functions live, never a hand-typed
// literal. This test re-derives the SAME artifacts independently (its own calls into the same real
// functions, on the same real shipped preset) and asserts DOM-shown ≡ freshly-derived — so a change to
// the envelope shape, the validation order/wording, or the mint/collision rule shows up here as a real
// failure, not silent page drift.
//
// The one deliberate exception: `exportedAt` is a fresh `new Date().toISOString()` on every call (the
// module's own doc comment: "provenance only — never read back into state"), so the page's captured
// export and this test's independently-recomputed export can legitimately differ on that ONE field by a
// few milliseconds. The comparison strips it (documented below) rather than pinning a fake clock the
// production page itself doesn't accept a clock override for.
//
// DOM reads happen inside `beforeAll`/`it`, never at describe-body top level: describe callbacks run
// during vitest's synchronous COLLECTION phase, before any hook runs — reading `document.getElementById`
// there would race the deferred page-mount import below and read an empty document.
import { describe, it, expect, beforeAll } from 'vitest'
import { AGENT_PRESETS, personaFromPreset } from './agent-admin-presets.ts'
import { createMemoryStore, ENTRY_KINDS, entriesStoreKey } from '@agent-ui/app'
import {
  exportPersonaFile,
  personaFileText,
  readPersonaFile,
  importedPersonaFrom,
  type PersonaFile,
} from './agent-admin-persona-file.ts'

/** The page's own demo preset, read the same way the page reads it — never hand-copied. */
function quantPreset() {
  const preset = AGENT_PRESETS.find((p) => p.id === 'quant')
  if (!preset) throw new Error('test fixture: the shipped "quant" preset is gone')
  return preset
}

/** A fresh, independent export of the SAME demo persona — its own store, its own call into the real
 *  functions. Used to prove the page's shown JSON is genuinely DERIVED (recomputing it here reproduces
 *  the same shape), not just self-consistent with a stale literal. */
function freshExport(): { file: PersonaFile; text: string } {
  const persona = personaFromPreset(quantPreset())
  const store = createMemoryStore({ initial: persona.seed })
  const file = exportPersonaFile(persona, store)
  return { file, text: personaFileText(file) }
}

/** `file` minus its provenance timestamp — the one field two independent export calls may legitimately
 *  disagree on (see file header). Every other field is the identical-behaviour claim this page makes. */
function stateFingerprint(file: PersonaFile): unknown {
  const { exportedAt: _exportedAt, ...rest } = file
  return rest
}

let shownText: string
let shownFile: PersonaFile
let shownRejection: string
let mintRows: Element[]
let shownCompositionSource: string
let composeFn: (...args: never[]) => unknown

beforeAll(async () => {
  // A DEFERRED import (never a static one at file top) — the a2ui-chat.test.ts / a2ui-live.ask-lifecycle
  // .test.ts precedent: a static import is hoisted and would mount the real page before this file's own
  // setup runs. This page mounts no form-associated custom element (no ui-text-field/ui-button in a
  // form), so — unlike those two — no ElementInternals stub is needed first.
  const mod = await import('./persona-library-pattern.ts')
  shownText = document.getElementById('persona-export-json')?.textContent ?? ''
  shownFile = JSON.parse(shownText) as PersonaFile
  shownRejection = document.getElementById('persona-import-rejection')?.textContent ?? ''
  mintRows = [...(document.getElementById('persona-import-mint')?.querySelectorAll('tbody tr') ?? [])]
  shownCompositionSource = document.getElementById('persona-composition-code')?.textContent ?? ''
  composeFn = mod.composePersonaLibraryDemo as (...args: never[]) => unknown
})

describe('persona-library-pattern.html — the shown export JSON is genuinely derived, not a stale literal', () => {
  it('anti-vacuous: the page actually rendered a non-empty export block', () => {
    expect(shownText.length).toBeGreaterThan(100)
    expect(shownFile.kind).toBe('agent-ui-persona')
  })

  it('the shown envelope (minus the provenance timestamp) equals a fresh, independent call into the real exporter', () => {
    const fresh = freshExport()
    expect(stateFingerprint(shownFile)).toEqual(stateFingerprint(fresh.file))
  })

  it('exportedAt is real provenance (a parseable ISO timestamp)', () => {
    expect(Number.isNaN(Date.parse(shownFile.exportedAt))).toBe(false)
  })

  it('negative control: the fingerprint comparison genuinely distinguishes a real divergence (the gate bites)', () => {
    const fresh = freshExport()
    const diverged: PersonaFile = { ...fresh.file, persona: { ...fresh.file.persona, label: 'Someone Else' } }
    expect(stateFingerprint(shownFile)).not.toEqual(stateFingerprint(diverged))
  })
})

describe('persona-library-pattern.html — the shown composition code block is the real function source, not a hand-typed paraphrase (MAJOR 2)', () => {
  it('anti-vacuous: the page actually rendered a non-empty composition block naming all four functions it composes', () => {
    expect(shownCompositionSource.length).toBeGreaterThan(20)
    for (const fnName of ['exportPersonaFile', 'personaFileText', 'readPersonaFile', 'importedPersonaFrom']) {
      expect(shownCompositionSource).toContain(fnName)
    }
  })

  it('the shown block is exactly composePersonaLibraryDemo.toString() — the literal source of the function the page calls to produce every artifact above', () => {
    expect(shownCompositionSource).toBe(composeFn.toString())
  })

  it('negative control: the shown block does NOT equal a different function’s source (the equality check genuinely distinguishes, the gate bites)', () => {
    expect(shownCompositionSource).not.toBe(readPersonaFile.toString())
  })
})

describe('persona-library-pattern.html — the shown rejection is the real fail-closed error, not paraphrased prose', () => {
  it('anti-vacuous: the page actually rendered a rejection message', () => {
    expect(shownRejection.length).toBeGreaterThan(0)
    expect(shownRejection).not.toBe('(unexpectedly accepted)') // the page's own "something is wrong" sentinel
  })

  it('a freshly-corrupted export, fed to the real validator, produces the SAME message the page shows', () => {
    const fresh = freshExport()
    const skillsKey = entriesStoreKey(ENTRY_KINDS.skill)
    const corrupted = JSON.parse(fresh.text) as { state: Record<string, unknown> }
    const skills = corrupted.state[skillsKey] as Array<Record<string, unknown>>
    delete skills[0].description
    const result = readPersonaFile(`${JSON.stringify(corrupted, null, 2)}\n`)
    expect(result.ok).toBe(false)
    expect(result.ok ? undefined : result.error).toBe(shownRejection)
  })

  it('negative control: a DIFFERENT corruption produces a DIFFERENT message than the page shows (the gate bites)', () => {
    const fresh = freshExport()
    const corrupted = { ...JSON.parse(fresh.text), kind: 'not-a-persona-file' }
    const result = readPersonaFile(JSON.stringify(corrupted))
    expect(result.ok).toBe(false)
    expect(result.ok ? undefined : result.error).not.toBe(shownRejection)
  })

  it('a VALID export (uncorrupted) is genuinely accepted — the rejection above is about the corruption, not the format', () => {
    const fresh = freshExport()
    expect(readPersonaFile(fresh.text).ok).toBe(true)
  })
})

describe('persona-library-pattern.html — the shown mint table is the real collision-safe id/label, not typed prose', () => {
  it('anti-vacuous: the page actually rendered both roster rows', () => {
    expect(mintRows.length).toBe(2)
  })

  // Each row is [row-label, id, label] — `tableRow(textCell(rowLabel), codeCell(id), codeCell(label))` in
  // the page — so the id/label pair the page CLAIMS is cells[1..2], never cells[0] (its own row caption).
  it('row 1 (the source persona) matches the real "quant" preset id/label', () => {
    const persona = personaFromPreset(quantPreset())
    const cells = [...(mintRows[0]?.querySelectorAll('td') ?? [])].map((td) => td.textContent)
    expect(cells.slice(1)).toEqual([persona.id, persona.label])
  })

  it('row 2 (the re-import) matches a fresh, independent mint call against the real roster — collision-safe, never the source id', () => {
    const fresh = freshExport()
    const parsed = readPersonaFile(fresh.text)
    if (!parsed.ok) throw new Error('test fixture: the fresh export failed its own validator')
    const roster = AGENT_PRESETS.map(personaFromPreset)
    const minted = importedPersonaFrom(parsed.file, roster)
    const cells = [...(mintRows[1]?.querySelectorAll('td') ?? [])].map((td) => td.textContent)
    expect(cells.slice(1)).toEqual([minted.id, minted.label])
    expect(minted.id).not.toBe(personaFromPreset(quantPreset()).id) // the library-semantics load-bearing fact
  })
})
