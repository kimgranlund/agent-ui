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
import type { AppendedEdges, SelectionGuidance } from '../../src/agent/selection-guidance.ts'

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

// ---- T-0202 (catalog architecture CA-R4, CA-R9, D8): the domain sidecar edge law ----

/** No-replace: a domain's own `types` key that names a base type (a domain never replaces a base entry). */
export function replaceDefects(domainId: string, own: SelectionGuidance, baseTypes: ReadonlySet<string>): string[] {
  return Object.keys(own)
    .filter((t) => baseTypes.has(t))
    .map((t) => `domain "${domainId}" replaces the base entry "${t}"`)
}

/** Cross-domain: a domain's own entries name only its own types or base types, and an appended edge names only
 *  the domain's own types (it points a base entry at the domain composite), so each domain also composes alone. */
export function crossDomainDefects(
  domainId: string,
  own: SelectionGuidance,
  append: AppendedEdges,
  baseTypes: ReadonlySet<string>,
): string[] {
  const out: string[] = []
  for (const [a, entry] of Object.entries(own)) {
    for (const { type: b } of entry.notFor) {
      if (!Object.hasOwn(own, b) && !baseTypes.has(b)) out.push(`domain "${domainId}": ${a} -> ${b} names a type outside the domain and its base`)
    }
  }
  for (const [a, edges] of Object.entries(append)) {
    for (const { type: b } of edges) {
      if (!Object.hasOwn(own, b)) out.push(`domain "${domainId}": appended ${a} -> ${b} names a type the domain does not declare`)
    }
  }
  return out
}

/** Append-only: an appended edge lands on a base entry, never repeats an edge that entry already has, and leaves
 *  the entry within the per-entry edge cap (4). */
export function appendDefects(domainId: string, append: AppendedEdges, base: SelectionGuidance): string[] {
  const out: string[] = []
  for (const [t, edges] of Object.entries(append)) {
    const entry = base[t]
    if (entry === undefined) {
      out.push(`domain "${domainId}" appends to "${t}", which is not a base entry`)
      continue
    }
    for (const e of edges) if (entry.notFor.some((x) => x.type === e.type)) out.push(`domain "${domainId}" repeats the base edge ${t} -> ${e.type}`)
    if (entry.notFor.length + edges.length > 4) out.push(`domain "${domainId}" leaves "${t}" with ${entry.notFor.length + edges.length} notFor edges (0..4)`)
  }
  return out
}
