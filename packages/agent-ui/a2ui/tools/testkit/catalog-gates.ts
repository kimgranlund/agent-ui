// catalog-gates.ts: the catalog selection-guidance coverage predicates (T-0011), lifted verbatim out of
// `src/catalog/selection-guidance.test.ts`, which now imports them, so the gate's real-tree legs, its
// negative controls and the kit's seeded catalog fixture run ONE copy of each rule. The real-tree legs and
// every negative control stay in that test.
//
// Imports `src/agent/selection-guidance.ts`, which reads the sidecars with `node:fs` from `process.cwd()`
// at module load, so this module is Node and jsdom only, never a browser leg.

import type { Catalog } from '../../src/catalog/catalog.ts'
import {
  loadSelectionGuidance,
  renderSelectionClause,
  SelectionGuidanceError,
} from '../../src/agent/selection-guidance.ts'
import type { SelectionGuidance } from '../../src/agent/selection-guidance.ts'

/** The loader's verdict on a document: `null` when it loads, else the error code. */
export function loadDefect(doc: unknown): string | null {
  try {
    loadSelectionGuidance(doc)
    return null
  } catch (e) {
    if (e instanceof SelectionGuidanceError) return e.code
    throw e
  }
}

export function missingEntries(guidance: SelectionGuidance, typeIds: readonly string[]): string[] {
  return typeIds.filter((t) => !Object.hasOwn(guidance, t)).map((t) => `missing entry for "${t}"`)
}

export function bijectionDefects(guidance: SelectionGuidance, typeIds: readonly string[]): string[] {
  const declared = new Set(typeIds)
  const extra = Object.keys(guidance)
    .filter((t) => !declared.has(t))
    .map((t) => `extra entry "${t}" is not a catalog type`)
  return [...missingEntries(guidance, typeIds), ...extra]
}

export function renderDefects(guidance: SelectionGuidance, catalog: Catalog): string[] {
  const out: string[] = []
  for (const [t, entry] of Object.entries(guidance)) {
    try {
      renderSelectionClause(entry, catalog)
    } catch (e) {
      out.push(`${t}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return out
}

export function reciprocityDefects(guidance: SelectionGuidance, exempt: ReadonlySet<string>): string[] {
  const out: string[] = []
  for (const [a, entry] of Object.entries(guidance)) {
    for (const { type: b } of entry.notFor) {
      if (exempt.has(b)) continue
      const back = Object.hasOwn(guidance, b) && guidance[b]!.notFor.some((e) => e.type === a)
      if (!back) out.push(`${a} -> ${b} has no ${b} -> ${a} edge`)
    }
  }
  return out
}

export function orphanDirs(onDisk: readonly string[], allowed: readonly string[]): string[] {
  const ok = new Set(allowed)
  return onDisk.filter((d) => !ok.has(d))
}
